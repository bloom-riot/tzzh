import { useState, useRef, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  getRandomReplyCard,
  getRandomReplyCards,
  getReplyCards,
  getReplyCardsByIds,
  addReplyCard as addCardToStorage,
  addReplyCardsBatch,
  updateReplyCard as updateCardInStorage,
  deleteReplyCard as deleteCardFromStorage,
  moveCardCategory as moveCardInStorage,
  saveReplyCards,
  generateId,
  nowIso,
  getProfileSettings,
  saveProfileSettings,
  generateMessageId,
  CHAT_BG_THEMES,
  getCategories,
  addCategory,
  renameCategory,
  deleteCategory,
  getChatConfig,
  saveChatConfig,
  getRhythmConfig,
  saveRhythmConfig,
  getEmojiLib,
  addEmoji,
  removeEmoji,
  getKaomojiLib,
  addKaomoji,
  removeKaomoji,
  getBlockedCardIds,
  blockCards as blockCardsInStorage,
  unblockCards as unblockCardsInStorage,
  type ProfileSettings,
  type CardCategory,
  type ChatConfigSettings,
  type RhythmConfigSettings,
  type VibeTextItem,
  type MyStatusState,
  type CustomBgItem,
  getPatPats,
  addPatPat,
  deletePatPat,
  getUserPatActions,
  addUserPatAction,
  deleteUserPatAction,
  getTaStatuses,
  addTaStatus,
  deleteTaStatus,
  getRandomTaStatus,
  getCachedTaStatus,
  setCachedTaStatus,
  getTopMottos,
  addTopMotto,
  deleteTopMotto,
  getDailyAnnouncements,
  addDailyAnnouncement,
  deleteDailyAnnouncement,
  getLetterTexts,
  addLetterText,
  deleteLetterText,
  getRandomLetterText,
  getCustomBackgrounds,
  addCustomBackground as addCustomBgStorage,
  deleteCustomBackground as deleteCustomBgStorage,
  getMyStatus as getMyStatusStorage,
  saveMyStatus as saveMyStatusStorage,
  getSoundConfig,
  saveSoundConfig,
} from '@client/src/utils/local-storage';
import {
  getAllMessages as idbGetAllMessages,
  addMessage as idbAddMessage,
  putMessage as idbPutMessage,
  deleteMessage as idbDeleteMessage,
  clearAllMessages as idbClearAllMessages,
  getAllStickers as idbGetAllStickers,
  addStickerRecord as idbAddSticker,
  removeStickerRecord as idbRemoveSticker,
  getImage as idbGetImage,
  putImage as idbPutImage,
  deleteImage as idbDeleteImage,
  migrateMessagesFromLocalStorage,
  migrateStickersFromLocalStorage,
  migrateProfileImagesFromLocalStorage,
  type StickerRecord,
} from '@client/src/utils/indexed-db';

const DEFAULT_BG_THEME = 'classic';
import type { ChatMessage, ReplyCard } from '@shared/api.interface';
import { updateSoundConfig as applySoundConfig } from '@client/src/utils/sound-manager';

const FALLBACK_TA_NAME = 'TA';
const FALLBACK_CONTENT = '今天也要开心哦~';

const TA_AVATAR_SVG = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
    '<defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#ffb6c1"/>' +
    '<stop offset="100%" stop-color="#f086a5"/>' +
    '</linearGradient></defs>' +
    '<rect width="80" height="80" fill="url(#tg)"/>' +
    '<circle cx="40" cy="32" r="12" fill="#fff" opacity="0.9"/>' +
    '<path d="M20 68 Q40 48 60 68" fill="#fff" opacity="0.9"/>' +
    '</svg>'
  );

const MY_AVATAR_SVG = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
    '<defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#86b7fe"/>' +
    '<stop offset="100%" stop-color="#5b9bd5"/>' +
    '</linearGradient></defs>' +
    '<rect width="80" height="80" fill="url(#mg)"/>' +
    '<circle cx="40" cy="32" r="12" fill="#fff" opacity="0.9"/>' +
    '<path d="M20 68 Q40 48 60 68" fill="#fff" opacity="0.9"/>' +
    '</svg>'
  );

const DEFAULT_TA_AVATAR = TA_AVATAR_SVG;
const DEFAULT_MY_AVATAR = MY_AVATAR_SVG;

function isValidAvatarUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (trimmed.startsWith('blob:')) return false;
  if (trimmed.startsWith('filesystem:')) return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function sanitizeProfile(profile: ProfileSettings): ProfileSettings {
  const safe: ProfileSettings = { ...profile };
  if (typeof safe.taName !== 'string') safe.taName = 'TA';
  if (typeof safe.myName !== 'string') safe.myName = '我';
  if (typeof safe.taTitle !== 'string') safe.taTitle = '在线';
  if (typeof safe.taAvatar !== 'string') safe.taAvatar = '';
  if (typeof safe.myAvatar !== 'string') safe.myAvatar = '';
  if (typeof safe.chatBg !== 'string') safe.chatBg = '';
  return safe;
}

function ensureAvatar(url: string, fallback: string): string {
  if (!url) return fallback;
  if (!isValidAvatarUrl(url)) return fallback;
  return url;
}

let messageCache: ChatMessage[] | null = null;
let messageCacheReady = false;
const pendingMessageIds = new Set<string>();

const messageCacheSubscribers = new Set<(list: ChatMessage[]) => void>();

function updateMessageCache(next: ChatMessage[]) {
  messageCache = next;
  messageCacheReady = true;
  messageCacheSubscribers.forEach((fn) => {
    try { fn(next); } catch { /* ignore */ }
  });
}

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => messageCache ?? []);
  const [loading, setLoading] = useState(!messageCacheReady);
  const migratedRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>(messageCache ?? []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const subscriber = (list: ChatMessage[]) => {
      messagesRef.current = list;
      setMessages(list);
    };
    messageCacheSubscribers.add(subscriber);
    return () => { messageCacheSubscribers.delete(subscriber); };
  }, []);

   useEffect(() => {
     let cancelled = false;
     (async () => {
       try {
         if (!migratedRef.current) {
           migratedRef.current = true;
           await migrateMessagesFromLocalStorage();
         }
         const list = await idbGetAllMessages();
         if (!cancelled) {
           if (pendingMessageIds.size > 0) {
             const pendingMsgs = (messageCache ?? []).filter((m: ChatMessage) => pendingMessageIds.has(m.id));
             const merged: ChatMessage[] = [...list];
             for (const pm of pendingMsgs) {
               if (!merged.some((m: ChatMessage) => m.id === pm.id)) {
                 merged.push(pm);
               }
             }
             merged.sort((a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt));
             updateMessageCache(merged);
             logger.info(`[message-lifecycle] initial load: loaded ${list.length} from IDB, merged ${pendingMsgs.length} pending, total=${merged.length}`);
           } else {
             updateMessageCache(list);
             logger.info(`[message-lifecycle] initial load: ${list.length} messages from IDB, no pending`);
           }
           setLoading(false);
         }
       } catch (err) {
         logger.error('初始化聊天记录失败', err);
         if (!cancelled) {
           if (!messageCacheReady) updateMessageCache([]);
           setLoading(false);
         }
       }
     })();
     return () => { cancelled = true; };
   }, []);

  const appendMessage = useCallback((msg: ChatMessage): Promise<ChatMessage | null> => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const curr = messageCache ?? [];
    const last = curr.length > 0 ? curr[curr.length - 1] : null;
    const needInsertInOrder = last && msg.createdAt < last.createdAt;
    const next = needInsertInOrder
      ? [...curr, msg].sort((a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt))
      : [...curr, msg];

    pendingMessageIds.add(msg.id);
    logger.info(`[message-lifecycle] appendMessage: msg ${msg.id.slice(0, 8)}..., sender=${msg.sender}, optimistic update, total=${next.length}, pending=${pendingMessageIds.size}`);

    updateMessageCache(next);
    const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
    logger.info(`[send-perf-deep] appendMessage: optimistic update done in ${(t1 - t0).toFixed(1)}ms, total=${next.length} msgs`);

    // IDB 写入在后台进行，不阻塞 UI；调用方可选择是否 await
    const writePromise = idbAddMessage(msg)
      .then(() => {
        pendingMessageIds.delete(msg.id);
        logger.info(`[message-lifecycle] appendMessage: IDB write done, msg ${msg.id.slice(0, 8)}..., pendingLeft=${pendingMessageIds.size}`);
        return msg;
      })
      .catch((err) => {
        logger.error('[message-lifecycle] 消息写入IDB失败（保留在UI中）', err);
        pendingMessageIds.delete(msg.id);
        return null;
      });

    return writePromise;
  }, []);

  const addUserMessage = useCallback((content: string, quoteTo?: string | null, quoteContent?: string | null, quoteSender?: 'me' | 'ta' | null): ChatMessage => {
    const msg: ChatMessage = {
      id: generateMessageId(),
      content,
      sender: 'me',
      createdAt: new Date().toISOString(),
      quoteTo: quoteTo || null,
      quoteContent: quoteContent || null,
      quoteSender: quoteSender || null,
      isRead: false,
      readAt: null,
    };
    // 乐观更新：同步更新 UI，IDB 写入在后台异步进行，不阻塞
    // appendMessage 返回 Promise，但调用方不需要等待即可拿到完整消息对象
    void appendMessage(msg);
    return msg;
  }, [appendMessage]);

  const addTaReply = useCallback(async (categoryId = 'all', quoteTo?: string | null, quoteContent?: string | null, quoteSender?: 'me' | 'ta' | null): Promise<ChatMessage | null> => {
    try {
      const card = getRandomReplyCard(categoryId);
      const content = card ? card.content : FALLBACK_CONTENT;
      const msg: ChatMessage = {
        id: generateMessageId(),
        content,
        sender: 'ta',
        replyCardId: card?.id ?? null,
        createdAt: new Date().toISOString(),
        quoteTo: quoteTo || null,
        quoteContent: quoteContent || null,
        quoteSender: quoteSender || null,
        isRead: false,
        readAt: null,
      };
      await appendMessage(msg);
      return msg;
    } catch (error) {
      logger.error('TA 回复失败', error);
      const fallbackMsg: ChatMessage = {
        id: generateMessageId(),
        content: FALLBACK_CONTENT,
        sender: 'ta',
        replyCardId: null,
        createdAt: new Date().toISOString(),
        isRead: false,
        readAt: null,
      };
      await appendMessage(fallbackMsg);
      return fallbackMsg;
    }
  }, [appendMessage]);

  const appendTaMessage = useCallback(async (content: string, replyCardId?: string | null, quoteTo?: string | null, quoteContent?: string | null, quoteSender?: 'me' | 'ta' | null, messageId?: string, stickerUrl?: string | null, emojis?: string[] | null): Promise<ChatMessage | null> => {
    const msg: ChatMessage = {
      id: messageId || generateMessageId(),
      content,
      sender: 'ta',
      replyCardId: replyCardId ?? null,
      createdAt: new Date().toISOString(),
      quoteTo: quoteTo || null,
      quoteContent: quoteContent || null,
      quoteSender: quoteSender || null,
      isRead: false,
      readAt: null,
      stickerUrl: stickerUrl ?? null,
      emojis: emojis ?? null,
    };
    await appendMessage(msg);
    return msg;
  }, [appendMessage]);

  const markMessagesRead = useCallback(async (beforeTime: string): Promise<boolean> => {
    const all = messagesRef.current;
    const beforeTs = new Date(beforeTime).getTime();
    let changed = false;
    const next = all.map((m) => {
      if (m.sender === 'me' && !m.isRead && new Date(m.createdAt).getTime() <= beforeTs) {
        changed = true;
        return { ...m, isRead: true, readAt: new Date().toISOString() };
      }
      return m;
    });
    if (!changed) return false;
    try {
      await Promise.all(
        next.filter((m, i) => m !== all[i]).map((m) => idbPutMessage(m))
      );
      messagesRef.current = next;
      updateMessageCache(next);
      return true;
    } catch (err) {
      logger.error('标记已读失败', err);
      return false;
    }
  }, []);

  const deleteMessageById = useCallback(async (id: string): Promise<boolean> => {
    try {
      await idbDeleteMessage(id);
      const next = messagesRef.current.filter((m) => m.id !== id);
      messagesRef.current = next;
      updateMessageCache(next);
      return true;
    } catch (err) {
      logger.error('删除消息失败', err);
      return false;
    }
  }, []);

  const recallMessage = useCallback(async (id: string): Promise<boolean> => {
    const all = messagesRef.current;
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) return false;
    const recalled: ChatMessage = {
      ...all[idx],
      isRecalled: true,
      recalledAt: new Date().toISOString(),
    };
    try {
      await idbPutMessage(recalled);
      const next = [...all];
      next[idx] = recalled;
      messagesRef.current = next;
      updateMessageCache(next);
      return true;
    } catch (err) {
      logger.error('撤回消息失败', err);
      return false;
    }
  }, []);

  const reloadMessages = useCallback(async () => {
    try {
      const list = await idbGetAllMessages();
      messagesRef.current = list;
      updateMessageCache(list);
    } catch (err) {
      logger.error('重新加载消息失败', err);
    }
  }, []);

  const clearAllMessages = useCallback(async () => {
    try {
      await idbClearAllMessages();
      messagesRef.current = [];
      updateMessageCache([]);
    } catch (err) {
      logger.error('清空消息失败', err);
    }
  }, []);

  const addPatMessage = useCallback(async (content: string): Promise<ChatMessage | null> => {
    const msg: ChatMessage = {
      id: generateMessageId(),
      content,
      sender: 'system',
      type: 'pat',
      replyCardId: null,
      createdAt: new Date().toISOString(),
      quoteTo: null,
      quoteContent: null,
      quoteSender: null,
      isRead: true,
      readAt: new Date().toISOString(),
    };
    await appendMessage(msg);
    return msg;
  }, [appendMessage]);

  const addSystemMessage = useCallback(async (content: string, opts?: { callType?: ChatMessage['callType']; callDuration?: number }): Promise<ChatMessage | null> => {
    const msg: ChatMessage = {
      id: generateMessageId(),
      content,
      sender: 'system',
      type: 'system',
      callType: opts?.callType,
      callDuration: opts?.callDuration,
      replyCardId: null,
      createdAt: new Date().toISOString(),
      quoteTo: null,
      quoteContent: null,
      quoteSender: null,
      isRead: true,
      readAt: new Date().toISOString(),
    };
    await appendMessage(msg);
    return msg;
  }, [appendMessage]);

  return { messages, loading, addUserMessage, addTaReply, appendTaMessage, addPatMessage, addSystemMessage, reloadMessages, clearAllMessages, markMessagesRead, deleteMessageById, recallMessage };
}

