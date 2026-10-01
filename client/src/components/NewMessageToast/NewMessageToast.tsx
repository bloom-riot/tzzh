import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, MessageCircle } from 'lucide-react';
import { useNewMessageToastStore, formatPreview } from '@client/src/stores/new-message-toast-store';
import { useProfile } from '@client/src/hooks/use-local-storage';
import { Image } from '@client/src/components/ui/image';
import { logger } from '@lark-apaas/client-toolkit/logger';

const AUTO_DISMISS_MS = 10000;

export const NewMessageToast: React.FC = () => {
  const { queue, visible, unreadCount, dismiss, clearAll, clearUnread } = useNewMessageToastStore();
  const { profile, taAvatarUrl } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  const isChatPage = location.pathname === '/' || location.pathname === '/chat';
  const latest = queue.length > 0 ? queue[queue.length - 1] : null;

  useEffect(() => {
    if (isChatPage && (queue.length > 0 || unreadCount > 0)) {
      clearAll();
    }
  }, [isChatPage, queue.length, unreadCount, clearAll]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visible && !isChatPage && latest) {
      timerRef.current = window.setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [visible, isChatPage, latest, dismiss]);

  if (isChatPage) return null;

  const showBadge = unreadCount > 0 && !visible;

  const handleToastClick = () => {
    try {
      clearAll();
      navigate('/chat');
    } catch (err) {
      logger.error('NewMessageToast navigate failed', err);
    }
  };

  const handleBadgeClick = () => {
    try {
      clearUnread();
      navigate('/chat');
    } catch (err) {
      logger.error('NewMessageToast badge navigate failed', err);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismiss();
  };

  const displayName = profile.taName || 'TA';
  const timeStr = (() => {
    if (!latest) return '';
    try {
      const d = new Date(latest.createdAt);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '';
    }
  })();

  const preview = latest ? formatPreview(latest.content, latest.stickerUrl || null, latest.emojis || null) : '';

  return (
    <>
      {visible && latest && (
        <div
          onClick={handleToastClick}
          className="fixed top-4 right-4 z-[9999] w-[320px] max-w-[calc(100vw-2rem)] cursor-pointer select-none"
          style={{
            animation: 'toastSlideIn 0.3s ease-out',
          }}
        >
          <div
            className="rounded-2xl p-3"
            style={{
              backgroundColor: 'var(--chat-surface)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
              border: '1px solid var(--chat-divider)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Image
                  src={taAvatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover"
                  fallbackSrc=""
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-medium text-sm truncate"
                    style={{ color: 'var(--chat-text-primary)' }}
                  >
                    {displayName}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: 'var(--chat-text-tertiary)' }}
                  >
                    {timeStr}
                  </span>
                </div>
                <div
                  className="text-sm mt-1 truncate"
                  style={{ color: 'var(--chat-text-secondary)' }}
                >
                  {preview}
                </div>
                {unreadCount > 1 && (
                  <div
                    className="text-xs mt-1.5 inline-block px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--chat-accent-light)',
                      color: 'var(--chat-accent-dark)',
                    }}
                  >
                    {unreadCount} 条新消息
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded-full transition-colors hover:opacity-70"
                style={{ color: 'var(--chat-text-tertiary)' }}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="text-xs mt-2 pt-2 text-center font-medium"
              style={{
                color: '#c9a87c',
                borderTop: '1px solid var(--chat-divider)',
              }}
            >
              点击查看消息
            </div>
          </div>
        </div>
      )}

      {showBadge && (
        <button
          onClick={handleBadgeClick}
          className="fixed top-4 right-4 z-[9998] w-12 h-12 rounded-full flex items-center justify-center cursor-pointer select-none transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#c9a87c',
            boxShadow: '0 4px 16px rgba(201, 168, 124, 0.4)',
            animation: 'badgeBounceIn 0.3s ease-out',
          }}
          aria-label="查看未读消息"
        >
          <MessageCircle size={20} className="text-white" />
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </button>
      )}

      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes badgeBounceIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
};
