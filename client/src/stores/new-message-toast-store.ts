import { create } from 'zustand';
import type { ChatMessage } from '@shared/api.interface';

interface QueuedMessage {
  id: string;
  content: string;
  sender: string;
  createdAt: string;
  stickerUrl?: string | null;
  emojis?: string[] | null;
}

interface NewMessageToastState {
  queue: QueuedMessage[];
  visible: boolean;
  unreadCount: number;
  pushMessage: (msg: Pick<QueuedMessage, 'id' | 'content' | 'sender' | 'createdAt' | 'stickerUrl' | 'emojis'>) => void;
  dismiss: () => void;
  clearAll: () => void;
  clearUnread: () => void;
}

export const useNewMessageToastStore = create<NewMessageToastState>((set, get) => ({
  queue: [],
  visible: false,
  unreadCount: 0,

  pushMessage: (msg) => {
    if (msg.sender !== 'ta') return;
    const q = [...get().queue, msg];
    set({ queue: q, visible: true, unreadCount: get().unreadCount + 1 });
  },

  dismiss: () => {
    set({ visible: false, queue: [] });
  },

  clearAll: () => {
    set({ queue: [], visible: false, unreadCount: 0 });
  },

  clearUnread: () => {
    set({ unreadCount: 0 });
  },
}));

export function formatPreview(content: string, stickerUrl?: string | null, emojis?: string[] | null): string {
  if (stickerUrl) return '[表情]';
  const trimmed = content.trim();
  if (!trimmed) {
    if (emojis && emojis.length > 0) return emojis.join(' ');
    return '[图片]';
  }
  if (trimmed.startsWith('[STICKER:') && trimmed.endsWith(']')) return '[表情]';
  if (trimmed.startsWith('[IMAGE:') && trimmed.endsWith(']')) return '[图片]';
  if (trimmed.startsWith('data:image/')) return '[图片]';
  if (/^\[.*\]$/.test(trimmed) && /base64,/.test(trimmed)) return '[图片]';
  const firstLine = trimmed.split('\n')[0] || '';
  const emojiSuffix = emojis && emojis.length > 0 ? ' ' + emojis.join(' ') : '';
  if (firstLine.length > 40) return firstLine.slice(0, 40) + '…' + emojiSuffix;
  return firstLine + emojiSuffix;
}