let replyCardsCache: ReplyCard[] | null = null;

export function useReplyCards() {
  const cardsRef = useRef<ReplyCard[]>(replyCardsCache ?? []);
  const [version, setVersion] = useState(0);
  const initialized = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const pendingCardsRef = useRef<ReplyCard[] | null>(null);

  const triggerUpdate = useCallback((next: ReplyCard[]) => {
    cardsRef.current = next;
    replyCardsCache = next;
    setVersion((v) => v + 1);
  }, []);

  const schedulePersist = useCallback((cards: ReplyCard[]) => {
    pendingCardsRef.current = cards;
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      const toWrite = pendingCardsRef.current;
      pendingCardsRef.current = null;
      if (toWrite) {
        saveReplyCards(toWrite);
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (replyCardsCache && replyCardsCache.length > 0) {
        cardsRef.current = replyCardsCache;
        setVersion((v) => v + 1);
        return;
      }
      try {
        const existing = getReplyCards();
        if (existing.length === 0) {
          const defaults: ReplyCard[] = [
            { id: generateId(), content: '今天也要开心哦~', category: 'default', createdAt: nowIso(), updatedAt: nowIso() },
            { id: generateId(), content: '我想你了', category: 'default', createdAt: nowIso(), updatedAt: nowIso() },
            { id: generateId(), content: '早点休息，别太累', category: 'default', createdAt: nowIso(), updatedAt: nowIso() },
            { id: generateId(), content: '晚安，做个好梦', category: 'default', createdAt: nowIso(), updatedAt: nowIso() },
            { id: generateId(), content: '记得多喝水呀', category: 'default', createdAt: nowIso(), updatedAt: nowIso() },
          ];
          cardsRef.current = defaults;
          replyCardsCache = defaults;
          saveReplyCards(defaults);
          setVersion((v) => v + 1);
        } else {
          cardsRef.current = existing;
          replyCardsCache = existing;
          setVersion((v) => v + 1);
        }
      } catch (error) {
        logger.error('读取字卡失败', error);
        cardsRef.current = [];
        replyCardsCache = [];
        setVersion((v) => v + 1);
      }
    }
    return () => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (pendingCardsRef.current) {
        const toWrite = pendingCardsRef.current;
        pendingCardsRef.current = null;
        replyCardsCache = toWrite;
        setTimeout(() => saveReplyCards(toWrite), 0);
      }
    };
  }, [schedulePersist, triggerUpdate]);

  const addCard = useCallback((content: string, category = 'default'): ReplyCard => {
    const now = nowIso();
    const card: ReplyCard = {
      id: generateId(),
      content,
      category,
      createdAt: now,
      updatedAt: now,
    };
    const next = [card, ...cardsRef.current];
    triggerUpdate(next);
    schedulePersist(next);
    return card;
  }, [triggerUpdate, schedulePersist]);

  const addCardsBatch = useCallback((lines: string[], category = 'default'): ReplyCard[] => {
    const now = nowIso();
    const cards: ReplyCard[] = lines
      .filter((l) => l.length > 0)
      .map((content) => ({
        id: generateId(),
        content,
        category,
        createdAt: now,
        updatedAt: now,
      }));
    if (cards.length === 0) return [];
    const next = [...cards, ...cardsRef.current];
    triggerUpdate(next);
    schedulePersist(next);
    return cards;
  }, [triggerUpdate, schedulePersist]);

  const moveCards = useCallback((cardIds: string[], categoryId: string) => {
    const idSet = new Set(cardIds);
    const now = nowIso();
    const next = cardsRef.current.map((c) =>
      idSet.has(c.id) ? { ...c, category: categoryId, updatedAt: now } : c
    );
    triggerUpdate(next);
    schedulePersist(next);
  }, [triggerUpdate, schedulePersist]);

  const updateCard = useCallback(
    (id: string, patch: { content?: string; category?: string }) => {
      const idx = cardsRef.current.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const updated: ReplyCard = {
        ...cardsRef.current[idx],
        ...patch,
        updatedAt: nowIso(),
      };
      const next = [...cardsRef.current];
      next[idx] = updated;
      triggerUpdate(next);
      schedulePersist(next);
      return updated;
    },
    [triggerUpdate, schedulePersist]
  );

  const deleteCard = useCallback((id: string) => {
    const next = cardsRef.current.filter((c) => c.id !== id);
    triggerUpdate(next);
    schedulePersist(next);
    return next.length !== cardsRef.current.length;
  }, [triggerUpdate, schedulePersist]);

  const reloadCards = useCallback(() => {
    const existing = getReplyCards();
    triggerUpdate(existing);
  }, [triggerUpdate]);

  const getRandom = useCallback((categoryId?: string): ReplyCard | null => {
    const result = getRandomCards(1, categoryId);
    return result.length > 0 ? result[0] : null;
  }, []);

  const getRandomCards = useCallback((count: number, categoryId?: string): ReplyCard[] => {
    const blocked = getBlockedCardIds();
    const blockedSet = new Set(blocked);
    const byCategory = categoryId && categoryId !== 'all'
      ? cardsRef.current.filter((c) => c.category === categoryId)
      : cardsRef.current;
    const pool = byCategory.filter((c) => !blockedSet.has(c.id));
    const total = cardsRef.current.length;
    const byCatTotal = byCategory.length;
    if (pool.length === 0) {
      logger.info(`[blocked-debug] getRandomCards: total=${total}, byCategory=${byCatTotal}, blocked=${blocked.length}, available=0, returning empty`);
      return [];
    }
    const n = Math.max(1, Math.min(count, pool.length));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const result = shuffled.slice(0, n);
    logger.info(`[blocked-debug] getRandomCards: total=${total}, byCategory=${byCatTotal}, blocked=${blocked.length}, available=${pool.length}, requested=${count}, returned=${result.length}, ids=[${result.map((c) => c.id).slice(0, 3).join(',')}${result.length > 3 ? '...' : ''}]`);
    return result;
  }, []);

  const getCardsByIds = useCallback((ids: string[]): ReplyCard[] => {
    const idSet = new Set(ids);
    return cardsRef.current.filter((c) => idSet.has(c.id));
  }, []);

  return {
    cards: cardsRef.current,
    version,
    addCard,
    addCardsBatch,
    updateCard,
    deleteCard,
    moveCards,
    reloadCards,
    getRandom,
    getRandomCards,
    getCardsByIds,
  };
}

