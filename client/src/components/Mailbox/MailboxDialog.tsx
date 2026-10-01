import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Send, X, Feather, Check, Trash2, ArrowLeft, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { useTheme } from '@client/src/hooks/use-theme';
import {
  addLetter,
  getLettersByType,
  getLetterById,
  markAsRead,
  getUnreadCount,
  deleteLetter,
  getReceivedReplyForSent,
  getSentReplyForReceived,
  hasUserRepliedTo,
  type Letter,
  type LetterType,
} from '@client/src/utils/letter-storage';
import {
  generateLetterContent,
  type ProfileSettings,
  type RhythmConfigSettings,
  addPendingLetterReply,
  getPendingLetterReplies,
  removePendingLetterReply,
  type PendingLetterReply,
} from '@client/src/utils/local-storage';

interface MailboxDialogProps {
  open: boolean;
  onClose: () => void;
  rhythm: RhythmConfigSettings;
  profile: ProfileSettings;
  onLetterArrived?: () => void;
}

type TabKey = LetterType;

const TAB_ITEMS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'sent', label: '寄出的信', icon: '📤' },
  { key: 'received', label: '收到的信', icon: '📥' },
  { key: 'space_time', label: '时空来信', icon: '🌌' },
];

const EMPTY_TEXT: Record<TabKey, { title: string; desc: string }> = {
  sent: { title: '还没有寄出任何信件', desc: '提笔写一封信吧，字里行间都是心意' },
  received: { title: '还没有收到信件', desc: '寄出的信或许需要一点时间才能收到回复' },
  space_time: { title: '时空来信空空如也', desc: '也许在某个时刻，TA 会从远方寄来一封' },
};

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatLetterTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  if (sameDay) return `今天 ${h}:${m}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${h}:${m}`;
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (y === now.getFullYear()) return `${mo}-${d} ${h}:${m}`;
  return `${y}-${mo}-${d} ${h}:${m}`;
}

function formatLetterDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${mo}/${day} ${WEEKDAYS[d.getDay()]}`;
}

function getFirstLine(text: string, maxLen = 40): string {
  const firstLine = text.split('\n')[0] || text.replace(/\s+/g, ' ').trim();
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + '…';
}

const MailboxDialog = ({ open, onClose, rhythm, profile, onLetterArrived }: MailboxDialogProps) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('sent');
  const [letters, setLetters] = useState<Letter[]>([]);
  const [repliedMap, setRepliedMap] = useState<Record<string, boolean>>({});
  const [userRepliedMap, setUserRepliedMap] = useState<Record<string, boolean>>({});
  const [unreadReceived, setUnreadReceived] = useState(0);
  const [unreadSpaceTime, setUnreadSpaceTime] = useState(0);
  const [detailLetter, setDetailLetter] = useState<Letter | null>(null);
  const [originalLetter, setOriginalLetter] = useState<Letter | null>(null);
  const [replyLetter, setReplyLetter] = useState<Letter | null>(null);
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const pendingLetterTimersRef = useRef<Record<string, number>>({});

  const taName = profile.taName || 'TA';

  const refreshLetters = useCallback(async (type: LetterType) => {
    try {
      const list = await getLettersByType(type);
      setLetters(list);
      if (type === 'sent') {
        const replyMap: Record<string, boolean> = {};
        await Promise.all(
          list.map(async (l) => {
            const reply = await getReceivedReplyForSent(l.id);
            replyMap[l.id] = !!reply;
          })
        );
        setRepliedMap(replyMap);
        setUserRepliedMap({});
      } else {
        const ids = list.map((l) => l.id);
        const repliedSet = await hasUserRepliedTo(ids);
        const userReplyMap: Record<string, boolean> = {};
        repliedSet.forEach((id) => { userReplyMap[id] = true; });
        setUserRepliedMap(userReplyMap);
        setRepliedMap({});
      }
    } catch (err) {
      setLetters([]);
      setRepliedMap({});
      setUserRepliedMap({});
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const [received, spaceTime] = await Promise.all([
        getUnreadCount('received'),
        getUnreadCount('space_time'),
      ]);
      setUnreadReceived(received);
      setUnreadSpaceTime(spaceTime);
    } catch {
      // ignore
    }
  }, []);

  const executeLetterReply = useCallback(async (replyToId: string, taskId: string) => {
    logger.info(`[letter-reply] 执行回信 replyTo=${replyToId} taskId=${taskId}`);
    const content = generateLetterContent(5, 15);
    if (!content) {
      removePendingLetterReply(taskId);
      delete pendingLetterTimersRef.current[taskId];
      return;
    }
    try {
      await addLetter({
        type: 'received',
        content,
        timestamp: Date.now(),
        read: false,
        replyTo: replyToId,
      });
      void refreshUnread();
      onLetterArrived?.();
      if (activeTab === 'received') {
        void refreshLetters('received');
      }
      if (activeTab === 'sent') {
        void refreshLetters('sent');
      }
      logger.info(`[letter-reply] 回信完成 replyTo=${replyToId}`);
    } catch (err) {
      logger.error('[letter-reply] 回信失败', err);
    } finally {
      removePendingLetterReply(taskId);
      delete pendingLetterTimersRef.current[taskId];
    }
  }, [activeTab, refreshLetters, refreshUnread, onLetterArrived]);

  const schedulePendingLetterReply = useCallback((task: PendingLetterReply) => {
    if (pendingLetterTimersRef.current[task.id]) {
      return;
    }
    const now = Date.now();
    const delay = Math.max(0, task.scheduledAt - now);
    logger.info(`[letter-reply] 调度回信 taskId=${task.id} delayMs=${delay}`);
    const timer = window.setTimeout(() => {
      if (!task.willReply) {
        logger.info(`[letter-reply] 命中不回复概率 taskId=${task.id}`);
        removePendingLetterReply(task.id);
        delete pendingLetterTimersRef.current[task.id];
        return;
      }
      void executeLetterReply(task.replyToId, task.id);
    }, delay);
    pendingLetterTimersRef.current[task.id] = timer;
  }, [executeLetterReply]);

  const restorePendingReplies = useCallback(() => {
    const list = getPendingLetterReplies();
    logger.info(`[letter-reply] 加载待回复任务 count=${list.length}`);
    const now = Date.now();
    for (const task of list) {
      if (now >= task.scheduledAt) {
        logger.info(`[letter-reply] 任务已到期，立即执行 taskId=${task.id}`);
        if (!task.willReply) {
          removePendingLetterReply(task.id);
          continue;
        }
        void executeLetterReply(task.replyToId, task.id);
      } else {
        schedulePendingLetterReply(task);
      }
    }
  }, [executeLetterReply, schedulePendingLetterReply]);

  useEffect(() => {
    if (!open) return;
    void refreshLetters(activeTab);
    void refreshUnread();
    restorePendingReplies();
  }, [open, activeTab, refreshLetters, refreshUnread, restorePendingReplies]);

  useEffect(() => {
    if (!open) {
      Object.values(pendingLetterTimersRef.current).forEach((t) => clearTimeout(t));
      pendingLetterTimersRef.current = {};
      setDetailLetter(null);
      setOriginalLetter(null);
      setReplyLetter(null);
      setNavHistory([]);
      setShowCompose(false);
    }
    return () => {
      Object.values(pendingLetterTimersRef.current).forEach((t) => clearTimeout(t));
      pendingLetterTimersRef.current = {};
    };
  }, [open]);

  const handleLetterClick = useCallback(async (letter: Letter, clearHistory = false) => {
    if (clearHistory) setNavHistory([]);
    setDetailLetter(letter);
    setOriginalLetter(null);
    setReplyLetter(null);
    if (letter.replyTo) {
      try {
        const ref = await getLetterById(letter.replyTo);
        if (ref) setOriginalLetter(ref);
      } catch {
        // ignore
      }
    }
    if (letter.type === 'sent') {
      try {
        const ref = await getReceivedReplyForSent(letter.id);
        if (ref) setReplyLetter(ref);
      } catch {
        // ignore
      }
    } else if (letter.type === 'received') {
      try {
        const ref = await getSentReplyForReceived(letter.id);
        if (ref) setReplyLetter(ref);
      } catch {
        // ignore
      }
    }
    if (!letter.read) {
      try {
        await markAsRead(letter.id);
        setLetters((prev) => prev.map((l) => (l.id === letter.id ? { ...l, read: true } : l)));
        setDetailLetter((prev) => (prev && prev.id === letter.id ? { ...prev, read: true } : prev));
        void refreshUnread();
        onLetterArrived?.();
      } catch {
        // ignore
      }
    }
  }, [refreshUnread, onLetterArrived]);

  const navigateToLetter = useCallback(async (targetLetter: Letter) => {
    if (detailLetter) {
      setNavHistory((prev) => [...prev, detailLetter.id]);
    }
    await handleLetterClick(targetLetter, false);
  }, [detailLetter, handleLetterClick]);

  const handleOriginalRefClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!originalLetter) return;
    await navigateToLetter(originalLetter);
  }, [originalLetter, navigateToLetter]);

  const handleReplyRefClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!replyLetter) return;
    await navigateToLetter(replyLetter);
  }, [replyLetter, navigateToLetter]);

  const handleBackFromDetail = useCallback(async () => {
    if (navHistory.length > 0) {
      const prevId = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      try {
        const prevLetter = await getLetterById(prevId);
        if (prevLetter) {
          await handleLetterClick(prevLetter, false);
          return;
        }
      } catch {
        // ignore
      }
    }
    setDetailLetter(null);
    setOriginalLetter(null);
    setReplyLetter(null);
    setNavHistory([]);
  }, [navHistory, handleLetterClick]);

  const handleDeleteLetter = useCallback(async (e: React.MouseEvent, letter: Letter) => {
    e.stopPropagation();
    const confirmed = await showConfirm('确定删除这封信吗？');
    if (!confirmed) return;
    try {
      await deleteLetter(letter.id);
      setLetters((prev) => prev.filter((l) => l.id !== letter.id));
        if (detailLetter?.id === letter.id) {
          setDetailLetter(null);
          setOriginalLetter(null);
          setReplyLetter(null);
          setNavHistory([]);
        }
      void refreshUnread();
      toast('已删除');
    } catch (err) {
      logger.error('删除信件失败', err);
      toast('删除失败');
    }
  }, [detailLetter, refreshUnread]);

  const handleOpenCompose = useCallback(() => {
    setShowCompose(true);
    setComposeText('');
  }, []);

  const handleReply = useCallback((letter: Letter) => {
    setDetailLetter(null);
    setOriginalLetter(letter);
    setReplyLetter(null);
    setNavHistory([]);
    setShowCompose(true);
    setComposeText('');
  }, []);

  const handleCloseCompose = useCallback(() => {
    setShowCompose(false);
    setComposeText('');
  }, []);

  const triggerReplies = useCallback((replyToId: string) => {
    const willReply = Math.random() < 0.8;
    const minMs = 1 * 3600 * 1000;
    const maxMs = 24 * 3600 * 1000;
    const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs));
    const scheduledAt = Date.now() + delayMs;
    const taskId = `letter_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const task: PendingLetterReply = {
      id: taskId,
      replyToId,
      scheduledAt,
      willReply,
      createdAt: Date.now(),
    };

    addPendingLetterReply(task);
    logger.info(`[letter-reply] 创建待回复任务 taskId=${taskId} replyTo=${replyToId} willReply=${willReply} scheduledAt=${new Date(scheduledAt).toISOString()}`);
    schedulePendingLetterReply(task);
  }, [schedulePendingLetterReply]);

  const handleSendLetter = useCallback(async () => {
    const content = composeText.trim();
    if (!content || sending) return;
    setSending(true);
    try {
       const letter = await addLetter({
        type: 'sent',
        content,
        timestamp: Date.now(),
        read: true,
        replyTo: originalLetter?.id,
      });
      toast('信件已寄出');
      setShowCompose(false);
      setComposeText('');
      setActiveTab('sent');
      void refreshLetters('sent');
      triggerReplies(letter.id);
    } catch (err) {
      toast('发送失败，请重试');
    } finally {
      setSending(false);
    }
  }, [composeText, sending, originalLetter, refreshLetters, triggerReplies]);

  if (!open) return null;

  const contentBg = isDark ? '#2c2c2e' : '#fdfbf7';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textPrimary = isDark ? '#f5f5f7' : '#333333';
  const textSecondary = isDark ? '#98989d' : '#999999';
  const textMuted = isDark ? 'rgba(255,255,255,0.4)' : '#c4c4c4';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(201, 168, 124, 0.15)';
  const tabInactiveBg = isDark ? '#3a3a3c' : '#f0ebe2';
  const accent = '#c9a87c';

  const unreadForTab = (key: TabKey): number => {
    if (key === 'received') return unreadReceived;
    if (key === 'space_time') return unreadSpaceTime;
    return 0;
  };

  const renderLetterDetail = (letter: Letter) => {
    const isSent = letter.type === 'sent';
    const isReceived = letter.type === 'received';
    const isSpaceTime = letter.type === 'space_time';
    const fromName = isSent ? '我' : taName;
    const toName = isSent ? taName : '我';
    const headerGreeting = isSent
      ? `致${toName}：`
      : '致我：';
    const headerSub = isSent
      ? '见字如面，望君安好。'
      : '见字如面，一切皆好。';
    const userReplied = !isSent && userRepliedMap[letter.id];
    const statusLabel = isSent
      ? (repliedMap[letter.id] ? '已回复' : '已送达')
      : (userReplied ? '已回复' : '已收到');
    const statusBadge = isSent
      ? (repliedMap[letter.id] ? 'REPLIED' : 'DELIVERED')
      : (userReplied ? 'REPLIED' : 'RECEIVED');
    const hasReply = !isSent;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex items-center justify-between px-5 md:px-6 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${dividerColor}` }}
        >
          <button
            onClick={handleBackFromDetail}
            className="flex items-center gap-1 text-sm transition-colors active:opacity-70"
            style={{ color: textSecondary }}
          >
            <ArrowLeft size={14} strokeWidth={2} />
            {navHistory.length > 0 ? '返回' : '返回列表'}
          </button>
          <div
            className="text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1"
            style={{
              backgroundColor: isSent
                ? 'rgba(201, 168, 124, 0.12)'
                : userReplied
                  ? 'rgba(201, 168, 124, 0.12)'
                  : 'rgba(153, 153, 153, 0.12)',
              color: isSent || userReplied ? accent : textSecondary,
            }}
          >
            <Check size={12} strokeWidth={2} />
            {statusLabel}
            <span style={{ opacity: 0.5, marginLeft: 2 }}>· {statusBadge}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {originalLetter && (
            <div
              className="mx-auto w-full max-w-lg mb-3 rounded-xl px-4 py-3 cursor-pointer transition-all hover:opacity-90"
              style={{
                backgroundColor: isDark ? 'rgba(201, 168, 124, 0.06)' : 'rgba(201, 168, 124, 0.06)',
                borderLeft: `3px solid ${accent}`,
              }}
              onClick={handleOriginalRefClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOriginalRefClick(e as unknown as React.MouseEvent);
                }
              }}
            >
              <div className="text-xs mb-1 flex items-center gap-1" style={{ color: accent }}>
                {originalLetter.type === 'sent' ? '回复我的信' : '回复TA的信'}
                <span style={{ color: textSecondary }}>·</span>
                <span style={{ color: textSecondary }}>{formatLetterTime(originalLetter.timestamp)}</span>
              </div>
              <p
                className="text-sm line-clamp-2"
                style={{
                  color: textSecondary,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {originalLetter.content}
              </p>
            </div>
          )}

          {replyLetter && (
            <div
              className="mx-auto w-full max-w-lg mb-4 rounded-xl px-4 py-3 cursor-pointer transition-all hover:opacity-90"
              style={{
                backgroundColor: isDark ? 'rgba(201, 168, 124, 0.06)' : 'rgba(201, 168, 124, 0.06)',
                borderLeft: `3px solid ${accent}`,
              }}
              onClick={handleReplyRefClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleReplyRefClick(e as unknown as React.MouseEvent);
                }
              }}
            >
              <div className="text-xs mb-1 flex items-center gap-1" style={{ color: accent }}>
                {replyLetter.type === 'sent' ? '我的回复' : 'TA的回复'}
                <span style={{ color: textSecondary }}>·</span>
                <span style={{ color: textSecondary }}>{formatLetterTime(replyLetter.timestamp)}</span>
              </div>
              <p
                className="text-sm line-clamp-2"
                style={{
                  color: textSecondary,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {replyLetter.content}
              </p>
            </div>
          )}

          <div
            className="relative mx-auto w-full max-w-lg rounded-lg px-6 md:px-8 py-7 md:py-9"
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${dividerColor}`,
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
              style={{ backgroundColor: '#c9a87c' }}
            />
            <div
              className="absolute left-3 top-0 bottom-0 w-px"
              style={{ backgroundColor: 'rgba(201, 168, 124, 0.15)' }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${dividerColor} 31px, ${dividerColor} 32px)`,
                backgroundPosition: '0 38px',
              }}
            />

            <div className="relative pl-1">
              <div style={{ lineHeight: '32px', minHeight: 32 }}>
                <p
                  className="font-medium text-base"
                  style={{ color: textPrimary, lineHeight: '32px' }}
                >
                  {headerGreeting}
                </p>
                <p className="text-sm" style={{ color: textSecondary, lineHeight: '32px' }}>
                  {headerSub}
                </p>
              </div>
              <div
                className="mt-1 text-[15px] leading-8 whitespace-pre-wrap"
                style={{ color: textPrimary, lineHeight: '32px' }}
              >
                {letter.content}
              </div>
              <div
                className="mt-6 text-right"
                style={{ lineHeight: '28px' }}
              >
                <p className="text-xs" style={{ color: textSecondary }}>
                  {formatLetterDate(letter.timestamp)}
                </p>
                <p className="text-sm font-medium" style={{ color: accent }}>
                  {fromName}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 mb-2 flex flex-col items-center gap-2">
            {hasReply && (
              <button
                onClick={() => handleReply(letter)}
                className="flex items-center gap-1.5 text-sm font-medium px-5 py-2 rounded-full transition-opacity active:opacity-80"
                style={{
                  backgroundColor: accent,
                  color: '#fffbf0',
                }}
              >
                <Reply size={14} strokeWidth={2} />
                回复
              </button>
            )}
            <button
              onClick={(e) => handleDeleteLetter(e, letter)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{ color: textMuted }}
            >
              <Trash2 size={12} />
              删除这封信
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-2 md:px-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[92%] md:w-[min(650px,60vw)] h-[80vh] md:h-[min(70vh,550px)] flex flex-col overflow-hidden shadow-2xl"
        style={{
          backgroundColor: contentBg,
          borderRadius: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center justify-center pt-5 pb-6 md:pt-6 md:pb-7 px-6 flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #c9a87c 0%, #d4b896 100%)',
            borderRadius: '24px 24px 0 0',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/20 active:bg-white/30"
            style={{ color: '#fffbf0' }}
            aria-label="关闭"
          >
            <X size={18} strokeWidth={1.8} />
          </button>

          <Mail size={26} strokeWidth={1.5} style={{ color: '#fffbf0' }} />
          <h2
            className="mt-1.5 text-lg md:text-xl font-medium"
            style={{ color: '#fffbf0', fontFamily: 'serif' }}
          >
            信封投递
          </h2>
          <p
            className="mt-1 text-[10px] md:text-xs tracking-[0.3em] uppercase"
            style={{ color: 'rgba(255, 251, 240, 0.75)' }}
          >
            LETTERS · CORRESPONDENCE
          </p>

          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '20px solid transparent',
              borderRight: '20px solid transparent',
              borderTop: '14px solid #d4b896',
            }}
          />
        </div>

        {showCompose ? (
          <div className="flex-1 flex flex-col p-5 md:p-6 gap-4 overflow-hidden">
            <div
              className="text-sm font-medium flex items-center gap-2"
              style={{ color: textPrimary }}
            >
              <Feather size={16} style={{ color: accent }} />
              提笔写信
            </div>
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="写点什么给 TA..."
              rows={12}
              className="flex-1 w-full resize-none rounded-2xl px-4 py-3 text-[15px] outline-none border transition-colors focus:border-amber-400"
              style={{
                backgroundColor: cardBg,
                color: textPrimary,
                borderColor: dividerColor,
                caretColor: accent,
                lineHeight: '22px',
                whiteSpace: 'pre-wrap',
              }}
            />
            <div className="flex justify-between items-center gap-2">
              <button
                onClick={handleCloseCompose}
                className="h-10 px-5 rounded-full text-sm transition-colors active:opacity-70"
                style={{ color: textSecondary }}
              >
                取消
              </button>
              <button
                onClick={handleSendLetter}
                disabled={!composeText.trim() || sending}
                className="h-10 px-5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-opacity active:opacity-80 disabled:opacity-40"
                style={{
                  backgroundColor: accent,
                  color: '#fffbf0',
                }}
              >
                <Send size={14} strokeWidth={2} />
                发送
              </button>
            </div>
          </div>
        ) : detailLetter ? (
          renderLetterDetail(detailLetter)
        ) : (
          <>
            <div
              className="flex items-center justify-center gap-2 px-4 py-3 flex-shrink-0 overflow-x-auto"
              style={{ borderBottom: `1px solid ${dividerColor}` }}
            >
              {TAB_ITEMS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = unreadForTab(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                       setActiveTab(tab.key);
                       setDetailLetter(null);
                       setOriginalLetter(null);
                       setReplyLetter(null);
                       setNavHistory([]);
                     }}
                    className="relative flex items-center gap-1.5 h-9 px-4 rounded-full text-xs md:text-sm whitespace-nowrap transition-all"
                    style={{
                      backgroundColor: isActive ? 'rgba(201, 168, 124, 0.15)' : tabInactiveBg,
                      color: isActive ? '#b8895a' : textSecondary,
                      border: isActive ? '1px solid #c9a87c' : '1px solid transparent',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-medium"
                        style={{ backgroundColor: '#e74c3c', color: '#fff' }}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

             <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3">
              {letters.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-6">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: isDark ? 'rgba(201, 168, 124, 0.1)' : 'rgba(201, 168, 124, 0.08)' }}
                  >
                    <Mail size={28} strokeWidth={1.5} style={{ color: accent }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: textPrimary }}>
                    {EMPTY_TEXT[activeTab].title}
                  </p>
                  <p className="text-xs mt-1.5" style={{ color: textSecondary }}>
                    {EMPTY_TEXT[activeTab].desc}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {letters.map((letter) => {
                    const isSent = letter.type === 'sent';
                    const isReceived = letter.type === 'received';
                    const isSpaceTime = letter.type === 'space_time';
                    const senderLabel = isSent
                      ? '我'
                      : isSpaceTime
                        ? `${taName}（时空来信）`
                        : `${taName}的来信`;
                    const replyPrefix = isReceived && letter.replyTo
                      ? '回复：'
                      : '';
                    const previewText = replyPrefix + getFirstLine(letter.content, 50);
                    const hasReplied = isSent && repliedMap[letter.id];
    const userReplied = !isSent && userRepliedMap[letter.id];

                    return (
                      <button
                        key={letter.id}
                        onClick={() => handleLetterClick(letter, true)}
                        className="w-full text-left rounded-xl px-3.5 py-2.5 transition-all active:opacity-80"
                        style={{
                          backgroundColor: cardBg,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                            {!letter.read && (
                              <span
                                className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: '#e74c3c' }}
                              />
                            )}
                            <span
                              className="text-[11px] font-medium truncate"
                              style={{ color: isSent ? accent : textPrimary }}
                            >
                              {senderLabel}
                            </span>
                          </div>
                          <span
                            className="text-[10px] flex-shrink-0"
                            style={{ color: textSecondary }}
                          >
                            {formatLetterTime(letter.timestamp)}
                          </span>
                        </div>
                        <div
                          className="mt-1 text-[12px] truncate"
                          style={{
                            color: textSecondary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {previewText}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1">
                            {isSent && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] flex-shrink-0"
                                style={{ color: hasReplied ? accent : textMuted }}
                              >
                                {hasReplied ? (
                                  <>
                                    <Check size={10} strokeWidth={2} />
                                    已回复
                                  </>
                                ) : (
                                  <>
                                    <Check size={10} strokeWidth={2} />
                                    已送达
                                  </>
                                )}
                              </span>
                            )}
                            {userReplied && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] flex-shrink-0"
                                style={{ color: accent }}
                              >
                                <Check size={10} strokeWidth={2} />
                                已回复
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => handleDeleteLetter(e, letter)}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-red-50 active:bg-red-100"
                            style={{ color: textMuted }}
                            aria-label="删除"
                          >
                            <X size={12} strokeWidth={1.8} />
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderTop: `1px solid ${dividerColor}` }}
            >
              <button
                onClick={handleOpenCompose}
                className="h-10 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-opacity active:opacity-80"
                style={{
                  backgroundColor: accent,
                  color: '#fffbf0',
                }}
              >
                <Feather size={14} strokeWidth={2} />
                提笔写信
              </button>
              <button
                onClick={onClose}
                className="h-10 px-4 rounded-full text-sm transition-colors active:opacity-70"
                style={{ color: textSecondary }}
              >
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { MailboxDialog };
