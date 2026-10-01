import React, { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Send,
  Plus,
  Settings,
  Check,
  Mail,
  ClipboardList,
  List,
  Home,
  MoreHorizontal,
  Moon,
  Sun,
  Smile,
  X,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { playSound, initAudioContext } from '@client/src/utils/sound-manager';
import { useChatMessages, useReplyCards, useBlockedCards, useProfile, useCategories, useChatConfig, useRhythmConfig, useEmojiLib, useStickerLib, DEFAULT_TA_AVATAR, DEFAULT_MY_AVATAR, useTaStatuses, useMyStatus, useTopMottos, usePatPats, useUserPatActions } from '@client/src/hooks/use-local-storage';
import { DEFAULT_TYPING_TEXT } from '@client/src/utils/local-storage';
import { useTaProactive } from '@client/src/hooks/use-ta-proactive';
import { usePendingReply } from '@client/src/hooks/use-pending-reply';
import { useTheme } from '@client/src/hooks/use-theme';
import { EMOJI_POOL } from '@client/src/utils/local-storage';
import type { ChatMessage, ReplyCard } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { EmojiPanel } from './EmojiPanel';
import { PatDecorDialog } from './PatDecorDialog';
import { useNewMessageToastStore } from '@client/src/stores/new-message-toast-store';
import { usePendingReplyStore } from '@client/src/stores/pending-reply-store';
import { useCallStore } from '@client/src/stores/call-store';
import { MailboxDialog } from '@client/src/components/Mailbox/MailboxDialog';
import { QuestionnaireDialog } from '@client/src/components/Questionnaire/QuestionnaireDialog';
import { QuestionnaireMessage } from '@client/src/components/Questionnaire/QuestionnaireMessage';
import { getUnreadCount, addLetter } from '@client/src/utils/letter-storage';
import {
  generateLetterContent,
  getLastDailyLetterDate,
  setLastDailyLetterDate,
  getPendingLetterReplies,
  removePendingLetterReply,
  type PendingLetterReply,
  getQuestionnaireById,
  getPendingQuestionnaireReplies,
  removePendingQuestionnaireReply,
  updateQuestionnaire,
  generateQuestionnaireReplies,
  type Questionnaire,
} from '@client/src/utils/local-storage';

const ThemeToggleButton = () => {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-11 h-11 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
      style={{ color: 'var(--chat-icon-active)' }}
      aria-label={isDark ? '切换为白天模式' : '切换为黑夜模式'}
    >
      {isDark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
    </button>
  );
};

const ChatPage = () => {
  const mountStart = performance.now();
  // eslint-disable-next-line no-console
  logger.info('[Perf] ChatPage mount start');
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, loading: messagesLoading, addUserMessage, addTaReply, appendTaMessage, addPatMessage, addSystemMessage, markMessagesRead, deleteMessageById, recallMessage } = useChatMessages();
  const { cards, addCard, getRandomCards, getCardsByIds } = useReplyCards();
  const { blockedIds } = useBlockedCards();
  const { profile, taAvatarUrl, myAvatarUrl, chatBgStyle, chatBgImage, updateProfile } = useProfile();
  const { categories } = useCategories();
  const { config, updateConfig } = useChatConfig();
  const { config: rhythm } = useRhythmConfig();
  const { emojis } = useEmojiLib();
  const { stickers, addSticker, removeSticker } = useStickerLib();
  const { current: taStatus, refresh: refreshTaStatus } = useTaStatuses();
  const { displayText: myStatus, setCustom: setMyStatus } = useMyStatus();
  const { items: topMottos } = useTopMottos();
  const { items: patItems } = usePatPats();
  const { items: userPatItems, addBatch: addBatchUserPat, remove: deleteUserPat } = useUserPatActions();
  const [topMotto, setTopMotto] = useState('CARPE DIEM');
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const replyTimeoutRef = useRef<number | null>(null);
  const incomingCallTimerRef = useRef<number | null>(null);
  const nudgeCooldownRef = useRef<number>(0);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);

  const [input, setInput] = useState('');
  const [showPatDecor, setShowPatDecor] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardContent, setNewCardContent] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState<ChatMessage | null>(null);
  const [showNewMsgTip, setShowNewMsgTip] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const newMsgCountRef = useRef(0);
  const prevMsgCountRef = useRef(0);
  const firstRenderRef = useRef(true);
  const [showActionSheet, setShowActionSheet] = useState<ChatMessage | null>(null);
  const [showTypingSettings, setShowTypingSettings] = useState(false);
  const [tempTypingAvatar, setTempTypingAvatar] = useState(true);
  const [tempTypingText, setTempTypingText] = useState(DEFAULT_TYPING_TEXT);
  const [editingMyStatus, setEditingMyStatus] = useState(false);
  const [myStatusInput, setMyStatusInput] = useState('');
  const [expandedRecallId, setExpandedRecallId] = useState<string | null>(null);
  const [showMailbox, setShowMailbox] = useState(false);
   const [showQuestionnaire, setShowQuestionnaire] = useState(false);
   const [qnReplyTick, setQnReplyTick] = useState(0);
  const [unreadLetters, setUnreadLetters] = useState(0);
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardTextareaRef = useRef<HTMLTextAreaElement>(null);
  const myStatusInputRef = useRef<HTMLInputElement>(null);
  const autoScrollingRef = useRef(false);
  const [diagMinimalMode, setDiagMinimalMode] = useState(false);

  const VISIBLE_BATCH = 100;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [visibleCount, setVisibleCount] = useState(diagMinimalMode ? 10 : VISIBLE_BATCH);
  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleCount) return messages;
    return messages.slice(messages.length - visibleCount);
  }, [messages, visibleCount]);
  const visibleOffset = messages.length > visibleCount ? messages.length - visibleCount : 0;

  const getMinuteKey = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getHours()}:${date.getMinutes()}`;
  };

  const messageGroupInfo = useMemo(() => {
    const list = visibleMessages;
    const len = list.length;
    const info = new Array<{
      isFirst: boolean;
      isLast: boolean;
      showAvatar: boolean;
      showTime: boolean;
    }>(len);
    let lastEffective = -1;
    let lastTimeBySender: Record<string, { index: number; minuteKey: string }> = {};
    for (let i = 0; i < len; i++) {
      const msg = list[i];
      const isSystem = msg.sender === 'system' || msg.type === 'system' || msg.type === 'pat';
      const isEffective = !isSystem && !msg.isRecalled;
      const prevSender = lastEffective >= 0 ? list[lastEffective].sender : null;
      const minuteKey = getMinuteKey(msg.createdAt);
      info[i] = {
        isFirst: !prevSender || prevSender !== msg.sender,
        isLast: true,
        showAvatar: isEffective && (!prevSender || prevSender !== msg.sender),
        showTime: isEffective,
      };
      if (lastEffective >= 0 && isEffective && list[lastEffective].sender === msg.sender) {
        info[lastEffective].isLast = false;
      }
      if (isEffective) {
        const prev = lastTimeBySender[msg.sender];
        if (prev && prev.minuteKey === minuteKey) {
          info[prev.index].showTime = false;
        }
        lastTimeBySender[msg.sender] = { index: i, minuteKey };
      }
      if (isEffective) lastEffective = i;
    }
    return info;
  }, [visibleMessages]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    autoScrollingRef.current = true;
    el.scrollTop = el.scrollHeight;
    setIsAtBottom(true);
    requestAnimationFrame(() => {
      autoScrollingRef.current = false;
    });
    logger.info('[scroll-deep] scrollToBottom called');
  }, []);

  const handleStickerLoad = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    logger.info(`[scroll-deep] handleStickerLoad: distanceFromBottom=${distanceFromBottom.toFixed(1)}, isAtBottom=${isAtBottom}`);
    if (distanceFromBottom < 50 || isAtBottom) {
      autoScrollingRef.current = true;
      el.scrollTop = el.scrollHeight;
      setIsAtBottom(true);
      requestAnimationFrame(() => {
        autoScrollingRef.current = false;
      });
      logger.info('[scroll-deep] handleStickerLoad: scrolled to bottom');
    }
  }, [isAtBottom]);

  const scrollToNewMsg = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    autoScrollingRef.current = true;
    el.scrollTop = el.scrollHeight;
    setIsAtBottom(true);
    setShowNewMsgTip(false);
    setNewMsgCount(0);
    newMsgCountRef.current = 0;
    requestAnimationFrame(() => {
      autoScrollingRef.current = false;
    });
    logger.info('[scroll-deep] scrollToNewMsg: user clicked new msg tip, scrolled to bottom');
  }, []);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      autoScrollingRef.current = true;
      el.scrollTop = el.scrollHeight;
      setIsAtBottom(true);
      requestAnimationFrame(() => {
        autoScrollingRef.current = false;
      });
    }
  }, [location.key]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 50;

    if (autoScrollingRef.current) {
      setIsAtBottom(atBottom);
      if (atBottom && showNewMsgTip) {
        setShowNewMsgTip(false);
        setNewMsgCount(0);
        newMsgCountRef.current = 0;
      }
      return;
    }

    setIsAtBottom(atBottom);
    if (atBottom && showNewMsgTip) {
      setShowNewMsgTip(false);
      setNewMsgCount(0);
      newMsgCountRef.current = 0;
    }
    logger.info(`[scroll-deep] handleScroll: scrollTop=${el.scrollTop.toFixed(0)}, distanceFromBottom=${distanceFromBottom.toFixed(1)}, isAtBottom=${atBottom}`);
    if (el.scrollTop < 100 && messages.length > visibleCount) {
      const oldHeight = el.scrollHeight;
      const oldScrollTop = el.scrollTop;
      setVisibleCount((prev) => Math.min(prev + VISIBLE_BATCH, messages.length));
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const newHeight = scrollContainerRef.current.scrollHeight;
          scrollContainerRef.current.scrollTop = oldScrollTop + (newHeight - oldHeight);
        }
      });
    }
  }, [messages.length, visibleCount, showNewMsgTip]);

  const handleQuoteClick = useCallback((quoteId: string | null | undefined) => {
    if (!quoteId) return;
    logger.info(`[quote-debug] 点击引用跳转，quoteId=${quoteId}`);
    const targetIdx = messages.findIndex((m: ChatMessage) => m.id === quoteId);
    if (targetIdx < 0) {
      logger.warn(`[quote-debug] 未找到被引用消息，quoteId=${quoteId}`);
      return;
    }
    const startIdx = messages.length - visibleCount;
    const scrollEl = scrollContainerRef.current;
    const scrollAndHighlight = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const msgEl = el.querySelector(`[data-msg-id="${quoteId}"]`) as HTMLElement | null;
      if (!msgEl) return;
      const targetTop = msgEl.offsetTop - el.clientHeight * 0.3;
      el.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      setHighlightMsgId(quoteId);
      setTimeout(() => setHighlightMsgId(null), 3000);
    };
    if (targetIdx >= startIdx) {
      scrollAndHighlight();
    } else {
      const neededIdx = targetIdx + VISIBLE_BATCH;
      const newCount = Math.min(messages.length - targetIdx + VISIBLE_BATCH, messages.length);
      if (scrollEl) {
        const oldHeight = scrollEl.scrollHeight;
        setVisibleCount(newCount);
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop += newHeight - oldHeight;
            requestAnimationFrame(() => { scrollAndHighlight(); });
          }
        });
      }
    }
  }, [messages, visibleCount]);

  useEffect(() => {
    const prevCount = prevMsgCountRef.current;
    const currCount = messages.length;
    const delta = currCount - prevCount;
    logger.info(`[scroll-deep] messages useEffect: prevCount=${prevCount}, currCount=${currCount}, delta=${delta}, isAtBottom=${isAtBottom}`);
    if (delta > 0) {
      let taMsgCount = 0;
      let taPatCount = 0;
      let lastNewContent = '';
      for (let i = prevCount; i < currCount; i++) {
        const msg = messages[i];
        if (i === currCount - 1) lastNewContent = msg?.content?.slice(0, 30) || '';
        if (msg?.sender === 'ta') {
          if (msg.type === 'pat') {
            taPatCount += 1;
          } else {
            taMsgCount += 1;
          }
        }
      }
      logger.info(`[scroll-deep] new messages: taMsg=${taMsgCount}, taPat=${taPatCount}, lastContent="${lastNewContent}"`);
      if ((taMsgCount > 0 || taPatCount > 0) && !firstRenderRef.current) {
        initAudioContext();
        if (taMsgCount > 0) playSound('ta_send');
        if (taPatCount > 0) playSound('ta_pat');
        const total = taMsgCount + taPatCount;
        if (!isAtBottom) {
          newMsgCountRef.current += total;
          setNewMsgCount(newMsgCountRef.current);
          setShowNewMsgTip(true);
          logger.info(`[scroll-deep] showing new message tip: total=${total}, newMsgCount=${newMsgCountRef.current}`);
        }
      }
    }
    firstRenderRef.current = false;
    prevMsgCountRef.current = currCount;
    const shouldAutoScroll = isAtBottom;
    logger.info(`[scroll-deep] auto-scroll check: shouldAutoScroll=${shouldAutoScroll} (isAtBottom=${isAtBottom})`);
    if (shouldAutoScroll && delta > 0) {
      const el = scrollContainerRef.current;
      if (el) {
        autoScrollingRef.current = true;
        el.scrollTop = el.scrollHeight;
        setIsAtBottom(true);
        requestAnimationFrame(() => {
          autoScrollingRef.current = false;
        });
        logger.info(`[scroll-deep] auto-scroll executed: scrollTop=${el.scrollTop}, scrollHeight=${el.scrollHeight}`);
      }
    }
  }, [messages, isAtBottom]);

  useLayoutEffect(() => {
    const t = performance.now();
    // eslint-disable-next-line no-console
    logger.info('[Perf] ChatPage first paint:', { arg0: t - mountStart, arg1: 'ms, messages count:', arg2: messages.length, arg3: ', rendered:', arg4: visibleMessages.length });
  }, [visibleMessages.length]);

  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  };

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxHeight = 5 * 22;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, []);

  const showNotification = useCallback((body: string) => {
    if (!rhythm.backgroundPushEnabled) return;
    if (typeof document !== 'undefined' && !document.hidden) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const title = profile.taName || 'TA';
    const truncated = body.length > 50 ? body.slice(0, 50) + '...' : body;
    try {
      const n = new Notification(title, { body: truncated, silent: false });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      logger.warn('通知发送失败', String(e));
    }
  }, [rhythm.backgroundPushEnabled, profile.taName]);

  const sendOneTaMessage = useCallback(async (card: ReplyCard, quoteTo?: string | null, quoteContent?: string | null, quoteSender?: 'me' | 'ta' | null, messageId?: string, stickerUrl?: string | null, emojis?: string[] | null): Promise<{ createdAt: string; id?: string }> => {
    const finalContent = stickerUrl ? '' : card.content;
    const msg = await appendTaMessage(finalContent, card.id || null, quoteTo, quoteContent, quoteSender, messageId, stickerUrl, emojis);
    if (stickerUrl) {
      showNotification('[图片]');
    } else {
      showNotification(finalContent);
    }
    if (msg && msg.id) {
      useNewMessageToastStore.getState().pushMessage({
        id: msg.id,
        content: finalContent,
        sender: 'ta',
        createdAt: msg.createdAt,
        stickerUrl: stickerUrl || null,
        emojis: emojis || null,
      });
    }
    if (msg) return { createdAt: msg.createdAt, id: msg.id };
    return { createdAt: new Date().toISOString() };
  }, [appendTaMessage, showNotification]);

  const getCardsByIdsForPending = useCallback((ids: string[]): ReplyCard[] => {
    return getCardsByIds(ids);
  }, [getCardsByIds]);

  const patDecorMine = config.patDecor?.mine ?? '';
  const patDecorTheirs = config.patDecor?.theirs ?? '♡';

  const wrapPatDecor = (text: string, side: 'mine' | 'theirs'): string => {
    const decor = side === 'mine' ? patDecorMine : patDecorTheirs;
    if (!decor) return text;
    return `${decor} ${text} ${decor}`;
  };

  const sendTaPatMessage = useCallback(async (content: string) => {
    const msg = await addPatMessage(wrapPatDecor(content, 'theirs'));
    if (msg && msg.id) {
      useNewMessageToastStore.getState().pushMessage({
        id: msg.id,
        content: msg.content,
        sender: 'ta',
        createdAt: msg.createdAt,
        stickerUrl: null,
        emojis: null,
      });
    }
    return msg;
  }, [addPatMessage, patDecorTheirs]);

  const { isTyping, setIsTyping, incTyping, decTyping, startPending, cancelPending, setForceConcat } = usePendingReply({
     typingIndicator: config.typingIndicator,
     readReceipt: config.readReceipt,
     patPatEnabled: rhythm.patPatEnabled,
    patPatFrequency: rhythm.patPatFrequency,
    taName: profile.taName || 'TA',
    concatEnabled: rhythm.concatEnabled,
    concatProbability: rhythm.concatProbability,
    concatMaxSentences: rhythm.concatMaxSentences,
    emojiReplyProbability: rhythm.emojiReplyProbability,
    stickerReplyProbability: rhythm.stickerReplyProbability,
    quoteReplyEnabled: config.quoteReply,
    quoteReplyProbability: rhythm.quoteReplyProbability,
     recallProbability: rhythm.recallProbability,
     minReplyCount: rhythm.minReplyCount,
     maxReplyCount: rhythm.maxReplyCount,
     replyMinSeconds: rhythm.replyMinSeconds,
     replyMaxSeconds: rhythm.replyMaxSeconds,
     getReplyCardsByIds: getCardsByIdsForPending,
    sendOneMessage: sendOneTaMessage,
    sendPatMessage: sendTaPatMessage,
    markRead: (time: string) => { void markMessagesRead(time); },
     getEmojis: () => emojis,
     getStickers: () => stickers,
     getRandomCards: (count, cat) => getRandomCards(count, cat),
     recallMessage: recallMessage,
   });

  useEffect(() => {
    if (!isAtBottom) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    logger.info(`[scroll-deep] isTyping changed to ${isTyping}, re-scroll to bottom because isAtBottom=true`);
    autoScrollingRef.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      autoScrollingRef.current = false;
    });
  }, [isTyping, isAtBottom]);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  useEffect(() => {
    if (topMottos.length === 0) return;
    const today = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
    }
    const idx = hash % topMottos.length;
    setTopMotto(topMottos[idx].content);
  }, [topMottos]);

  const refreshUnreadLetters = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadLetters(count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshUnreadLetters();

    const today = new Date().toDateString();
    const lastDate = getLastDailyLetterDate();
    if (lastDate !== today) {
      const letterContent = generateLetterContent(5, 15);
      if (letterContent) {
        void addLetter({
          type: 'space_time',
          content: letterContent,
          timestamp: Date.now(),
          read: false,
        }).then(() => {
          setLastDailyLetterDate(today);
          void refreshUnreadLetters();
          void addSystemMessage('你收到一封来自 TA 的时空来信 ✉️');
        }).catch(() => { /* ignore */ });
      }
    }

    const pendingList = getPendingLetterReplies();
    logger.info(`[letter-reply] 聊天页加载待回复任务 count=${pendingList.length}`);
    const timers: number[] = [];
    const now = Date.now();
    for (const task of pendingList) {
      if (!task.willReply) {
        if (now >= task.scheduledAt) {
          removePendingLetterReply(task.id);
        }
        continue;
      }
      const delay = Math.max(0, task.scheduledAt - now);
      const timer = window.setTimeout(async () => {
        try {
          const content = generateLetterContent(5, 15);
          if (content) {
            await addLetter({
              type: 'received',
              content,
              timestamp: Date.now(),
              read: false,
              replyTo: task.replyToId,
            });
            void refreshUnreadLetters();
            void addSystemMessage('你收到一封来自 TA 的回信 ✉️');
            logger.info(`[letter-reply] 聊天页回信完成 taskId=${task.id}`);
          }
        } catch (err) {
          logger.error('[letter-reply] 聊天页回信失败', err);
        } finally {
          removePendingLetterReply(task.id);
        }
      }, delay);
      timers.push(timer);
    }

    const interval = window.setInterval(() => {
      void refreshUnreadLetters();
    }, 30000);

    return () => {
       timers.forEach((t) => clearTimeout(t));
       window.clearInterval(interval);
     };
   }, [refreshUnreadLetters, addSystemMessage, appendTaMessage]);

  const qnTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
     const pendingList = getPendingQuestionnaireReplies();
     logger.info(`[survey-reply] 扫描待回复问卷 count=${pendingList.length} tick=${qnReplyTick}`);
     const now = Date.now();
     const activeIds = new Set<string>();

     for (const task of pendingList) {
       if (!task.willReply) {
         if (now >= task.scheduledAt) {
           logger.info(`[survey-reply] 清理不回复的过期任务 taskId=${task.id}`);
           removePendingQuestionnaireReply(task.id);
         }
         continue;
       }
       activeIds.add(task.id);
       if (qnTimersRef.current[task.id]) continue;

       const delay = Math.max(0, task.scheduledAt - now);
       logger.info(`[survey-reply] 调度问卷回复 taskId=${task.id} qid=${task.questionnaireId} delayMs=${delay}`);
       const timer = window.setTimeout(async () => {
         logger.info(`[survey-reply] 定时器触发，执行回复 taskId=${task.id}`);
         const q = getQuestionnaireById(task.questionnaireId);
         if (!q) {
           logger.warn(`[survey-reply] 问卷不存在，移除任务 taskId=${task.id}`);
           removePendingQuestionnaireReply(task.id);
           delete qnTimersRef.current[task.id];
           return;
         }
         try {
           const replies = generateQuestionnaireReplies(q.questions);
           logger.info(`[survey-reply] 生成回复 qid=${task.questionnaireId} questions=${q.questions.length}`);
           updateQuestionnaire(task.questionnaireId, {
             status: 'replied',
             repliedAt: Date.now(),
             replies,
           });
           void appendTaMessage(`[QUESTIONNAIRE_REPLY:${task.questionnaireId}]`, null, null, null, null);
           logger.info(`[survey-reply] 问卷回复完成 qid=${task.questionnaireId}`);
         } catch (err) {
           logger.error('[survey-reply] 问卷回复失败', err);
         } finally {
           removePendingQuestionnaireReply(task.id);
           delete qnTimersRef.current[task.id];
         }
       }, delay);
       qnTimersRef.current[task.id] = timer;
     }

     for (const existId of Object.keys(qnTimersRef.current)) {
       if (!activeIds.has(existId)) {
         clearTimeout(qnTimersRef.current[existId]);
         delete qnTimersRef.current[existId];
       }
     }
  }, [qnReplyTick, appendTaMessage]);

  const handleLetterArrived = useCallback(() => {
    void refreshUnreadLetters();
  }, [refreshUnreadLetters]);

  const determineReplyCards = useCallback((): ReplyCard[] => {
    const available = cards.filter((c) => !blockedIds.includes(c.id));
    const count = Math.min(20, available.length);
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, count);
    logger.info(`[concat-deep] determineReplyCards: totalCards=${cards.length}, blocked=${blockedIds.length}, available=${available.length}, returning=${count} cards`);
    logger.info(`[concat-deep] determineReplyCards ids: [${shuffled.slice(0, 5).map((c) => c.id).join(', ')}${shuffled.length > 5 ? '...' : ''}]`);
    if (available.length === 0) return [];
    return shuffled;
  }, [cards, blockedIds]);

  const sendOneForProactive = useCallback((card: ReplyCard, messageId?: string): Promise<{ createdAt: string }> => {
    return sendOneTaMessage(card, undefined, undefined, undefined, messageId);
  }, [sendOneTaMessage]);

  const hasActiveJob = usePendingReplyStore((s) => s.hasActiveJob);

  const triggerIncomingCall = useCallback(() => {
    const availableCards = cards.filter((c) => !blockedIds.includes(c.id));
    const cardCount = availableCards.length === 0 ? 0 : availableCards.length === 1 ? 1 : 1 + Math.floor(Math.random() * 2);
    const pickedCards = cardCount > 0
      ? [...availableCards].sort(() => Math.random() - 0.5).slice(0, cardCount)
      : [];

    const emojiProb = rhythm.emojiReplyProbability / 100;
    const incomingCards = pickedCards.map((card) => {
      let cardEmojis: string[] = [];
      if (emojiProb > 0 && emojis.length > 0 && Math.random() < emojiProb) {
        const count = 1 + Math.floor(Math.random() * 2);
        const picked: string[] = [];
        for (let i = 0; i < count; i++) {
          picked.push(emojis[Math.floor(Math.random() * emojis.length)]);
        }
        cardEmojis = picked;
      }
      return { content: card.content, emojis: cardEmojis };
    });

    logger.info(`[call-debug] triggerIncomingCall: taName=${profile.taName || 'TA'}, taAvatarUrl=${taAvatarUrl ? 'present' : 'empty'}, cardsLen=${incomingCards.length}`);
    const { startIncoming } = useCallStore.getState();
    startIncoming(
      profile.taName || 'TA',
      taAvatarUrl || DEFAULT_TA_AVATAR,
      incomingCards,
      () => addSystemMessage('📞 未接来电'),
    );
  }, [cards, blockedIds, rhythm.emojiReplyProbability, emojis, profile.taName, taAvatarUrl, addSystemMessage]);

  const { setReplying } = useTaProactive({
    rhythm,
    typingIndicator: config.typingIndicator,
    readReceipt: config.readReceipt,
    taName: profile.taName || 'TA',
    taAvatarUrl,
    getRandomCards,
    sendOneTaMessage: sendOneForProactive,
    sendPatMessage: sendTaPatMessage,
    markMessagesRead,
    incTyping,
    decTyping,
    triggerIncomingCall,
  });

  useEffect(() => {
    setReplying(hasActiveJob);
  }, [hasActiveJob, setReplying]);

  const handleStartCall = useCallback(() => {
    const { startCalling } = useCallStore.getState();
    startCalling(
      profile.taName || 'TA',
      taAvatarUrl,
      undefined,
      () => addSystemMessage('📞 TA 未接听'),
    );
  }, [profile.taName, taAvatarUrl, addSystemMessage]);

  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current) {
        clearTimeout(replyTimeoutRef.current);
      }
      if (incomingCallTimerRef.current) {
        clearTimeout(incomingCallTimerRef.current);
      }
    };
  }, []);

  const handleSend = useCallback(() => {
    const tClick = typeof performance !== 'undefined' ? performance.now() : 0;
    const content = input.trim();
    logger.info(`[send-click-perf] click received, t=${tClick.toFixed(1)}ms, contentLen=${content.length}`);
    logger.info(`[send-perf-deep] 1. click received: 0ms`);
    if (!content) {
      logger.info('[send-click-perf] empty content, abort');
      return;
    }

    setShowEmojiPanel(false);

    if (typeof performance !== 'undefined') {
      performance.mark('send-start');
    }

    // 立即清空输入框（DOM 操作，不等 React 渲染，用户感知最快）
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
    setInput('');

    const quoteTo = quoteMsg ? quoteMsg.id : null;
    const quoteContent = quoteMsg ? quoteMsg.content : null;
    const quoteSender = quoteMsg && quoteMsg.sender !== 'system' ? quoteMsg.sender as 'me' | 'ta' : null;
    logger.info(`[quote-debug] 发送文字消息，携带引用: quoteTo=${!!quoteTo}，quoteSender=${quoteSender}，contentLen=${quoteContent?.length || 0}`);
    setQuoteMsg(null);
    setIsAtBottom(true);
    logger.info(`[send-perf-deep] 2. state setters + DOM clear: ${(performance.now() - tClick).toFixed(1)}ms`);

    try {
      // 同步：乐观更新 UI，立即返回消息对象（IDB 写入在后台异步进行）
      const userMsg = addUserMessage(content, quoteTo, quoteContent, quoteSender);
      logger.info(`[send-perf-deep] 3. addUserMessage (optimistic): ${(performance.now() - tClick).toFixed(1)}ms`);

      const doScroll = () => {
        const el = scrollContainerRef.current;
        if (el) {
          autoScrollingRef.current = true;
          el.scrollTop = el.scrollHeight;
          requestAnimationFrame(() => {
            autoScrollingRef.current = false;
          });
        }
      };

      const doFocus = (label: string) => {
        const ta = textareaRef.current;
        if (!ta) {
          logger.info(`[focus-debug] ${label}: textareaRef is null`);
          return;
        }
        if (ta.disabled) {
          logger.info(`[focus-debug] ${label}: textarea is disabled, skip focus`);
          return;
        }
        ta.focus();
      };

      doFocus('sync');
      doScroll();
      logger.info(`[send-perf-deep] 4. sync focus+scroll done: ${(performance.now() - tClick).toFixed(1)}ms`);

      // 测量 React 渲染完成时间（第 1 帧、第 2 帧）
      requestAnimationFrame(() => {
        doScroll();
        doFocus('rAF-1');
        logger.info(`[send-perf-deep] 5. frame 1 (after render): ${(performance.now() - tClick).toFixed(1)}ms`);
        requestAnimationFrame(() => {
          doFocus('rAF-2');
          logger.info(`[send-perf-deep] 6. frame 2 (fully painted): ${(performance.now() - tClick).toFixed(1)}ms`);
        });
      });

      setTimeout(() => {
        doFocus('timeout-0');
      }, 0);

      // 后续操作：音效、字卡抽取、回复调度 —— 不等 IDB 写入，直接在微任务中开始
      // 使用 setTimeout 推到宏任务，让浏览器先完成当前帧渲染
      setTimeout(() => {
        const tAsyncStart = performance.now();
        logger.info(`[send-perf-deep] 7. async path start (post-render): ${(tAsyncStart - tClick).toFixed(1)}ms`);
        try {
          initAudioContext();
          playSound('me_send');

          const willReply = !(config.readWithoutReply && config.readReceipt && Math.random() < config.readWithoutReplyRate / 100);
          if (willReply) setReplying(true);
          const minSec = Math.max(1, rhythm.replyMinSeconds);
          const maxSec = Math.max(minSec, rhythm.replyMaxSeconds);
          const delayMs = (minSec + Math.random() * (maxSec - minSec)) * 1000;

          const t0 = performance.now();
          const replyCards = willReply ? determineReplyCards() : [];
          const t1 = performance.now();
          logger.info(`[send-click-perf] determineReplyCards took ${(t1 - t0).toFixed(1)}ms`);

          const taQuoteTo: string | null = null;
          const taQuoteContent: string | null = null;
          const taQuoteSender: 'me' | 'ta' | null = null;

          if (content === '测试拼接') {
            setForceConcat(true);
          }

          startPending(
              userMsg.id,
              userMsg.content,
              willReply,
              delayMs,
              replyCards,
              taQuoteTo,
              taQuoteContent,
              taQuoteSender,
            );
          logger.info(`[send-perf-deep] 8. startPending called: ${(performance.now() - tClick).toFixed(1)}ms`);

          if (willReply && Math.random() < rhythm.incomingCallProbability / 100) {
            const ta = profile.taName || 'TA';
            const avatar = taAvatarUrl || DEFAULT_TA_AVATAR;
            const available = cards.filter((c) => !blockedIds.includes(c.id));
            const cardCount = available.length === 0 ? 0 : available.length === 1 ? 1 : 1 + Math.floor(Math.random() * 2);
            const picked = cardCount > 0
              ? [...available].sort(() => Math.random() - 0.5).slice(0, cardCount)
              : [];
            const emojiProb = rhythm.emojiReplyProbability / 100;
            const incCards = picked.map((card) => {
              let cardEmojis: string[] = [];
              if (emojiProb > 0 && emojis.length > 0 && Math.random() < emojiProb) {
                const count = 1 + Math.floor(Math.random() * 2);
                const pickedEmojis: string[] = [];
                for (let i = 0; i < count; i++) {
                  pickedEmojis.push(emojis[Math.floor(Math.random() * emojis.length)]);
                }
                cardEmojis = pickedEmojis;
              }
              return { content: card.content, emojis: cardEmojis };
            });
            const timeoutId = window.setTimeout(() => {
              logger.info(`[call-debug] handleSend incoming call timer fired, taName=${ta}, cardsLen=${incCards.length}`);
              const store = useCallStore.getState();
              if (store.mode !== 'none') {
                logger.info(`[call-debug] handleSend incoming call skipped: mode is ${store.mode}`);
                return;
              }
              store.startIncoming(ta, avatar, incCards, () => {
                addSystemMessage('📞 未接来电');
              });
            }, delayMs + 1000);
            incomingCallTimerRef.current = timeoutId;
          }

          logger.info(`[send-perf-deep] 9. handleSend sync+async fully done: ${(performance.now() - tClick).toFixed(1)}ms (IDB continues in background)`);
          logger.info(`[send-click-perf] handleSend fully done, total=${(performance.now() - tClick).toFixed(1)}ms`);
          if (typeof performance !== 'undefined') {
            performance.mark('send-end');
            performance.measure('handleSend-total', 'send-start', 'send-end');
          }
        } catch (err) {
          logger.error('[send-perf-deep] handleSend async path error', err);
          logger.error('[send-click-perf] handleSend async part error', err);
        }
      }, 0);

    } catch (err) {
      logger.error('[send-click-perf] 发送消息失败', err);
      textareaRef.current?.focus();
    }
  }, [input, quoteMsg, addUserMessage, config.quoteReply, config.readReceipt, config.readWithoutReply, config.readWithoutReplyRate, config.typingIndicator, rhythm.replyMinSeconds, rhythm.replyMaxSeconds, rhythm.incomingCallProbability, determineReplyCards, startPending, triggerIncomingCall, addSystemMessage, setForceConcat, setReplying, cards, blockedIds, emojis, profile.taName, taAvatarUrl]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.altKey && e.key === 'm') {
      e.preventDefault();
      setDiagMinimalMode(v => !v);
      logger.info(`[diag] minimal mode toggled: ${!diagMinimalMode}`);
    }
  };

  const handleInsertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = input.slice(0, start);
    const after = input.slice(end);
    const next = before + emoji + after;
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }, [input]);

  const handleSendSticker = useCallback((stickerUrl: string) => {
    const tClick = typeof performance !== 'undefined' ? performance.now() : 0;
    logger.info(`[send-click-perf] sticker send click, t=${tClick.toFixed(1)}ms`);
    setShowEmojiPanel(false);
    const quoteTo = quoteMsg ? quoteMsg.id : null;
    const quoteContent = quoteMsg ? quoteMsg.content : null;
    const quoteSender = quoteMsg && quoteMsg.sender !== 'system' ? quoteMsg.sender as 'me' | 'ta' : null;
    logger.info(`[quote-debug] 发送表情包，携带引用: quoteTo=${!!quoteTo}，quoteSender=${quoteSender}`);
    setQuoteMsg(null);
    setIsAtBottom(true);

    try {
      const content = `[STICKER:${stickerUrl}]`;
      // 同步：乐观更新 UI，立即返回消息对象（IDB 写入在后台异步进行）
      const userMsg = addUserMessage(content, quoteTo, quoteContent, quoteSender);

      const doScroll = () => {
        const el = scrollContainerRef.current;
        if (el) {
          autoScrollingRef.current = true;
          el.scrollTop = el.scrollHeight;
          requestAnimationFrame(() => {
            autoScrollingRef.current = false;
          });
        }
      };
      const doFocus = () => { textareaRef.current?.focus(); };

      doFocus();
      doScroll();
      requestAnimationFrame(() => {
        doScroll();
        doFocus();
        requestAnimationFrame(() => { doFocus(); });
      });
      setTimeout(() => { doFocus(); }, 0);
      logger.info(`[send-click-perf] sticker sync done, t=${(performance.now() - tClick).toFixed(1)}ms`);

      // 后续操作不等 IDB 写入，推到宏任务让浏览器先渲染当前帧
      setTimeout(() => {
        try {
          initAudioContext();
          playSound('me_send');

          const willReply = !(config.readWithoutReply && config.readReceipt && Math.random() < config.readWithoutReplyRate / 100);
          if (willReply) setReplying(true);
          const minSec = Math.max(1, rhythm.replyMinSeconds);
          const maxSec = Math.max(minSec, rhythm.replyMaxSeconds);
          const delayMs = (minSec + Math.random() * (maxSec - minSec)) * 1000;

          const replyCards = willReply ? determineReplyCards() : [];
          const taQuoteTo: string | null = null;
          const taQuoteContent: string | null = null;
          const taQuoteSender: 'me' | 'ta' | null = null;

           startPending(
              userMsg.id,
              userMsg.content,
              willReply,
              delayMs,
              replyCards,
              taQuoteTo,
              taQuoteContent,
              taQuoteSender,
            );
        } catch (error) {
          logger.error('发送表情包失败', error);
          cancelPending();
        }
      }, 0);
    } catch (error) {
      logger.error('发送表情包失败', error);
      cancelPending();
    }
   }, [quoteMsg, addUserMessage, config.readWithoutReply, config.readWithoutReplyRate, config.readReceipt, config.quoteReply, rhythm.replyMinSeconds, rhythm.replyMaxSeconds, determineReplyCards, startPending, cancelPending]);

  const handleQuestionnaireUserSend = useCallback((q: Questionnaire) => {
    setShowQuestionnaire(false);
    const content = `[QUESTIONNAIRE:${q.id}]`;
    addUserMessage(content, null, null, null);
    setIsAtBottom(true);
    const doScroll = () => {
      const el = scrollContainerRef.current;
      if (el) {
        autoScrollingRef.current = true;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
          autoScrollingRef.current = false;
        });
      }
    };
    doScroll();
    requestAnimationFrame(() => { doScroll(); });
    setQnReplyTick((t) => t + 1);
    logger.info(`[survey-reply] 用户发送问卷 qid=${q.id}, tick+1`);
  }, [addUserMessage]);

  const handleQuestionnaireTaReply = useCallback((q: Questionnaire) => {
    const content = `[QUESTIONNAIRE_REPLY:${q.id}]`;
    void appendTaMessage(content, null, null, null, null);
    logger.info(`[questionnaire-reply] TA回复问卷 qid=${q.id}`);
  }, [appendTaMessage]);

  const handleAddCard = useCallback(async () => {
    const content = newCardContent.trim();
    if (!content || savingCard) return;
    setSavingCard(true);
    try {
      addCard(content);
      setNewCardContent('');
      setShowAddCard(false);
    } catch (error) {
      logger.error('添加字卡失败', error);
    } finally {
      setSavingCard(false);
    }
  }, [newCardContent, savingCard, addCard]);

  const openAddCard = useCallback(() => {
    setShowAddCard(true);
    setTimeout(() => cardTextareaRef.current?.focus(), 50);
  }, []);

  const openTypingSettings = useCallback(() => {
    setTempTypingAvatar(config.typingShowAvatar);
    setTempTypingText(config.typingCustomText || DEFAULT_TYPING_TEXT);
    setShowTypingSettings(true);
  }, [config.typingShowAvatar, config.typingCustomText]);

  const handleSaveTypingSettings = useCallback(() => {
    updateConfig({
      typingShowAvatar: tempTypingAvatar,
      typingCustomText: tempTypingText.trim() || DEFAULT_TYPING_TEXT,
    });
    setShowTypingSettings(false);
  }, [tempTypingAvatar, tempTypingText, updateConfig]);

  const handleQuoteSelect = useCallback((msg: ChatMessage) => {
    logger.info(`[quote-debug] 选择引用消息，msgId=${msg.id}，sender=${msg.sender}，contentLen=${msg.content?.length || 0}`);
    setQuoteMsg(msg);
    setShowActionSheet(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleDeleteMessage = useCallback(async (msg: ChatMessage) => {
    setShowActionSheet(null);
    await deleteMessageById(msg.id);
  }, [deleteMessageById]);

  const handleRecallMessage = useCallback(async (msg: ChatMessage) => {
    setShowActionSheet(null);
    await recallMessage(msg.id);
  }, [recallMessage]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleBubbleLongPress = useCallback((msg: ChatMessage) => {
    setShowActionSheet(msg);
  }, []);

  const startLongPress = useCallback((msg: ChatMessage, clientX?: number, clientY?: number) => {
    longPressTriggeredRef.current = false;
    longPressStartPosRef.current = clientX !== undefined ? { x: clientX, y: clientY } : null;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      handleBubbleLongPress(msg);
    }, 500);
  }, [handleBubbleLongPress]);

  const endLongPress = useCallback((clientX?: number, clientY?: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const start = longPressStartPosRef.current;
    if (start && clientX !== undefined && clientY !== undefined) {
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        longPressTriggeredRef.current = false;
      }
    }
    longPressStartPosRef.current = null;
  }, []);

  const clearQuote = useCallback(() => {
    logger.info('[quote-debug] 清空引用');
    setQuoteMsg(null);
  }, []);

  const displayName = profile.taName || 'TA';
  const myDisplayName = profile.myName || '我';

  const handleNudgeTa = useCallback(() => {
    if (nudgeCooldownRef.current > Date.now()) return;
    logger.info('[urge-reply] 点击催说话按钮');

    const replyCards = getRandomCards(1, 'all');
    if (replyCards.length === 0) {
      logger.warn('[urge-reply] 字卡库为空或全部被屏蔽，无法回复');
      toast('TA还没有准备好回复');
      nudgeCooldownRef.current = Date.now() + 5000;
      setNudgeCooldown(true);
      setTimeout(() => setNudgeCooldown(false), 5000);
      return;
    }

    const minSec = Math.max(1, rhythm.replyMinSeconds);
    const maxSec = Math.max(minSec, rhythm.replyMaxSeconds);
    const delayMs = (minSec + Math.random() * (maxSec - minSec)) * 1000 * 0.5;
    const fakeUserMsgId = `nudge_${Date.now()}`;

    logger.info(`[urge-reply] 触发回复，delayMs=${Math.round(delayMs)}，cardId=${replyCards[0]?.id}`);

    startPending(
      fakeUserMsgId,
      '',
      true,
      delayMs,
      replyCards,
      null,
      null,
      null,
    );

    nudgeCooldownRef.current = Date.now() + 5000;
    setNudgeCooldown(true);
    setTimeout(() => setNudgeCooldown(false), 5000);
  }, [rhythm.replyMinSeconds, rhythm.replyMaxSeconds, getRandomCards, startPending]);

  const handleSendPat = useCallback((content: string) => {
    const ta = displayName || 'TA';
    const converted = content.replace(/TA/g, ta);
    const fullText = `你 ${converted}`;
    addPatMessage(wrapPatDecor(fullText, 'mine'));
    setShowEmojiPanel(false);
    initAudioContext();
    playSound('me_pat');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    if (!config.readReceipt && !config.typingIndicator) return;
    const willReply = !(config.readWithoutReply && config.readReceipt && Math.random() < config.readWithoutReplyRate / 100);
    if (!willReply) return;
    const minSec = Math.max(1, rhythm.replyMinSeconds);
    const maxSec = Math.max(minSec, rhythm.replyMaxSeconds);
    const delayMs = (minSec + Math.random() * (maxSec - minSec)) * 1000 * 0.6;
    const replyCards = getRandomCards(1, 'all');
    const fakeUserMsgId = `pat_${Date.now()}`;
    const taQuoteTo: string | null = null;
    const taQuoteContent: string | null = null;
    const taQuoteSender: 'me' | 'ta' | null = null;
    startPending(
      fakeUserMsgId,
      '',
      true,
      delayMs,
      replyCards,
      taQuoteTo,
      taQuoteContent,
      taQuoteSender,
    );
  }, [addSystemMessage, displayName, patDecorMine, config.readReceipt, config.typingIndicator, config.readWithoutReply, config.readWithoutReplyRate, rhythm.replyMinSeconds, rhythm.replyMaxSeconds, getRandomCards, startPending]);

  const quoteSenderLabel = (sender: string | null | undefined): string => {
    if (sender === 'me') return myDisplayName;
    return displayName;
  };

  const formatQuoteContent = (content: string | null | undefined): string => {
    if (!content) return '';
    if (content.startsWith('[STICKER:') && content.endsWith(']')) return '[表情包]';
    if (content.startsWith('[IMAGE:') && content.endsWith(']')) return '[图片]';
    if (content.startsWith('data:image/')) return '[图片]';
    if (/^\[.*\]$/.test(content) && /base64,/.test(content)) return '[图片]';
    const trimmed = content.trim();
    if (!trimmed) return '';
    if (trimmed.length > 30) return trimmed.slice(0, 30) + '…';
    return trimmed;
  };

  const startEditMyStatus = useCallback(() => {
    setMyStatusInput(myStatus);
    setEditingMyStatus(true);
    setTimeout(() => {
      myStatusInputRef.current?.focus();
      myStatusInputRef.current?.select();
    }, 0);
  }, [myStatus]);

  const saveMyStatus = useCallback(() => {
    const trimmed = myStatusInput.trim();
    if (trimmed) {
      setMyStatus(trimmed);
    }
    setEditingMyStatus(false);
  }, [myStatusInput, setMyStatus]);

  const cancelEditMyStatus = useCallback(() => {
    setEditingMyStatus(false);
  }, []);

  const handleMyStatusKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveMyStatus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditMyStatus();
    }
  };

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden relative"
      style={chatBgStyle}
    >
      <div className="chat-bg-overlay" />
      <header
        className="chat-bar-glass flex flex-col px-4 py-2 z-10 border-b flex-shrink-0 header-glass"
        style={{
          borderBottomColor: 'var(--chat-bar-border)',
        }}
      >
        <div className="text-center pb-1 md:pb-1.5">
          <span
            className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.25em] font-serif italic"
            style={{ color: 'var(--chat-accent)' }}
          >
            {topMotto}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <span
              className="text-sm md:text-base font-semibold leading-tight truncate"
              style={{ color: 'var(--chat-topbar-text)' }}
            >
              {displayName}
            </span>
            <Image
              src={taAvatarUrl}
              alt={displayName}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-white/60 shadow-sm mt-1"
              fallbackSrc={DEFAULT_TA_AVATAR}
            />
            <span
              className="text-[11px] md:text-xs leading-tight mt-1"
              style={{ color: 'var(--chat-accent-dark)' }}
            >
              {taStatus}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1 md:gap-3 px-1 md:px-2 flex-shrink-0">
              <button
                onClick={() => setShowMailbox(true)}
                className="w-11 h-11 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 relative"
                style={{ color: 'var(--chat-icon-active)' }}
                aria-label="邮件"
              >
                <Mail size={15} strokeWidth={1.5} />
                {unreadLetters > 0 && (
                  <span
                    className="absolute top-1 right-1 md:top-0 md:right-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#e74c3c' }}
                  />
                )}
              </button>
              <button
                onClick={() => setShowQuestionnaire(true)}
                className="w-11 h-11 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
                style={{ color: 'var(--chat-icon-active)' }}
                aria-label="问卷"
              >
                <ClipboardList size={15} strokeWidth={1.5} />
              </button>
            <button
              onClick={() => navigate('/cards')}
              className="w-11 h-11 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
              style={{ color: 'var(--chat-icon-active)' }}
              aria-label="字卡管理"
            >
              <List size={15} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-11 h-11 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
              style={{ color: 'var(--chat-icon-active)' }}
              aria-label="设置"
            >
              <Settings size={15} strokeWidth={1.5} />
            </button>
            <ThemeToggleButton />
          </div>

          <div className="flex flex-col items-center flex-1 min-w-0">
            <span
              className="text-sm md:text-base font-semibold leading-tight truncate"
              style={{ color: 'var(--chat-topbar-text)' }}
            >
              {myDisplayName}
            </span>
            <Image
              src={myAvatarUrl}
              alt={myDisplayName}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-white/60 shadow-sm mt-1"
              fallbackSrc={DEFAULT_MY_AVATAR}
            />
            {editingMyStatus ? (
              <input
                ref={myStatusInputRef}
                type="text"
                value={myStatusInput}
                onChange={(e) => setMyStatusInput(e.target.value)}
                onKeyDown={handleMyStatusKeyDown}
                onBlur={saveMyStatus}
                className="text-xs leading-tight mt-1 px-1.5 py-0.5 rounded outline-none text-center w-20"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    color: 'var(--chat-topbar-text)',
                    border: '1px solid var(--chat-accent)',
                  }}
              />
            ) : (
              <span
                className="text-xs leading-tight mt-1 cursor-pointer hover:opacity-70 transition-opacity"
                style={{ color: 'var(--chat-accent-dark)' }}
                onClick={startEditMyStatus}
                title="点击编辑状态"
              >
                {myStatus}
              </span>
            )}
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0 relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onScroll={handleScroll}
      >
        {messagesLoading && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <p className="text-sm" style={{ color: 'var(--chat-text-tertiary)' }}>
              加载中...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <p className="text-sm" style={{ color: 'var(--chat-text-tertiary)' }}>
              开始和 {displayName} 聊天吧
            </p>
          </div>
        ) : (
             visibleMessages.map((msg: ChatMessage, index: number) => {
              const isMe = msg.sender === 'me';
               const isSystem = msg.sender === 'system' || msg.type === 'system' || msg.type === 'pat';
              const safeContent = msg.content || '';
              const isQuestionnaireMsg = safeContent.startsWith('[QUESTIONNAIRE:') && safeContent.endsWith(']');
              const isQuestionnaireReplyMsg = safeContent.startsWith('[QUESTIONNAIRE_REPLY:') && safeContent.endsWith(']');
              const questionnaireId = isQuestionnaireMsg
                ? safeContent.slice(15, -1)
                : isQuestionnaireReplyMsg
                  ? safeContent.slice(21, -1)
                  : null;
              const questionnaire = questionnaireId ? getQuestionnaireById(questionnaireId) ?? null : null;
              const groupInfo = messageGroupInfo[index];
              const isFirstInGroup = groupInfo?.isFirst ?? true;
              const isLastInGroup = groupInfo?.isLast ?? true;
              const showAvatar = groupInfo?.showAvatar ?? false;
              const showTime = groupInfo?.showTime ?? true;
               const isPatMsg = msg.type === 'pat' && !/📞|通话|未接|拒绝|已结束|催了催|催说话|收到一封|时空来信|✉️/.test(msg.content);
               if (isSystem) {
                 if (isPatMsg) {
                   return (
                     <div key={msg.id} className="flex justify-center items-center my-2 gap-3" style={{ color: 'var(--chat-pat-color)', fontSize: '12px' }}>
                       <span className="h-px w-6" style={{ backgroundColor: 'var(--chat-pat-line-color)' }} />
                       <span>{msg.content}</span>
                       <span className="h-px w-6" style={{ backgroundColor: 'var(--chat-pat-line-color)' }} />
                     </div>
                   );
                 }
                 const isCallRejected = msg.callType === 'rejected';
                 const msgColor = isCallRejected ? 'var(--chat-call-rejected-color)' : 'var(--chat-system-msg-color)';
                 const msgBg = isCallRejected ? 'var(--chat-call-rejected-bg)' : 'var(--chat-system-msg-bg)';
                 const msgPadClass = isCallRejected ? 'px-5 py-2' : 'px-3 py-1';
                 return (
                   <div key={msg.id} className="flex justify-center my-2">
                     <span
                       className={`text-xs ${msgPadClass} rounded-full`}
                        style={{
                          color: msgColor,
                          backgroundColor: msgBg,
                          fontSize: isCallRejected ? '13px' : '12px',
                        }}
                     >
                       {msg.content}
                     </span>
                   </div>
                 );
               }
             if (msg.isRecalled) {
               const expanded = expandedRecallId === msg.id;
               const safeContent = msg.content || '';
               const isSticker = !!msg.stickerUrl || (safeContent.startsWith('[STICKER:') && safeContent.endsWith(']'));
               const isImage = msg.type === 'image' || safeContent.startsWith('[IMAGE:');
               const stickerSrc = msg.stickerUrl || (safeContent.startsWith('[STICKER:') ? safeContent.slice(9, -1) : '');
               const showContent = safeContent && !isSticker && !isImage && !safeContent.startsWith('[PAT:');
               return (
                 <div key={msg.id} className="flex flex-col items-center my-2">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setExpandedRecallId(expanded ? null : msg.id);
                     }}
                       className="text-xs px-3 py-1 rounded-full transition-colors hover:opacity-80"
                       style={{ color: 'var(--chat-pat-color)', backgroundColor: 'var(--chat-recall-bg)' }}
                   >
                     {isMe ? '你撤回了一条消息' : `${displayName}撤回了一条消息`}
                      <span className="ml-1" style={{ color: 'var(--chat-accent-light)' }}>
                       {expanded ? '▲' : '▼'}
                     </span>
                   </button>
                   {expanded && (
                      <div
                        className="mt-2 px-3 py-2 rounded-lg text-xs max-w-[85%] md:max-w-[70%]"
                         style={{
                           backgroundColor: 'var(--chat-recall-expand-bg)',
                           color: 'var(--chat-recall-text)',
                           border: '1px dashed var(--chat-recall-border)',
                         }}
                      >
                       {isSticker ? (
                         <Image
                           src={stickerSrc}
                           alt="撤回的表情包"
                           className="max-w-32 max-h-32 object-contain rounded-lg"
                         />
                       ) : isImage ? (
                          <div style={{ color: 'var(--chat-recall-text)' }}>[图片]</div>
                        ) : showContent ? (
                          <div className="whitespace-pre-wrap break-words">
                            {msg.content}
                            {msg.emojis && msg.emojis.length > 0 && (
                              <span className="ml-1 text-xl leading-none align-middle">
                                {' '}{msg.emojis.join(' ')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--chat-text-muted)' }}>[消息]</div>
                       )}
                     </div>
                   )}
                 </div>
               );
             }
            return (
              <div key={msg.id} data-msg-id={msg.id} className={`${isLastInGroup ? 'mb-0' : 'mb-0.5'} ${highlightMsgId === msg.id ? 'msg-highlight' : ''}`}>
                <div
                  className={`flex w-full gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                   <div
                     className="flex-shrink-0 flex items-start w-9 md:w-10"
                   >
                     {showAvatar && (
                       <Image
                         src={isMe ? myAvatarUrl : taAvatarUrl}
                         alt={isMe ? myDisplayName : displayName}
                         className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shadow-sm"
                         fallbackSrc={isMe ? DEFAULT_MY_AVATAR : DEFAULT_TA_AVATAR}
                       />
                     )}
                   </div>
                    <div
                        className={`relative flex max-w-[75%] md:max-w-[calc(100%-40px-8px)] flex-col ${isMe ? 'items-end' : 'items-start'}`}
                     >
                     {(isQuestionnaireMsg || isQuestionnaireReplyMsg) && questionnaire ? (
                        <QuestionnaireMessage
                          questionnaire={questionnaire}
                          isMe={isMe}
                          isReplied={isQuestionnaireReplyMsg}
                          replies={isQuestionnaireReplyMsg ? questionnaire.replies : undefined}
                        />
                     ) : (
                     <div
                      className="px-3 md:px-4 py-2 md:py-2.5 text-[14px] md:text-[15px] leading-relaxed break-words shadow-sm relative select-none"
                       style={{
                          backgroundColor: isMe ? 'var(--chat-bubble-me)' : 'var(--chat-bubble-ta)',
                          color: isMe ? 'var(--chat-bubble-me-text)' : 'var(--chat-bubble-ta-text)',
                         wordBreak: 'break-word',
                         userSelect: 'none',
                         WebkitUserSelect: 'none',
                         borderRadius: '20px',
                         boxShadow: isMe
                           ? '0 2px 8px rgba(201, 168, 124, 0.25)'
                           : '0 2px 8px rgba(0, 0, 0, 0.06)',
                      }}
                      onMouseDown={(e) => {
                         if (e.button !== 0) return;
                         startLongPress(msg, e.clientX, e.clientY);
                       }}
                       onMouseUp={(e) => { endLongPress(e.clientX, e.clientY); }}
                       onMouseLeave={(e) => { endLongPress(e.clientX, e.clientY); }}
                       onContextMenu={(e) => {
                         e.preventDefault();
                         if (!longPressTriggeredRef.current) {
                           handleBubbleLongPress(msg);
                         }
                       }}
                       onTouchStart={(e) => {
                         const t = e.touches[0];
                         startLongPress(msg, t?.clientX, t?.clientY);
                       }}
                       onTouchEnd={(e) => {
                         const t = e.changedTouches[0];
                         endLongPress(t?.clientX, t?.clientY);
                       }}
                       onTouchCancel={(e) => {
                         const t = e.changedTouches[0];
                         endLongPress(t?.clientX, t?.clientY);
                       }}
                       onTouchMove={(e) => {
                         const t = e.touches[0];
                         if (t && longPressStartPosRef.current) {
                           const dx = t.clientX - longPressStartPosRef.current.x;
                           const dy = t.clientY - longPressStartPosRef.current.y;
                           if (Math.sqrt(dx * dx + dy * dy) > 10) {
                             if (longPressTimerRef.current) {
                               clearTimeout(longPressTimerRef.current);
                               longPressTimerRef.current = null;
                             }
                           }
                         }
                       }}
                    >
                      {config.quoteReply && msg.quoteContent && (
                        <div
                          className="quote-preview mb-2 pl-2.5 border-l-2 text-xs leading-snug overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuoteClick(msg.quoteTo);
                          }}
                          style={{
                            borderColor: isMe ? 'var(--chat-quote-border-me)' : 'var(--chat-quote-border-ta)',
                            color: isMe ? 'var(--chat-quote-text-me)' : 'var(--chat-quote-text-ta)',
                          }}
                        >
                          <div className="font-medium mb-0.5">
                            {quoteSenderLabel(msg.quoteSender)}
                          </div>
                          <div
                            className="overflow-hidden"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {formatQuoteContent(msg.quoteContent)}
                          </div>
                        </div>
                      )}
                       {msg.stickerUrl ? (
                             <div
                               className="w-48 h-48 flex items-center justify-center rounded-xl overflow-hidden"
                               style={{ backgroundColor: 'var(--chat-bg-secondary)' }}
                             >
                             <Image
                               src={msg.stickerUrl}
                               alt="表情包"
                               className="w-full h-full object-contain"
                               loading="eager"
                               decoding="sync"
                               onLoad={handleStickerLoad}
                             />
                             </div>
                           ) : msg.content.startsWith('[STICKER:') && msg.content.endsWith(']') ? (
                             <div
                               className="w-48 h-48 flex items-center justify-center rounded-xl overflow-hidden"
                               style={{ backgroundColor: 'var(--chat-bg-secondary)' }}
                             >
                             <Image
                               src={msg.content.slice(9, -1)}
                               alt="表情包"
                               className="w-full h-full object-contain"
                               loading="eager"
                               decoding="sync"
                               onLoad={handleStickerLoad}
                             />
                             </div>
                          ) : (
                             <>
                               {msg.content.split('\n').map((line: string, i: number, arr: string[]) => {
                                 const isLastLine = i === arr.length - 1;
                                 if (line.startsWith('[STICKER:') && line.endsWith(']')) {
                                   return (
                                     <Image
                                       key={i}
                                       src={line.slice(9, -1)}
                                       alt="表情包"
                                       className="max-w-40 max-h-40 object-contain rounded-xl mt-2"
                                       loading="eager"
                                       decoding="sync"
                                       onLoad={handleStickerLoad}
                                     />
                                   );
                                 }
                                return (
                                  <div key={i}>
                                    {line}
                                    {isLastLine && msg.emojis && msg.emojis.length > 0 && (
                                      <span className="ml-1 text-xl leading-none align-middle">
                                        {' '}{msg.emojis.join(' ')}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                           </>
                         )}
                     </div>
                     )}
                       <div
                         className={`text-[11px] mt-1 flex items-center gap-1 ${isMe ? 'self-end flex-row-reverse' : 'self-start flex-row'}`}
                          style={{ color: 'var(--chat-text-tertiary)' }}
                        >
                          {config.readReceipt && isMe && (
                            <span className="flex items-center" style={{ color: msg.isRead ? 'var(--chat-accent)' : 'var(--chat-text-tertiary)' }}>
                             <Check size={11} strokeWidth={3} />
                              {msg.isRead && <Check size={11} strokeWidth={3} style={{ marginLeft: '-4px' }} />}
                            </span>
                          )}
                          {showTime && <span>{formatDateLabel(msg.createdAt)}</span>}
                        </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div />
      </div>

      {showActionSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'var(--chat-overlay)' }}
          onClick={() => setShowActionSheet(null)}
        >
          <div
            className="w-full max-w-md px-3 pb-4 flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--chat-surface-secondary)' }}>
              <button
                className="py-3.5 text-base text-center border-b active:bg-white/60 transition-colors"
                 style={{ color: 'var(--chat-accent)', borderColor: 'rgba(201, 168, 124, 0.2)' }}
                onClick={() => {
                  if (!showActionSheet) return;
                  if (!config.quoteReply) {
                    updateConfig({ quoteReply: true });
                  }
                  handleQuoteSelect(showActionSheet);
                }}
              >
                引用
              </button>
              <button
                className="py-3.5 text-base text-center border-b active:bg-white/60 transition-colors"
                 style={{ color: 'var(--chat-danger)', borderColor: 'rgba(201, 168, 124, 0.2)' }}
                onClick={() => {
                  if (!showActionSheet) return;
                  void handleDeleteMessage(showActionSheet);
                }}
              >
                删除
              </button>
              <button
                 className="py-3.5 text-base text-center active:bg-white/60 transition-colors"
                 style={{ color: 'var(--chat-danger)' }}
                 onClick={() => {
                   if (!showActionSheet) return;
                   void handleRecallMessage(showActionSheet);
                }}
              >
                撤回
              </button>
            </div>
            <button
              className="py-3.5 text-base text-center rounded-2xl font-medium active:bg-white/80 transition-colors"
               style={{ backgroundColor: 'var(--chat-surface-secondary)', color: 'var(--chat-accent)' }}
               onClick={() => setShowActionSheet(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {isTyping && (
        <div
          className="px-4 py-2 flex-shrink-0"
          style={{ backgroundColor: 'transparent' }}
        >
          <button
            onClick={openTypingSettings}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-opacity hover:opacity-80 shadow-sm"
             style={{
               backgroundColor: 'var(--chat-surface)',
               color: 'var(--chat-topbar-text)',
               border: '1px solid var(--chat-divider)',
             }}
           >
             {config.typingShowAvatar && (
              <Image
                src={taAvatarUrl}
                alt={displayName}
                className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                fallbackSrc={DEFAULT_TA_AVATAR}
              />
            )}
             <span className="font-medium" style={{ color: 'var(--chat-topbar-text)' }}>{displayName}</span>
             <span style={{ color: 'var(--chat-accent-dark)' }}>{config.typingCustomText || DEFAULT_TYPING_TEXT}</span>
             <span className="flex items-center gap-0.5" style={{ color: 'var(--chat-accent)' }}>
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </button>
        </div>
      )}

      {showNewMsgTip && (
        <div className="flex justify-center py-2 flex-shrink-0">
          <button
            onClick={scrollToNewMsg}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95"
            style={{
              backgroundColor: '#c9a87c',
              color: '#fff',
              animation: 'newMsgTipSlideUp 0.3s ease-out',
            }}
          >
            <ChevronDown size={16} strokeWidth={2.5} />
            <span>
              {newMsgCount > 1 ? `${newMsgCount}条新消息` : '有新消息'}
            </span>
          </button>
        </div>
      )}

       <div
        className="chat-bar-glass border-t flex-shrink-0"
         style={{
           borderTopColor: 'var(--chat-bar-border)',
           paddingBottom: 'env(safe-area-inset-bottom)',
         }}
       >
         {config.quoteReply && quoteMsg && (
          <div
            className="px-3 py-2 flex items-center justify-between gap-2 border-b"
             style={{
               backgroundColor: 'transparent',
               borderBottomColor: 'var(--chat-bar-border)',
             }}
           >
            <div className="flex-1 min-w-0 text-xs overflow-hidden">
               <span style={{ color: 'var(--chat-accent)', fontWeight: 500 }}>
                {quoteSenderLabel(quoteMsg.sender)}:
              </span>
              <span
                className="ml-1 truncate inline-block align-bottom max-w-full"
                 style={{ color: 'var(--chat-accent-dark)' }}
               >
                 {formatQuoteContent(quoteMsg.content)}
              </span>
            </div>
            <button
              onClick={clearQuote}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-colors active:bg-amber-200/50"
               style={{ color: 'var(--chat-text-tertiary)' }}
               aria-label="取消引用"
            >
              <X size={14} />
            </button>
          </div>
        )}
           <div className="px-2 py-2 flex items-end gap-1 md:gap-2">
           <button
              onClick={handleStartCall}
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-60"
              style={{ color: 'var(--chat-icon-color)' }}
              aria-label="打电话"
            >
              <Phone size={22} strokeWidth={1.5} />
            </button>
            <textarea
             ref={textareaRef}
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder=""
             rows={1}
             className="flex-1 resize-none rounded-2xl px-3 md:px-4 py-2 text-[14px] md:text-[15px] outline-none transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{
                backgroundColor: 'var(--chat-input-bg)',
                color: 'var(--chat-input-text)',
                caretColor: 'var(--chat-accent)',
                maxHeight: '110px',
                lineHeight: '22px',
                border: '1px solid var(--chat-input-border)',
              }}
           />
           <button
               onClick={handleNudgeTa}
               disabled={nudgeCooldown}
               className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-60 disabled:opacity-40"
                style={{ color: nudgeCooldown ? 'var(--chat-text-muted)' : 'var(--chat-icon-color)' }}
                aria-label="催TA说话"
               title={nudgeCooldown ? '冷却中' : '催TA说话'}
             >
               <MoreHorizontal size={22} strokeWidth={2} />
             </button>
            <button
               onClick={() => setShowEmojiPanel((v) => !v)}
               className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-60"
                style={{ color: showEmojiPanel ? 'var(--chat-icon-active)' : 'var(--chat-icon-color)' }}
                aria-label="表情"
             >
               <Smile size={22} strokeWidth={1.5} />
             </button>
           {input.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                className="h-11 md:h-9 px-3 md:px-4 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium transition-opacity active:opacity-80"
                 style={{
                   backgroundColor: 'var(--chat-accent)',
                   color: 'var(--chat-bubble-me-text)',
                 }}
                aria-label="发送"
             >
               发送
             </button>
           ) : (
             <button
               onClick={openAddCard}
               className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-60"
                style={{ color: 'var(--chat-icon-color)' }}
                aria-label="添加字卡"
             >
               <Plus size={22} strokeWidth={1.5} />
             </button>
           )}
         </div>
        {showEmojiPanel && (
          <EmojiPanel
            emojis={emojis}
            stickers={stickers}
            patPats={patItems.map((item) => item.content)}
            userPatItems={userPatItems.map((item) => ({ id: item.id, content: item.content }))}
            onAddUserPat={addBatchUserPat}
            onDeleteUserPat={deleteUserPat}
            onInsertEmoji={handleInsertEmoji}
            onSendSticker={handleSendSticker}
            onAddSticker={addSticker}
            onRemoveSticker={removeSticker}
            onSendPat={handleSendPat}
            onOpenDecorSetting={() => setShowPatDecor(true)}
            onClose={() => setShowEmojiPanel(false)}
          />
        )}
      </div>

      {showAddCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
           style={{ backgroundColor: 'var(--chat-overlay)' }}
           onClick={() => setShowAddCard(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl"
             style={{ backgroundColor: 'var(--chat-surface-secondary)' }}
             onClick={(e) => e.stopPropagation()}          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderBottomColor: 'rgba(201, 168, 124, 0.2)' }}
            >
               <h2 className="text-base font-medium" style={{ color: 'var(--chat-topbar-text)' }}>
                 添加字卡
              </h2>
              <button
                onClick={() => setShowAddCard(false)}
                 className="w-8 h-8 flex items-center justify-center transition-opacity active:opacity-60"
                 style={{ color: 'var(--chat-accent-dark)' }}
                 aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
               <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--chat-accent-dark)' }}>
                写下想让{displayName}对你说的话，保存后聊天时{displayName}就有可能回复这句话。
              </p>
              <textarea
                ref={cardTextareaRef}
                value={newCardContent}
                onChange={(e) => setNewCardContent(e.target.value)}
                placeholder="写下想让TA说的话..."
                rows={4}
                className="w-full resize-none rounded-xl px-4 py-3 text-[15px] outline-none border"
                 style={{
                   backgroundColor: 'var(--chat-input-bg)',
                   color: 'var(--chat-input-text)',
                   caretColor: 'var(--chat-accent)',
                   lineHeight: '22px',
                   borderColor: 'var(--chat-input-border)',
                 }}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowAddCard(false)}
                  className="h-9 px-4 rounded-full text-sm transition-colors active:bg-amber-100"
                   style={{ color: 'var(--chat-accent-dark)', backgroundColor: 'var(--chat-surface)', border: '1px solid var(--chat-divider)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleAddCard}
                  disabled={!newCardContent.trim() || savingCard}
                  className="h-9 px-4 rounded-full text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-40"
                   style={{
                     backgroundColor: 'var(--chat-accent)',
                     color: 'var(--chat-bubble-me-text)',
                   }}
                 >
                   保存
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       <PatDecorDialog
        open={showPatDecor}
        initialMine={patDecorMine}
        initialTheirs={patDecorTheirs}
        taName={displayName}
        onClose={() => setShowPatDecor(false)}
        onSave={(mine, theirs) => {
          updateConfig({ patDecor: { mine, theirs } });
        }}
      />

      {showTypingSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
           style={{ backgroundColor: 'var(--chat-overlay)' }}
           onClick={() => setShowTypingSettings(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
             style={{ backgroundColor: 'var(--chat-surface-secondary)' }}
             onClick={(e) => e.stopPropagation()}
           >
             <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201, 168, 124, 0.2)' }}>
               <h3 className="text-base font-medium" style={{ color: 'var(--chat-topbar-text)' }}>正在输入设置</h3>
              <button
                onClick={() => setShowTypingSettings(false)}
                 className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-amber-100/50"
                 style={{ color: 'var(--chat-accent-dark)' }}
                 aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                   <div className="text-sm font-medium" style={{ color: 'var(--chat-topbar-text)' }}>显示头像</div>
                   <div className="text-xs mt-0.5" style={{ color: 'var(--chat-accent-dark)' }}>在指示器左侧显示对方头像</div>
                </div>
                <button
                  onClick={() => setTempTypingAvatar((v) => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{
                     backgroundColor: tempTypingAvatar ? 'var(--chat-accent)' : 'var(--chat-accent-light)',
                  }}
                  aria-label="显示头像开关"
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
                    style={{
                      left: tempTypingAvatar ? '22px' : '2px',
                    }}
                  />
                </button>
              </div>

              <div>
                 <div className="text-sm font-medium mb-2" style={{ color: 'var(--chat-topbar-text)' }}>自定义文案</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTypingText}
                    onChange={(e) => setTempTypingText(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-sm border outline-none transition-colors focus:border-amber-400"
                     style={{
                       backgroundColor: 'var(--chat-input-bg)',
                       borderColor: 'var(--chat-input-border)',
                       color: 'var(--chat-input-text)',
                     }}
                    placeholder="正在输入…"
                  />
                  <button
                    onClick={() => setTempTypingText(DEFAULT_TYPING_TEXT)}
                    className="px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-amber-100/50"
                     style={{ color: 'var(--chat-accent)' }}
                   >
                     恢复默认
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveTypingSettings}
               className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors active:opacity-80"
               style={{
                 backgroundColor: 'var(--chat-accent)',
                 color: 'var(--chat-bubble-me-text)',
               }}
             >
               保存
             </button>

             <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--chat-surface)' }}>
                 <div className="text-xs mb-2" style={{ color: 'var(--chat-accent-dark)' }}>预览效果</div>
                <div className="flex items-center gap-1.5">
                  {tempTypingAvatar && (
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'var(--chat-accent-light)' }}
                    />
                  )}
                   <span className="text-xs font-medium" style={{ color: 'var(--chat-topbar-text)' }}>对方</span>
                   <span className="text-xs" style={{ color: 'var(--chat-accent-dark)' }}>
                     {tempTypingText || DEFAULT_TYPING_TEXT}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
       )}

      <MailboxDialog
        open={showMailbox}
        onClose={() => setShowMailbox(false)}
        rhythm={rhythm}
        profile={profile}
        onLetterArrived={handleLetterArrived}
      />

      <QuestionnaireDialog
        open={showQuestionnaire}
        onClose={() => setShowQuestionnaire(false)}
        rhythm={rhythm}
        profile={profile}
        onUserSend={handleQuestionnaireUserSend}
        onTaReply={handleQuestionnaireTaReply}
      />

      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        @keyframes newMsgTipSlideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        textarea::placeholder {
          color: var(--chat-text-muted);
        }
        .chat-bg-overlay {
          position: absolute;
          inset: 0;
          background-color: var(--chat-dark-overlay);
          pointer-events: none;
          transition: background-color var(--chat-transition);
        }
        .header-glass {}
        .header-glass:hover {}
      `}</style>
    </div>
  );
};

export default ChatPage;