export function useEmojiLib() {
  const [emojis, setEmojis] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setEmojis(getEmojiLib());
    }
  }, []);

  const add = useCallback((emoji: string): string[] => {
    const next = addEmoji(emoji);
    setEmojis(next);
    return next;
  }, []);

  const remove = useCallback((emoji: string): string[] => {
    const next = removeEmoji(emoji);
    setEmojis(next);
    return next;
  }, []);

  const reload = useCallback(() => {
    setEmojis(getEmojiLib());
  }, []);

  return { emojis, addEmoji: add, removeEmoji: remove, reloadEmojis: reload };
}

export function useKaomojiLib() {
  const [kaomojis, setKaomojis] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setKaomojis(getKaomojiLib());
    }
  }, []);

  const add = useCallback((kaomoji: string): string[] => {
    const next = addKaomoji(kaomoji);
    setKaomojis(next);
    return next;
  }, []);

  const remove = useCallback((kaomoji: string): string[] => {
    const next = removeKaomoji(kaomoji);
    setKaomojis(next);
    return next;
  }, []);

  const reload = useCallback(() => {
    setKaomojis(getKaomojiLib());
  }, []);

  return { kaomojis, addKaomoji: add, removeKaomoji: remove, reloadKaomojis: reload };
}

export function useStickerLib() {
  const [stickers, setStickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const migratedRef = useRef(false);
  const stickersRef = useRef<StickerRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!migratedRef.current) {
          migratedRef.current = true;
          await migrateStickersFromLocalStorage();
        }
        const list = await idbGetAllStickers();
        if (!cancelled) {
          stickersRef.current = list;
          setStickers(list.map((s) => s.dataUrl));
        }
      } catch (err) {
        logger.error('初始化表情包失败', err);
        if (!cancelled) setStickers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const add = useCallback(async (dataUrl: string): Promise<string[]> => {
    const record: StickerRecord = {
      id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    try {
      await idbAddSticker(record);
      const next = [...stickersRef.current, record];
      stickersRef.current = next;
      const urls = next.map((s) => s.dataUrl);
      setStickers(urls);
      return urls;
    } catch (err) {
      logger.error('添加表情包失败', err);
      return stickersRef.current.map((s) => s.dataUrl);
    }
  }, []);

  const remove = useCallback(async (stickerUrl: string): Promise<string[]> => {
    const target = stickersRef.current.find((s) => s.dataUrl === stickerUrl);
    if (!target) return stickersRef.current.map((s) => s.dataUrl);
    try {
      await idbRemoveSticker(target.id);
      const next = stickersRef.current.filter((s) => s.id !== target.id);
      stickersRef.current = next;
      const urls = next.map((s) => s.dataUrl);
      setStickers(urls);
      return urls;
    } catch (err) {
      logger.error('删除表情包失败', err);
      return stickersRef.current.map((s) => s.dataUrl);
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await idbGetAllStickers();
      stickersRef.current = list;
      setStickers(list.map((s) => s.dataUrl));
    } catch (err) {
      logger.error('重新加载表情包失败', err);
    }
  }, []);

  return { stickers, loading, addSticker: add, removeSticker: remove, reloadStickers: reload };
}

export function useBlockedCards() {
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setBlockedIds(getBlockedCardIds());
    }
  }, []);

  const block = useCallback((ids: string[]): string[] => {
    const next = blockCardsInStorage(ids);
    setBlockedIds(next);
    return next;
  }, []);

  const unblock = useCallback((ids: string[]): string[] => {
    const next = unblockCardsInStorage(ids);
    setBlockedIds(next);
    return next;
  }, []);

  const isBlocked = useCallback((id: string) => blockedIds.includes(id), [blockedIds]);

  const reload = useCallback(() => {
    setBlockedIds(getBlockedCardIds());
  }, []);

  return { blockedIds, blockCards: block, unblockCards: unblock, isBlocked, reloadBlocked: reload };
}

export function useCategories() {
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      try {
        setCategories(getCategories());
      } catch (error) {
        logger.error('读取分组失败', error);
        setCategories([]);
      }
    }
  }, []);

  const addCat = useCallback((name: string): CardCategory => {
    const cat = addCategory(name);
    setCategories(getCategories());
    return cat;
  }, []);

  const renameCat = useCallback((id: string, name: string) => {
    renameCategory(id, name);
    setCategories(getCategories());
  }, []);

  const deleteCat = useCallback((id: string) => {
    deleteCategory(id);
    setCategories(getCategories());
  }, []);

  const reload = useCallback(() => {
    setCategories(getCategories());
  }, []);

  return { categories, addCategory: addCat, renameCategory: renameCat, deleteCategory: deleteCat, reloadCategories: reload };
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileSettings>(() => getProfileSettings());
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const migratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!migratedRef.current) {
          migratedRef.current = true;
          await migrateProfileImagesFromLocalStorage();
        }
        const [taAvatarRec, myAvatarRec, bgImgRec] = await Promise.all([
          idbGetImage('ta_avatar'),
          idbGetImage('my_avatar'),
          idbGetImage('chat_bg_image'),
        ]);
        if (!cancelled) {
          setProfile((prev) => ({
            ...prev,
            taAvatar: taAvatarRec?.dataUrl ?? prev.taAvatar,
            myAvatar: myAvatarRec?.dataUrl ?? prev.myAvatar,
            chatBgImage: bgImgRec?.dataUrl ?? prev.chatBgImage,
          }));
        }
      } catch (err) {
        logger.error('加载头像和背景图片失败', err);
      } finally {
        if (!cancelled) setImagesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateProfile = useCallback(async (patch: Partial<ProfileSettings>) => {
    const now = new Date().toISOString();
    const lsPatch: Partial<ProfileSettings> = { ...patch };

    if (patch.taAvatar !== undefined) {
      if (patch.taAvatar && patch.taAvatar.startsWith('data:image')) {
        try {
          await idbPutImage({ key: 'ta_avatar', dataUrl: patch.taAvatar, createdAt: now });
        } catch (err) {
          logger.error('保存TA头像失败', err);
        }
      } else if (!patch.taAvatar) {
        try { await idbDeleteImage('ta_avatar'); } catch { /* ignore */ }
      }
      lsPatch.taAvatar = patch.taAvatar;
    }

    if (patch.myAvatar !== undefined) {
      if (patch.myAvatar && patch.myAvatar.startsWith('data:image')) {
        try {
          await idbPutImage({ key: 'my_avatar', dataUrl: patch.myAvatar, createdAt: now });
        } catch (err) {
          logger.error('保存我的头像失败', err);
        }
      } else if (!patch.myAvatar) {
        try { await idbDeleteImage('my_avatar'); } catch { /* ignore */ }
      }
      lsPatch.myAvatar = patch.myAvatar;
    }

    if (patch.chatBgImage !== undefined) {
      if (patch.chatBgImage && patch.chatBgImage.startsWith('data:image')) {
        try {
          await idbPutImage({ key: 'chat_bg_image', dataUrl: patch.chatBgImage, createdAt: now });
        } catch (err) {
          logger.error('保存背景图失败', err);
        }
      } else if (!patch.chatBgImage) {
        try { await idbDeleteImage('chat_bg_image'); } catch { /* ignore */ }
      }
      lsPatch.chatBgImage = patch.chatBgImage;
    }

    const next = saveProfileSettings(lsPatch);
    setProfile(next);
  }, []);

  const reloadProfile = useCallback(async () => {
    const base = getProfileSettings();
    try {
      const [taAvatarRec, myAvatarRec, bgImgRec] = await Promise.all([
        idbGetImage('ta_avatar'),
        idbGetImage('my_avatar'),
        idbGetImage('chat_bg_image'),
      ]);
      setProfile({
        ...base,
        taAvatar: taAvatarRec?.dataUrl ?? base.taAvatar,
        myAvatar: myAvatarRec?.dataUrl ?? base.myAvatar,
        chatBgImage: bgImgRec?.dataUrl ?? base.chatBgImage,
      });
    } catch {
      setProfile(base);
    }
  }, []);

  const taAvatarUrl = ensureAvatar(profile.taAvatar, DEFAULT_TA_AVATAR);
  const myAvatarUrl = ensureAvatar(profile.myAvatar, DEFAULT_MY_AVATAR);

  const chatBgImage = profile.chatBgImage || '';
  const chatBgTheme = CHAT_BG_THEMES.find((t) => t.id === profile.chatBg) ?? CHAT_BG_THEMES[0];
  const chatBgStyle = chatBgImage
    ? { backgroundImage: `url(${chatBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : chatBgTheme.bg.startsWith('linear-gradient') || chatBgTheme.bg.startsWith('radial-gradient')
      ? { background: chatBgTheme.bg }
      : { backgroundColor: chatBgTheme.bg };
  const chatBgThemeId = profile.chatBg || DEFAULT_BG_THEME;
  const replyCategory = profile.replyCategory || 'all';

  return {
    profile,
    updateProfile,
    reloadProfile,
    taAvatarUrl,
    myAvatarUrl,
    chatBgTheme: chatBgThemeId,
    chatBgStyle,
    chatBgImage,
    chatBgThemes: CHAT_BG_THEMES,
    replyCategory,
    FALLBACK_TA_NAME,
    DEFAULT_MY_AVATAR,
    DEFAULT_TA_AVATAR,
  };
}

export { FALLBACK_TA_NAME, DEFAULT_TA_AVATAR, DEFAULT_MY_AVATAR, CHAT_BG_THEMES };
export type { CardCategory, ChatConfigSettings, RhythmConfigSettings, VibeTextItem, MyStatusState };

export function usePatPats() {
  const [items, setItems] = useState<VibeTextItem[]>(() => getPatPats());

  const add = useCallback((content: string) => {
    const item = addPatPat(content);
    setItems(getPatPats());
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    deletePatPat(id);
    setItems(getPatPats());
  }, []);

  return { items, add, remove };
}

export function useUserPatActions() {
  const [items, setItems] = useState<VibeTextItem[]>(() => getUserPatActions());

  const add = useCallback((content: string) => {
    const item = addUserPatAction(content);
    setItems(getUserPatActions());
    return item;
  }, []);

  const addBatch = useCallback((contents: string[]) => {
    const valid = contents.map((s) => s.trim()).filter(Boolean);
    if (valid.length === 0) return;
    for (const c of valid) {
      addUserPatAction(c);
    }
    setItems(getUserPatActions());
  }, []);

  const remove = useCallback((id: string) => {
    deleteUserPatAction(id);
    setItems(getUserPatActions());
  }, []);

  return { items, add, addBatch, remove };
}

export function useTaStatuses() {
  const [items, setItems] = useState<VibeTextItem[]>(() => getTaStatuses());
  const [current, setCurrent] = useState<string>(() => {
    const cached = getCachedTaStatus();
    if (cached !== null) return cached;
    const fresh = getRandomTaStatus();
    setCachedTaStatus(fresh);
    return fresh;
  });

  const add = useCallback((content: string) => {
    const item = addTaStatus(content);
    setItems(getTaStatuses());
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    deleteTaStatus(id);
    setItems(getTaStatuses());
  }, []);

  const refresh = useCallback(() => {
    const fresh = getRandomTaStatus();
    setCachedTaStatus(fresh);
    setCurrent(fresh);
  }, []);

  return { items, current, add, remove, refresh };
}

export function useMyStatus() {
  const [state, setState] = useState<MyStatusState>(() => getMyStatusStorage());
  const [randomDisplay, setRandomDisplay] = useState<string>(() => getRandomTaStatus());

  const displayText = state.mode === 'custom' ? state.customText : randomDisplay;

  const setCustom = useCallback((text: string) => {
    const next: MyStatusState = { mode: 'custom', customText: text };
    saveMyStatusStorage(next);
    setState(next);
  }, []);

  const setRandomMode = useCallback(() => {
    const next: MyStatusState = { ...state, mode: 'random' };
    saveMyStatusStorage(next);
    setState(next);
    setRandomDisplay(getRandomTaStatus());
  }, [state]);

  const refreshRandom = useCallback(() => {
    setRandomDisplay(getRandomTaStatus());
  }, []);

  return { state, displayText, setCustom, setRandomMode, refreshRandom };
}

export function useTopMottos() {
  const [items, setItems] = useState<VibeTextItem[]>(() => getTopMottos());

  const add = useCallback((content: string) => {
    const item = addTopMotto(content);
    setItems(getTopMottos());
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    deleteTopMotto(id);
    setItems(getTopMottos());
  }, []);

  return { items, add, remove };
}

export function useDailyAnnouncements() {
  const [items, setItems] = useState<VibeTextItem[]>(() => getDailyAnnouncements());

  const add = useCallback((content: string) => {
    const item = addDailyAnnouncement(content);
    setItems(getDailyAnnouncements());
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    deleteDailyAnnouncement(id);
    setItems(getDailyAnnouncements());
  }, []);

  return { items, add, remove };
}

export function useLetterTexts() {
  const [items, setItems] = useState<VibeTextItem[]>(() => getLetterTexts());

  const add = useCallback((content: string) => {
    const item = addLetterText(content);
    setItems(getLetterTexts());
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    deleteLetterText(id);
    setItems(getLetterTexts());
  }, []);

  const getRandom = useCallback((): string | null => {
    return getRandomLetterText();
  }, []);

  return { items, add, remove, getRandom };
}

export function useCustomBackgrounds() {
  const [items, setItems] = useState<CustomBgItem[]>(() => getCustomBackgrounds());

  const add = useCallback((dataUrl: string) => {
    const item = addCustomBgStorage(dataUrl);
    setItems(getCustomBackgrounds());
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    deleteCustomBgStorage(id);
    setItems(getCustomBackgrounds());
  }, []);

  return { items, add, remove };
}

export function useChatConfig() {
  const [config, setConfig] = useState<ChatConfigSettings>(() => getChatConfig());

  const updateConfig = useCallback((patch: Partial<ChatConfigSettings>) => {
    const next = saveChatConfig(patch);
    setConfig(next);
  }, []);

  const reloadConfig = useCallback(() => {
    setConfig(getChatConfig());
  }, []);

  return { config, updateConfig, reloadConfig };
}

export function useRhythmConfig() {
  const [config, setConfig] = useState<RhythmConfigSettings>(() => getRhythmConfig());

  const updateConfig = useCallback((patch: Partial<RhythmConfigSettings>) => {
    const next = saveRhythmConfig(patch);
    setConfig(next);
  }, []);

  const reloadConfig = useCallback(() => {
    setConfig(getRhythmConfig());
  }, []);

  return { config, updateConfig, reloadConfig };
}

export function useSoundConfig() {
  const [config, setConfig] = useState(() => getSoundConfig());

  const updateConfig = useCallback((patch: Parameters<typeof saveSoundConfig>[0]) => {
    const next = saveSoundConfig(patch);
    setConfig(next);
    applySoundConfig(next);
  }, []);

  const reloadConfig = useCallback(() => {
    setConfig(getSoundConfig());
  }, []);

  return { config, updateConfig, reloadConfig };
}
