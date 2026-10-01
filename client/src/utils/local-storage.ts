import type { ReplyCard, ChatMessage } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { SoundConfig, SoundSceneName, SoundStyleName, SoundTypeName } from './sound-types';
import { DEFAULT_SOUND_CONFIG, SOUND_STYLE_LIST, STYLE_SCENE_PRESETS, DEFAULT_SCENE_SOUNDS } from './sound-types';

export interface ProfileSettings {
  taName: string;
  myName: string;
  taAvatar: string;
  myAvatar: string;
  chatBg: string;
  chatBgImage: string;
  taTitle: string;
  replyCategory: string;
}

export interface CustomBgItem {
  id: string;
  dataUrl: string;
  createdAt: string;
}

export const CHAT_BG_THEMES: Array<{ id: string; name: string; bg: string }> = [
  { id: 'classic', name: '经典灰', bg: '#ededed' },
  { id: 'warm', name: '暖米色', bg: 'linear-gradient(180deg, #f7efe5 0%, #f0e4d4 100%)' },
  { id: 'lace', name: '蕾丝米白', bg: 'radial-gradient(circle at 20% 20%, rgba(201, 168, 124, 0.08) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(201, 168, 124, 0.08) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(201, 168, 124, 0.04) 0%, transparent 60%), linear-gradient(180deg, #f8f4ed 0%, #f0e9dd 100%)' },
  { id: 'mint', name: '薄荷绿', bg: 'linear-gradient(180deg, #e8f5ef 0%, #d4ebe0 100%)' },
  { id: 'sky', name: '天空蓝', bg: 'linear-gradient(180deg, #e6f0fa 0%, #d0e2f2 100%)' },
  { id: 'rose', name: '玫瑰粉', bg: 'linear-gradient(180deg, #fbe9ef 0%, #f5d6df 100%)' },
  { id: 'night', name: '深夜紫', bg: 'linear-gradient(180deg, #1e1b2e 0%, #2a1f3d 100%)' },
];

const DEFAULT_BG_THEME = 'classic';

const KEY_MESSAGES = 'ta_chat_messages';
const KEY_CARDS = 'ta_reply_cards';
const KEY_PROFILE = 'ta_profile_settings';
const KEY_CATEGORIES = 'ta_card_categories';
const KEY_EMOJI_LIB = 'ta_emoji_library';
const KEY_KAOMOJI_LIB = 'ta_kaomoji_library';
const KEY_STICKER_LIB = 'ta_sticker_library';
const KEY_BLOCKED_CARDS = 'ta_blocked_cards';
const KEY_CHAT_CONFIG = 'ta_chat_config';
const KEY_RHYTHM_CONFIG = 'ta_rhythm_config';
const KEY_CUSTOM_BGS = 'ta_custom_backgrounds';
const KEY_PENDING_REPLY = 'ta_pending_reply';
const KEY_PENDING_LETTER_REPLIES = 'ta_pending_letter_replies';
const KEY_QUESTIONNAIRES = 'ta_questionnaires';
const KEY_PENDING_QUESTIONNAIRE_REPLIES = 'ta_pending_questionnaire_replies';
const KEY_SENT_MESSAGE_IDS = 'ta_sent_message_ids';
const KEY_LAST_PROACTIVE_SENT_AT = 'ta_last_proactive_sent_at';
const KEY_LAST_PAT_PROACTIVE_AT = 'ta_last_pat_proactive_at';
const KEY_LAST_CALL_PROACTIVE_AT = 'ta_last_call_proactive_at';
const KEY_LAST_DAILY_LETTER_DATE = 'ta_last_daily_letter_date';
const KEY_VIBE_PAT_PATS = 'ta_vibe_pat_pats';
const KEY_USER_PAT_ACTIONS = 'user_pat_actions';
const KEY_VIBE_TA_STATUSES = 'ta_vibe_ta_statuses';
const KEY_VIBE_TA_STATUS_CACHE = 'ta_vibe_ta_status_cache';
const KEY_VIBE_MY_STATUS = 'ta_vibe_my_status';
const KEY_VIBE_SURVEY = 'ta_vibe_survey_questions';
const KEY_VIBE_PERIOD = 'ta_vibe_period';
const KEY_VIBE_TOP_MOTTO = 'ta_vibe_top_motto';
const KEY_VIBE_INTRO = 'ta_vibe_intro_animation';
const KEY_VIBE_DAILY_ANNOUNCEMENT = 'ta_vibe_daily_announcement';
  const KEY_VIBE_LETTERS = 'ta_vibe_letters';
  const KEY_SOUND_CONFIG = 'ta_sound_config';


export interface RhythmConfigSettings {
  replyMinSeconds: number;
  replyMaxSeconds: number;
  surveyMinSeconds: number;
  surveyMaxSeconds: number;
  proactiveEnabled: boolean;
  proactiveIntervalMinutes: number;
  emojiMixEnabled: boolean;
  concatEnabled: boolean;
  concatMaxSentences: number;
  backgroundPushEnabled: boolean;
  backgroundKeepAlive: boolean;
  patPatEnabled: boolean;
  patPatFrequency: number;
  concatProbability: number;
  emojiReplyProbability: number;
  stickerReplyProbability: number;
  imageReplyProbability: number;
  quoteReplyProbability: number;
  recallProbability: number;
  incomingCallProbability: number;
   letterReplyMinSeconds: number;
   letterReplyMaxSeconds: number;
   letterReplyCount: number;
   letterProactiveProbability: number;
   minReplyCount: number;
   maxReplyCount: number;
   questionnaireReplyMinHours: number;
   questionnaireReplyMaxHours: number;
 }

export const DEFAULT_RHYTHM_CONFIG: RhythmConfigSettings = {
  replyMinSeconds: 10,
  replyMaxSeconds: 180,
  surveyMinSeconds: 1,
  surveyMaxSeconds: 1800,
  proactiveEnabled: false,
  proactiveIntervalMinutes: 180,
  emojiMixEnabled: false,
  concatEnabled: false,
  concatMaxSentences: 2,
  backgroundPushEnabled: false,
  backgroundKeepAlive: false,
  patPatEnabled: true,
  patPatFrequency: 30,
  concatProbability: 75,
  emojiReplyProbability: 20,
  stickerReplyProbability: 0,
  imageReplyProbability: 0,
  quoteReplyProbability: 30,
  recallProbability: 5,
  incomingCallProbability: 5,
   letterReplyMinSeconds: 10,
   letterReplyMaxSeconds: 60,
   letterReplyCount: 1,
   letterProactiveProbability: 5,
   minReplyCount: 1,
   maxReplyCount: 1,
   questionnaireReplyMinHours: 1,
   questionnaireReplyMaxHours: 24,
 };

export interface ChatConfigSettings {
  quoteReply: boolean;
  readReceipt: boolean;
  readWithoutReply: boolean;
  readWithoutReplyRate: number;
  typingIndicator: boolean;
  typingShowAvatar: boolean;
  typingCustomText: string;
  readDelaySeconds: number;
  patDecor?: {
    mine: string;
    theirs: string;
  };
}

export const DEFAULT_CHAT_CONFIG: ChatConfigSettings = {
  quoteReply: true,
  readReceipt: true,
  readWithoutReply: false,
  readWithoutReplyRate: 10,
  typingIndicator: true,
  typingShowAvatar: true,
  typingCustomText: '正在输入…',
  readDelaySeconds: 3,
  patDecor: {
    mine: '',
    theirs: '♡',
  },
};

export const DEFAULT_TYPING_TEXT = '正在输入…';

const DEFAULT_PROFILE: ProfileSettings = {
  taName: 'TA',
  myName: '我',
  taAvatar: '',
  myAvatar: '',
  chatBg: DEFAULT_BG_THEME,
  chatBgImage: '',
  taTitle: '在线',
  replyCategory: 'all',
};

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (typeof console !== 'undefined') {
      logger.warn('localStorage 写入失败', String(error));
    }
    return false;
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getMessages(): ChatMessage[] {
  const raw = safeGetItem(KEY_MESSAGES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]): boolean {
  return safeSetItem(KEY_MESSAGES, JSON.stringify(messages));
}

export function appendMessage(message: ChatMessage): ChatMessage[] {
  const all = getMessages();
  const next = [...all, message];
  const ok = safeSetItem(KEY_MESSAGES, JSON.stringify(next));
  return ok ? next : all;
}

export function clearMessages(): boolean {
  return safeSetItem(KEY_MESSAGES, JSON.stringify([]));
}

export function getReplyCards(): ReplyCard[] {
  const raw = safeGetItem(KEY_CARDS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ReplyCard[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReplyCards(cards: ReplyCard[]): boolean {
  return safeSetItem(KEY_CARDS, JSON.stringify(cards));
}

export function addReplyCard(content: string, category = 'default'): ReplyCard {
  const now = nowIso();
  const card: ReplyCard = {
    id: generateId(),
    content,
    category,
    createdAt: now,
    updatedAt: now,
  };
  const all = getReplyCards();
  saveReplyCards([card, ...all]);
  return card;
}

export function updateReplyCard(id: string, patch: { content?: string; category?: string }): ReplyCard | null {
  const all = getReplyCards();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated: ReplyCard = {
    ...all[idx],
    ...patch,
    updatedAt: nowIso(),
  };
  const next = [...all];
  next[idx] = updated;
  saveReplyCards(next);
  return updated;
}

export function deleteReplyCard(id: string): boolean {
  const all = getReplyCards();
  const next = all.filter((c) => c.id !== id);
  saveReplyCards(next);
  return next.length !== all.length;
}

export function replaceAllCards(cards: ReplyCard[]): boolean {
  return saveReplyCards(cards);
}

export const DEFAULT_EMOJI_LIB = [
  '😊', '😆', '🥰', '😘', '🤗', '😌', '🥺', '😋',
  '😎', '🤭', '😏', '💖', '💕', '✨', '🌙', '🌸',
  '🍀', '☕', '🎀', '💭', '🤍', '🌷', '🦋', '💫',
];

export const DEFAULT_KAOMOJI_LIB = [
  '(^ω^)',
  '(´･ω･`)',
  '(=^･ω･^=)',
  '♡',
  '(｡･ω･｡)',
  '(*´∀`)',
  '(´,,•ω•,,)♡',
  '(≧▽≦)',
  'o(≧v≦)o',
  '(✿◠‿◠)',
];

export function getEmojiLib(): string[] {
  const raw = safeGetItem(KEY_EMOJI_LIB);
  if (!raw) return [...DEFAULT_EMOJI_LIB];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_EMOJI_LIB];
  } catch {
    return [...DEFAULT_EMOJI_LIB];
  }
}

export function saveEmojiLib(list: string[]): boolean {
  return safeSetItem(KEY_EMOJI_LIB, JSON.stringify(list));
}

export function addEmoji(emoji: string): string[] {
  const trimmed = emoji.trim();
  if (!trimmed) return getEmojiLib();
  const all = getEmojiLib();
  if (all.includes(trimmed)) return all;
  const next = [...all, trimmed];
  saveEmojiLib(next);
  return next;
}

export function removeEmoji(emoji: string): string[] {
  const all = getEmojiLib();
  const next = all.filter((e) => e !== emoji);
  if (next.length === all.length) return all;
  saveEmojiLib(next);
  return next;
}

export function getKaomojiLib(): string[] {
  const raw = safeGetItem(KEY_KAOMOJI_LIB);
  if (!raw) return [...DEFAULT_KAOMOJI_LIB];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_KAOMOJI_LIB];
  } catch {
    return [...DEFAULT_KAOMOJI_LIB];
  }
}

export function saveKaomojiLib(list: string[]): boolean {
  return safeSetItem(KEY_KAOMOJI_LIB, JSON.stringify(list));
}

export function addKaomoji(kaomoji: string): string[] {
  const trimmed = kaomoji.trim();
  if (!trimmed) return getKaomojiLib();
  const all = getKaomojiLib();
  if (all.includes(trimmed)) return all;
  const next = [...all, trimmed];
  saveKaomojiLib(next);
  return next;
}

export function removeKaomoji(kaomoji: string): string[] {
  const all = getKaomojiLib();
  const next = all.filter((k) => k !== kaomoji);
  if (next.length === all.length) return all;
  saveKaomojiLib(next);
  return next;
}

export function getRandomEmoji(count = 1): string[] {
  const pool = getEmojiLib();
  if (pool.length === 0) return [];
  const n = Math.max(1, Math.min(count, pool.length));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function getRandomKaomoji(count = 1): string[] {
  const pool = getKaomojiLib();
  if (pool.length === 0) return [];
  const n = Math.max(1, Math.min(count, pool.length));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function getStickerLib(): string[] {
  const raw = safeGetItem(KEY_STICKER_LIB);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStickerLib(list: string[]): boolean {
  return safeSetItem(KEY_STICKER_LIB, JSON.stringify(list));
}

export function addSticker(sticker: string): string[] {
  if (!sticker) return getStickerLib();
  const all = getStickerLib();
  if (all.includes(sticker)) return all;
  const next = [...all, sticker];
  saveStickerLib(next);
  return next;
}

export function removeSticker(sticker: string): string[] {
  const all = getStickerLib();
  const next = all.filter((s) => s !== sticker);
  if (next.length === all.length) return all;
  saveStickerLib(next);
  return next;
}

export function getRandomSticker(count = 1): string[] {
  const pool = getStickerLib();
  if (pool.length === 0) return [];
  const n = Math.max(1, Math.min(count, pool.length));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function getBlockedCardIds(): string[] {
  const raw = safeGetItem(KEY_BLOCKED_CARDS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBlockedCardIds(ids: string[]): boolean {
  return safeSetItem(KEY_BLOCKED_CARDS, JSON.stringify(ids));
}

export function blockCards(ids: string[]): string[] {
  const current = getBlockedCardIds();
  const set = new Set(current);
  ids.forEach((id) => set.add(id));
  const next = Array.from(set);
  saveBlockedCardIds(next);
  return next;
}

export function unblockCards(ids: string[]): string[] {
  const current = getBlockedCardIds();
  const set = new Set(current);
  ids.forEach((id) => set.delete(id));
  const next = Array.from(set);
  saveBlockedCardIds(next);
  return next;
}

export const EMOJI_POOL = DEFAULT_EMOJI_LIB;

export function getRandomReplyCard(categoryId?: string): ReplyCard | null {
  let all = getReplyCards();
  if (categoryId && categoryId !== 'all') {
    all = all.filter((c) => c.category === categoryId);
  }
  const blocked = getBlockedCardIds();
  if (blocked.length > 0) {
    all = all.filter((c) => !blocked.includes(c.id));
  }
  if (all.length === 0) return null;
  const idx = Math.floor(Math.random() * all.length);
  return all[idx];
}

export function getReplyCardsByIds(ids: string[]): ReplyCard[] {
  const all = getReplyCards();
  const map = new Map(all.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter((c): c is ReplyCard => Boolean(c));
}

export function getRandomReplyCards(count: number, categoryId?: string): ReplyCard[] {
  let all = getReplyCards();
  if (categoryId && categoryId !== 'all') {
    all = all.filter((c) => c.category === categoryId);
  }
  const blocked = getBlockedCardIds();
  if (blocked.length > 0) {
    all = all.filter((c) => !blocked.includes(c.id));
  }
  if (all.length === 0) return [];
  const n = Math.max(1, Math.min(count, all.length));
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function addReplyCardsBatch(lines: string[], category = 'default'): ReplyCard[] {
  const now = nowIso();
  const cards: ReplyCard[] = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((content) => ({
      id: generateId(),
      content,
      category,
      createdAt: now,
      updatedAt: now,
    }));
  if (cards.length === 0) return [];
  const all = getReplyCards();
  saveReplyCards([...cards, ...all]);
  return cards;
}

export function moveCardCategory(cardIds: string[], categoryId: string): boolean {
  const all = getReplyCards();
  const idSet = new Set(cardIds);
  const now = nowIso();
  const next = all.map((c) =>
    idSet.has(c.id) ? { ...c, category: categoryId, updatedAt: now } : c
  );
  saveReplyCards(next);
  return true;
}

export interface CardCategory {
  id: string;
  name: string;
}

const DEFAULT_CATEGORIES: CardCategory[] = [
  { id: 'default', name: '默认' },
];

export function getCategories(): CardCategory[] {
  const raw = safeGetItem(KEY_CATEGORIES);
  if (!raw) return [...DEFAULT_CATEGORIES];
  try {
    const parsed = JSON.parse(raw) as CardCategory[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...DEFAULT_CATEGORIES];
    }
    return parsed;
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export function saveCategories(categories: CardCategory[]): boolean {
  return safeSetItem(KEY_CATEGORIES, JSON.stringify(categories));
}

export function addCategory(name: string): CardCategory {
  const trimmed = name.trim();
  const all = getCategories();
  const cat: CardCategory = {
    id: generateId(),
    name: trimmed || '新分组',
  };
  const next = [...all, cat];
  saveCategories(next);
  return cat;
}

export function renameCategory(id: string, name: string): CardCategory | null {
  const all = getCategories();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const next = [...all];
  next[idx] = { ...next[idx], name: name.trim() || next[idx].name };
  saveCategories(next);
  return next[idx];
}

export function deleteCategory(id: string): boolean {
  if (id === 'default') return false;
  const all = getCategories();
  const next = all.filter((c) => c.id !== id);
  if (next.length === 0) return false;
  saveCategories(next);
  const cards = getReplyCards();
  const moved = cards.map((c) =>
    c.category === id ? { ...c, category: 'default' } : c
  );
  saveReplyCards(moved);
  return true;
}

function isValidImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (trimmed.startsWith('blob:')) return false;
  if (trimmed.startsWith('filesystem:')) return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function isValidBgTheme(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value === 'custom') return true;
  return CHAT_BG_THEMES.some((t) => t.id === value);
}

export function getProfileSettings(): ProfileSettings {
  const raw = safeGetItem(KEY_PROFILE);
  if (!raw) return { ...DEFAULT_PROFILE };
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    const merged = { ...DEFAULT_PROFILE, ...parsed };
    let needsClean = false;
    if (merged.taAvatar && !isValidImageUrl(merged.taAvatar)) {
      merged.taAvatar = '';
      needsClean = true;
    }
    if (merged.myAvatar && !isValidImageUrl(merged.myAvatar)) {
      merged.myAvatar = '';
      needsClean = true;
    }
    if (!isValidBgTheme(merged.chatBg)) {
      merged.chatBg = DEFAULT_BG_THEME;
      needsClean = true;
    }
    if (typeof merged.taName !== 'string') { merged.taName = 'TA'; needsClean = true; }
    if (typeof merged.myName !== 'string') { merged.myName = '我'; needsClean = true; }
    if (typeof merged.taTitle !== 'string') { merged.taTitle = '在线'; needsClean = true; }
    if (typeof merged.chatBgImage !== 'string') { merged.chatBgImage = ''; needsClean = true; }
    if (merged.chatBgImage && !merged.chatBgImage.startsWith('data:image/')) {
      merged.chatBgImage = '';
      needsClean = true;
    }
    if (typeof merged.replyCategory !== 'string') { merged.replyCategory = 'all'; needsClean = true; }
    if (needsClean) {
      safeSetItem(KEY_PROFILE, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfileSettings(settings: Partial<ProfileSettings>): ProfileSettings {
  const current = getProfileSettings();
  const raw: Partial<ProfileSettings> = { ...settings };
  if (raw.taName !== undefined && typeof raw.taName !== 'string') raw.taName = String(raw.taName);
  if (raw.myName !== undefined && typeof raw.myName !== 'string') raw.myName = String(raw.myName);
  if (raw.taTitle !== undefined && typeof raw.taTitle !== 'string') raw.taTitle = String(raw.taTitle);
  if (raw.taAvatar !== undefined) {
    if (typeof raw.taAvatar !== 'string' || !isValidImageUrl(raw.taAvatar)) raw.taAvatar = '';
  }
  if (raw.myAvatar !== undefined) {
    if (typeof raw.myAvatar !== 'string' || !isValidImageUrl(raw.myAvatar)) raw.myAvatar = '';
  }
  if (raw.chatBg !== undefined) {
    if (!isValidBgTheme(raw.chatBg)) raw.chatBg = DEFAULT_BG_THEME;
  }
  if (raw.chatBgImage !== undefined) {
    if (typeof raw.chatBgImage !== 'string' || !raw.chatBgImage.startsWith('data:image/')) {
      raw.chatBgImage = '';
    }
  }
  if (raw.replyCategory !== undefined && typeof raw.replyCategory !== 'string') {
    raw.replyCategory = 'all';
  }
  const next = { ...current, ...raw };
  safeSetItem(KEY_PROFILE, JSON.stringify(next));
  return next;
}

export function resetProfileSettings(): ProfileSettings {
  safeSetItem(KEY_PROFILE, JSON.stringify(DEFAULT_PROFILE));
  return { ...DEFAULT_PROFILE };
}

export function getChatConfig(): ChatConfigSettings {
  const raw = safeGetItem(KEY_CHAT_CONFIG);
  if (!raw) return { ...DEFAULT_CHAT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<ChatConfigSettings>;
    const clampNum = (v: unknown, min: number, max: number, fallback: number): number => {
      const n = Number(v);
      if (Number.isNaN(n) || n < min || n > max) return fallback;
      return n;
    };
    return {
      quoteReply: typeof parsed.quoteReply === 'boolean' ? parsed.quoteReply : DEFAULT_CHAT_CONFIG.quoteReply,
      readReceipt: typeof parsed.readReceipt === 'boolean' ? parsed.readReceipt : DEFAULT_CHAT_CONFIG.readReceipt,
      readWithoutReply: typeof parsed.readWithoutReply === 'boolean' ? parsed.readWithoutReply : DEFAULT_CHAT_CONFIG.readWithoutReply,
      readWithoutReplyRate: clampNum(parsed.readWithoutReplyRate, 0, 50, DEFAULT_CHAT_CONFIG.readWithoutReplyRate),
      typingIndicator: typeof parsed.typingIndicator === 'boolean' ? parsed.typingIndicator : DEFAULT_CHAT_CONFIG.typingIndicator,
      typingShowAvatar: typeof parsed.typingShowAvatar === 'boolean' ? parsed.typingShowAvatar : DEFAULT_CHAT_CONFIG.typingShowAvatar,
      typingCustomText: typeof parsed.typingCustomText === 'string' ? parsed.typingCustomText : DEFAULT_CHAT_CONFIG.typingCustomText,
      readDelaySeconds: clampNum(parsed.readDelaySeconds, 0.5, 30, DEFAULT_CHAT_CONFIG.readDelaySeconds),
      patDecor: {
        mine: typeof parsed.patDecor?.mine === 'string' ? parsed.patDecor.mine : DEFAULT_CHAT_CONFIG.patDecor.mine,
        theirs: typeof parsed.patDecor?.theirs === 'string' ? parsed.patDecor.theirs : DEFAULT_CHAT_CONFIG.patDecor.theirs,
      },
    };
  } catch {
    return { ...DEFAULT_CHAT_CONFIG };
  }
}

export function saveChatConfig(patch: Partial<ChatConfigSettings>): ChatConfigSettings {
  const current = getChatConfig();
  const next = { ...current, ...patch };
  safeSetItem(KEY_CHAT_CONFIG, JSON.stringify(next));
  return next;
}

export function getRhythmConfig(): RhythmConfigSettings {
  const raw = safeGetItem(KEY_RHYTHM_CONFIG);
  if (!raw) return { ...DEFAULT_RHYTHM_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<RhythmConfigSettings & { surveyMinMinutes: number; surveyMaxMinutes: number }>;
    const clampNum = (v: unknown, min: number, max: number, fallback: number): number => {
      const n = Number(v);
      if (Number.isNaN(n) || n < min || n > max) return fallback;
      return n;
    };
    const result = {
      replyMinSeconds: clampNum(parsed.replyMinSeconds, 1, 3600, DEFAULT_RHYTHM_CONFIG.replyMinSeconds),
      replyMaxSeconds: clampNum(parsed.replyMaxSeconds, 1, 7200, DEFAULT_RHYTHM_CONFIG.replyMaxSeconds),
      surveyMinSeconds: clampNum(
        parsed.surveyMinSeconds ?? (typeof parsed.surveyMinMinutes === 'number' ? Math.round(parsed.surveyMinMinutes * 60) : undefined),
        1,
        1800,
        DEFAULT_RHYTHM_CONFIG.surveyMinSeconds,
      ),
      surveyMaxSeconds: clampNum(
        parsed.surveyMaxSeconds ?? (typeof parsed.surveyMaxMinutes === 'number' ? Math.round(parsed.surveyMaxMinutes * 60) : undefined),
        1,
        1800,
        DEFAULT_RHYTHM_CONFIG.surveyMaxSeconds,
      ),
      proactiveEnabled: typeof parsed.proactiveEnabled === 'boolean' ? parsed.proactiveEnabled : DEFAULT_RHYTHM_CONFIG.proactiveEnabled,
      proactiveIntervalMinutes: clampNum(parsed.proactiveIntervalMinutes, 1, 1440, DEFAULT_RHYTHM_CONFIG.proactiveIntervalMinutes),
      emojiMixEnabled: typeof parsed.emojiMixEnabled === 'boolean' ? parsed.emojiMixEnabled : DEFAULT_RHYTHM_CONFIG.emojiMixEnabled,
      concatEnabled: typeof parsed.concatEnabled === 'boolean' ? parsed.concatEnabled : DEFAULT_RHYTHM_CONFIG.concatEnabled,
      concatMaxSentences: clampNum(parsed.concatMaxSentences, 1, 5, DEFAULT_RHYTHM_CONFIG.concatMaxSentences),
      backgroundPushEnabled: typeof parsed.backgroundPushEnabled === 'boolean' ? parsed.backgroundPushEnabled : DEFAULT_RHYTHM_CONFIG.backgroundPushEnabled,
      backgroundKeepAlive: typeof parsed.backgroundKeepAlive === 'boolean' ? parsed.backgroundKeepAlive : DEFAULT_RHYTHM_CONFIG.backgroundKeepAlive,
      patPatEnabled: typeof parsed.patPatEnabled === 'boolean' ? parsed.patPatEnabled : DEFAULT_RHYTHM_CONFIG.patPatEnabled,
      patPatFrequency: clampNum(parsed.patPatFrequency, 0, 100, DEFAULT_RHYTHM_CONFIG.patPatFrequency),
      concatProbability: clampNum(parsed.concatProbability, 0, 100, DEFAULT_RHYTHM_CONFIG.concatProbability),
      emojiReplyProbability: clampNum(parsed.emojiReplyProbability, 0, 100, DEFAULT_RHYTHM_CONFIG.emojiReplyProbability),
      stickerReplyProbability: clampNum(parsed.stickerReplyProbability, 0, 100, DEFAULT_RHYTHM_CONFIG.stickerReplyProbability),
      imageReplyProbability: clampNum(parsed.imageReplyProbability, 0, 100, DEFAULT_RHYTHM_CONFIG.imageReplyProbability),
      quoteReplyProbability: clampNum(parsed.quoteReplyProbability, 0, 100, DEFAULT_RHYTHM_CONFIG.quoteReplyProbability),
      recallProbability: clampNum(parsed.recallProbability, 0, 50, DEFAULT_RHYTHM_CONFIG.recallProbability),
      incomingCallProbability: clampNum(parsed.incomingCallProbability, 0, 30, DEFAULT_RHYTHM_CONFIG.incomingCallProbability),
      letterReplyMinSeconds: clampNum(parsed.letterReplyMinSeconds, 0, 600, DEFAULT_RHYTHM_CONFIG.letterReplyMinSeconds),
      letterReplyMaxSeconds: clampNum(parsed.letterReplyMaxSeconds, 0, 1200, DEFAULT_RHYTHM_CONFIG.letterReplyMaxSeconds),
       letterReplyCount: clampNum(parsed.letterReplyCount, 1, 3, DEFAULT_RHYTHM_CONFIG.letterReplyCount),
       letterProactiveProbability: clampNum(parsed.letterProactiveProbability, 0, 30, DEFAULT_RHYTHM_CONFIG.letterProactiveProbability),
       minReplyCount: clampNum(parsed.minReplyCount, 1, 5, DEFAULT_RHYTHM_CONFIG.minReplyCount),
       maxReplyCount: clampNum(parsed.maxReplyCount, 1, 5, DEFAULT_RHYTHM_CONFIG.maxReplyCount),
      questionnaireReplyMinHours: clampNum(parsed.questionnaireReplyMinHours, 0.1, 168, DEFAULT_RHYTHM_CONFIG.questionnaireReplyMinHours),
      questionnaireReplyMaxHours: clampNum(parsed.questionnaireReplyMaxHours, 0.1, 168, DEFAULT_RHYTHM_CONFIG.questionnaireReplyMaxHours),
     };
    return result;
  } catch {
    return { ...DEFAULT_RHYTHM_CONFIG };
  }
}

export function saveRhythmConfig(patch: Partial<RhythmConfigSettings>): RhythmConfigSettings {
  const current = getRhythmConfig();
  const next = { ...current, ...patch };
  if (next.replyMinSeconds > next.replyMaxSeconds) {
    next.replyMaxSeconds = next.replyMinSeconds;
  }
  if (next.surveyMinSeconds > next.surveyMaxSeconds) {
    next.surveyMaxSeconds = next.surveyMinSeconds;
  }
   if (next.letterReplyMinSeconds > next.letterReplyMaxSeconds) {
     next.letterReplyMaxSeconds = next.letterReplyMinSeconds;
   }
   if (next.minReplyCount > next.maxReplyCount) {
     next.maxReplyCount = next.minReplyCount;
   }
   if (next.questionnaireReplyMinHours > next.questionnaireReplyMaxHours) {
     next.questionnaireReplyMaxHours = next.questionnaireReplyMinHours;
   }
   safeSetItem(KEY_RHYTHM_CONFIG, JSON.stringify(next));
  return next;
}

export interface PendingReplyState {
  exists: boolean;
  userMsgId: string;
  userMsgContent: string;
  willReply: boolean;
  startedAt: string;
  scheduledAt: string;
  cardIds: string[];
  quoteTo: string | null;
  quoteContent: string | null;
  quoteSender: string | null;
  readReceipt: boolean;
  messageId?: string;
  typingStartAt?: number;
}

export function getPendingReply(): PendingReplyState | null {
  const raw = safeGetItem(KEY_PENDING_REPLY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingReplyState;
    if (!parsed.exists) return null;
    if (!parsed.scheduledAt || !parsed.startedAt) return null;
    const now = Date.now();
    const scheduled = new Date(parsed.scheduledAt).getTime();
    if (now - scheduled > 5 * 60 * 1000) {
      safeSetItem(KEY_PENDING_REPLY, JSON.stringify({ exists: false }));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingReply(state: PendingReplyState | null): void {
  if (!state) {
    safeSetItem(KEY_PENDING_REPLY, JSON.stringify({ exists: false }));
    return;
  }
  safeSetItem(KEY_PENDING_REPLY, JSON.stringify(state));
}

export function clearPendingReply(): void {
  safeSetItem(KEY_PENDING_REPLY, JSON.stringify({ exists: false }));
}

export interface PendingLetterReply {
  id: string;
  replyToId: string;
  scheduledAt: number;
  willReply: boolean;
  createdAt: number;
}

export function getPendingLetterReplies(): PendingLetterReply[] {
  const raw = safeGetItem(KEY_PENDING_LETTER_REPLIES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingLetterReply[] : [];
  } catch {
    return [];
  }
}

export function savePendingLetterReplies(list: PendingLetterReply[]): void {
  safeSetItem(KEY_PENDING_LETTER_REPLIES, JSON.stringify(list));
}

export function addPendingLetterReply(item: PendingLetterReply): void {
  const list = getPendingLetterReplies();
  list.push(item);
  savePendingLetterReplies(list);
}

export function removePendingLetterReply(id: string): void {
  const list = getPendingLetterReplies().filter((x) => x.id !== id);
  savePendingLetterReplies(list);
}

export type QuestionnaireQuestionType = 'single' | 'multiple' | 'textcard';

export interface QuestionnaireQuestion {
  id: string;
  content: string;
  type: QuestionnaireQuestionType;
  options: string[];
}

export interface QuestionnaireReply {
  questionId: string;
  type: QuestionnaireQuestionType;
  selectedOptions?: string[];
  textcardReply?: string;
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  questions: QuestionnaireQuestion[];
  createdAt: number;
  status: 'draft' | 'sent' | 'replied';
  sentAt?: number;
  repliedAt?: number;
  replies?: QuestionnaireReply[];
  messageId?: string;
  replyMessageId?: string;
}

export interface PendingQuestionnaireReply {
  id: string;
  questionnaireId: string;
  scheduledAt: number;
  willReply: boolean;
  userMessageId: string | null;
  createdAt: number;
}

export function getQuestionnaires(): Questionnaire[] {
  const raw = safeGetItem(KEY_QUESTIONNAIRES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Questionnaire[] : [];
  } catch {
    return [];
  }
}

export function saveQuestionnaires(list: Questionnaire[]): void {
  safeSetItem(KEY_QUESTIONNAIRES, JSON.stringify(list));
}

export function getQuestionnaireById(id: string): Questionnaire | undefined {
  return getQuestionnaires().find((q) => q.id === id);
}

export function addQuestionnaire(q: Omit<Questionnaire, 'id' | 'createdAt' | 'status'> & { id?: string; status?: Questionnaire['status'] }): Questionnaire {
  const list = getQuestionnaires();
  const newQ: Questionnaire = {
    id: q.id ?? generateId(),
    title: q.title,
    description: q.description,
    questions: q.questions,
    createdAt: Date.now(),
    status: q.status ?? 'draft',
    sentAt: q.sentAt,
    repliedAt: q.repliedAt,
    replies: q.replies,
    messageId: q.messageId,
    replyMessageId: q.replyMessageId,
  };
  list.unshift(newQ);
  saveQuestionnaires(list);
  return newQ;
}

export function updateQuestionnaire(id: string, patch: Partial<Questionnaire>): Questionnaire | null {
  const list = getQuestionnaires();
  const idx = list.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  saveQuestionnaires(list);
  return list[idx];
}

export function deleteQuestionnaire(id: string): void {
  const list = getQuestionnaires().filter((q) => q.id !== id);
  saveQuestionnaires(list);
}

export function duplicateQuestionnaire(original: Questionnaire): Questionnaire {
  const newQuestions: QuestionnaireQuestion[] = original.questions.map((q) => ({
    id: generateId(),
    content: q.content,
    type: q.type,
    options: [...q.options],
  }));
  const newQ: Questionnaire = {
    id: generateId(),
    title: original.title + '（副本）',
    description: original.description,
    questions: newQuestions,
    createdAt: Date.now(),
    status: 'draft',
  };
  const list = getQuestionnaires();
  list.unshift(newQ);
  saveQuestionnaires(list);
  return newQ;
}

export function getPendingQuestionnaireReplies(): PendingQuestionnaireReply[] {
  const raw = safeGetItem(KEY_PENDING_QUESTIONNAIRE_REPLIES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingQuestionnaireReply[] : [];
  } catch {
    return [];
  }
}

export function savePendingQuestionnaireReplies(list: PendingQuestionnaireReply[]): void {
  safeSetItem(KEY_PENDING_QUESTIONNAIRE_REPLIES, JSON.stringify(list));
}

export function addPendingQuestionnaireReply(item: PendingQuestionnaireReply): void {
  const list = getPendingQuestionnaireReplies();
  list.push(item);
  savePendingQuestionnaireReplies(list);
}

export function removePendingQuestionnaireReply(id: string): void {
  const list = getPendingQuestionnaireReplies().filter((x) => x.id !== id);
  savePendingQuestionnaireReplies(list);
}

export function generateQuestionnaireReplies(questions: QuestionnaireQuestion[]): QuestionnaireReply[] {
  const allCards = getReplyCards();
  const blocked = getBlockedCardIds();
  const blockedSet = new Set(blocked);
  const availableCards = allCards.filter((c) => !blockedSet.has(c.id));

  return questions.map((q): QuestionnaireReply => {
    if (q.type === 'single') {
      const options = q.options.filter((o) => o.trim().length > 0);
      const chosen = options.length > 0
        ? [options[Math.floor(Math.random() * options.length)]]
        : [];
      return { questionId: q.id, type: 'single', selectedOptions: chosen };
    }
    if (q.type === 'multiple') {
      const options = q.options.filter((o) => o.trim().length > 0);
      const count = Math.min(options.length, Math.floor(Math.random() * 3) + 1);
      const shuffled = [...options].sort(() => Math.random() - 0.5);
      return { questionId: q.id, type: 'multiple', selectedOptions: shuffled.slice(0, count) };
    }
    const count = Math.min(availableCards.length, Math.floor(Math.random() * 3) + 1);
    const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
    const text = shuffled.slice(0, count).map((c) => c.content).join('，');
    return { questionId: q.id, type: 'textcard', textcardReply: text };
  });
}

const SENT_IDS_MAX_SIZE = 500;

export function getSentMessageIds(): string[] {
  const raw = safeGetItem(KEY_SENT_MESSAGE_IDS);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function hasSentMessageId(id: string): boolean {
  return getSentMessageIds().includes(id);
}

export function markSentMessageId(id: string): void {
  const ids = getSentMessageIds();
  if (ids.includes(id)) return;
  ids.push(id);
  if (ids.length > SENT_IDS_MAX_SIZE) {
    ids.splice(0, ids.length - SENT_IDS_MAX_SIZE);
  }
  safeSetItem(KEY_SENT_MESSAGE_IDS, JSON.stringify(ids));
}

export function getLastProactiveSentAt(): number | null {
  const raw = safeGetItem(KEY_LAST_PROACTIVE_SENT_AT);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastProactiveSentAt(ts: number): void {
  safeSetItem(KEY_LAST_PROACTIVE_SENT_AT, String(ts));
}

export function getLastPatProactiveAt(): number | null {
  const raw = safeGetItem(KEY_LAST_PAT_PROACTIVE_AT);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastPatProactiveAt(ts: number): void {
  safeSetItem(KEY_LAST_PAT_PROACTIVE_AT, String(ts));
}

export function getLastCallProactiveAt(): number | null {
  const raw = safeGetItem(KEY_LAST_CALL_PROACTIVE_AT);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastCallProactiveAt(ts: number): void {
  safeSetItem(KEY_LAST_CALL_PROACTIVE_AT, String(ts));
}

export function getLastDailyLetterDate(): string | null {
  return safeGetItem(KEY_LAST_DAILY_LETTER_DATE);
}

export function setLastDailyLetterDate(dateStr: string): void {
  safeSetItem(KEY_LAST_DAILY_LETTER_DATE, dateStr);
}

export function generateMessageId(): string {
  return generateId();
}

// ---------- 氛围感配置 ----------

export interface VibeTextItem {
  id: string;
  content: string;
  createdAt: string;
}

const DEFAULT_PAT_PATS: string[] = [
  '摇了摇头',
  '点了点头',
  '亲了亲我的脸说我爱你',
  '拍了拍我的头说想你中',
  '拍了拍我的头说你好可爱',
  '戳了戳我的腰',
  '从背后抱住了我',
  '轻轻捏了捏我的脸',
];

const DEFAULT_TA_STATUSES: string[] = [
  '晌午',
  '在晒太阳',
  '在发呆',
  '想你了',
  '在摸鱼',
  '刚醒',
  '在看书',
  '听歌中',
  '在打游戏',
  '在线',
];

const DEFAULT_TOP_MOTTOS: string[] = [
  'CARPE DIEM',
];

const DEFAULT_LETTERS: string[] = [
  '见字如面。\n今天也在想你，不知道你今天过得好不好。\n无论多忙，都要记得好好吃饭。',
  '亲爱的：\n看到今天的天气很好，突然就想到了你。\n想和你一起去散步，晒太阳。',
  '你好呀。\n今天发生了一些有趣的事，第一时间就想告诉你。\n等见面的时候慢慢说给你听。',
  '写这封信的时候，窗外在下雨。\n雨声让我更加想你了。\n希望你那边是晴天。',
  '晚安。\n愿你梦里有我。',
];

const DEFAULT_DAILY_ANNOUNCEMENTS: string[] = [
  '想你',
  '今天也要开心 ✨',
  '记得吃饭 🍚',
  '晚安呀 🌙',
  '早安，新的一天 ☀️',
  '摸摸头 🤍',
  '今天辛苦啦',
  '多喝水 💧',
  '天气转凉，多穿点',
  '想和你见面',
  '今天也要好好休息',
  '要一直开开心心',
];

function readVibeList(key: string, defaults: string[]): VibeTextItem[] {
  const raw = safeGetItem(key);
  if (!raw) {
    const list: VibeTextItem[] = defaults.map((c) => ({
      id: generateId(),
      content: c,
      createdAt: new Date().toISOString(),
    }));
    safeSetItem(key, JSON.stringify(list));
    return list;
  }
  try {
    const parsed = JSON.parse(raw) as VibeTextItem[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    const list: VibeTextItem[] = defaults.map((c) => ({
      id: generateId(),
      content: c,
      createdAt: new Date().toISOString(),
    }));
    safeSetItem(key, JSON.stringify(list));
    return list;
  } catch {
    return defaults.map((c) => ({
      id: generateId(),
      content: c,
      createdAt: new Date().toISOString(),
    }));
  }
}

function writeVibeList(key: string, list: VibeTextItem[]): void {
  safeSetItem(key, JSON.stringify(list));
}

export function getPatPats(): VibeTextItem[] {
  return readVibeList(KEY_VIBE_PAT_PATS, DEFAULT_PAT_PATS);
}

export function addPatPat(content: string): VibeTextItem {
  const all = getPatPats();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_VIBE_PAT_PATS, next);
  return item;
}

export function deletePatPat(id: string): void {
  const all = getPatPats().filter((x) => x.id !== id);
  writeVibeList(KEY_VIBE_PAT_PATS, all);
}

const DEFAULT_USER_PAT_ACTIONS: string[] = [
  '拍了拍TA的头',
  '捏了捏TA的脸',
  '戳了戳TA',
  '揉了揉TA的头发',
  '轻轻拍了拍TA的肩',
];

export function getUserPatActions(): VibeTextItem[] {
  return readVibeList(KEY_USER_PAT_ACTIONS, DEFAULT_USER_PAT_ACTIONS);
}

export function addUserPatAction(content: string): VibeTextItem {
  const all = getUserPatActions();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_USER_PAT_ACTIONS, next);
  return item;
}

export function deleteUserPatAction(id: string): void {
  const all = getUserPatActions().filter((x) => x.id !== id);
  writeVibeList(KEY_USER_PAT_ACTIONS, all);
}

export function getTaStatuses(): VibeTextItem[] {
  return readVibeList(KEY_VIBE_TA_STATUSES, DEFAULT_TA_STATUSES);
}

export function addTaStatus(content: string): VibeTextItem {
  const all = getTaStatuses();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_VIBE_TA_STATUSES, next);
  return item;
}

export function deleteTaStatus(id: string): void {
  const all = getTaStatuses().filter((x) => x.id !== id);
  writeVibeList(KEY_VIBE_TA_STATUSES, all);
}

export function getRandomTaStatus(): string {
  const list = getTaStatuses();
  if (list.length === 0) return '在线';
  return list[Math.floor(Math.random() * list.length)].content;
}

interface TaStatusCache {
  date: string;
  content: string;
}

export function getCachedTaStatus(): string | null {
  const raw = safeGetItem(KEY_VIBE_TA_STATUS_CACHE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TaStatusCache;
    if (parsed.date === new Date().toDateString()) {
      return parsed.content;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCachedTaStatus(content: string): void {
  const cache: TaStatusCache = {
    date: new Date().toDateString(),
    content,
  };
  safeSetItem(KEY_VIBE_TA_STATUS_CACHE, JSON.stringify(cache));
}

export function getTopMottos(): VibeTextItem[] {
  return readVibeList(KEY_VIBE_TOP_MOTTO, DEFAULT_TOP_MOTTOS);
}

export function addTopMotto(content: string): VibeTextItem {
  const all = getTopMottos();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_VIBE_TOP_MOTTO, next);
  return item;
}

export function deleteTopMotto(id: string): void {
  const all = getTopMottos().filter((x) => x.id !== id);
  writeVibeList(KEY_VIBE_TOP_MOTTO, all);
}

export function getDailyAnnouncements(): VibeTextItem[] {
  return readVibeList(KEY_VIBE_DAILY_ANNOUNCEMENT, DEFAULT_DAILY_ANNOUNCEMENTS);
}

export function addDailyAnnouncement(content: string): VibeTextItem {
  const all = getDailyAnnouncements();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_VIBE_DAILY_ANNOUNCEMENT, next);
  return item;
}

export function deleteDailyAnnouncement(id: string): void {
  const all = getDailyAnnouncements().filter((x) => x.id !== id);
  writeVibeList(KEY_VIBE_DAILY_ANNOUNCEMENT, all);
}

export function getIntroAnimations(): VibeTextItem[] {
  return readVibeList(KEY_VIBE_INTRO, []);
}

export function addIntroAnimation(content: string): VibeTextItem {
  const all = getIntroAnimations();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_VIBE_INTRO, next);
  return item;
}

export function deleteIntroAnimation(id: string): void {
  const all = getIntroAnimations().filter((x) => x.id !== id);
  writeVibeList(KEY_VIBE_INTRO, all);
}

export function saveIntroAnimations(contents: string[]): void {
  const items: VibeTextItem[] = contents.map((c, i) => ({
    id: `intro_${i}`,
    content: c,
    createdAt: new Date().toISOString(),
  }));
  writeVibeList(KEY_VIBE_INTRO, items);
}

const KEY_ANNOUNCEMENT = 'ta_announcement';

export function getAnnouncement(): string {
  const raw = safeGetItem(KEY_ANNOUNCEMENT);
  return raw ?? '';
}

export function saveAnnouncement(content: string): void {
  localStorage.setItem(KEY_ANNOUNCEMENT, content);
}

export interface MyStatusState {
  mode: 'random' | 'custom';
  customText: string;
}

const DEFAULT_MY_STATUS: MyStatusState = { mode: 'random', customText: '在线' };

export function getMyStatus(): MyStatusState {
  const raw = safeGetItem(KEY_VIBE_MY_STATUS);
  if (!raw) return { ...DEFAULT_MY_STATUS };
  try {
    const parsed = JSON.parse(raw) as Partial<MyStatusState>;
    return { ...DEFAULT_MY_STATUS, ...parsed };
  } catch {
    return { ...DEFAULT_MY_STATUS };
  }
}

export function saveMyStatus(state: MyStatusState): void {
  safeSetItem(KEY_VIBE_MY_STATUS, JSON.stringify(state));
}

export function getDisplayMyStatus(): string {
  const s = getMyStatus();
  if (s.mode === 'custom') return s.customText || '在线';
  return s.customText || '在线';
}

export function getCustomBackgrounds(): CustomBgItem[] {
  const raw = safeGetItem(KEY_CUSTOM_BGS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CustomBgItem[];
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function addCustomBackground(dataUrl: string): CustomBgItem {
  const all = getCustomBackgrounds();
  const item: CustomBgItem = { id: generateId(), dataUrl, createdAt: new Date().toISOString() };
  const next = [item, ...all];
  safeSetItem(KEY_CUSTOM_BGS, JSON.stringify(next));
  return item;
}

export function deleteCustomBackground(id: string): void {
  const all = getCustomBackgrounds().filter((x) => x.id !== id);
  safeSetItem(KEY_CUSTOM_BGS, JSON.stringify(all));
}

export function getLetterTexts(): VibeTextItem[] {
  return readVibeList(KEY_VIBE_LETTERS, DEFAULT_LETTERS);
}

export function addLetterText(content: string): VibeTextItem {
  const all = getLetterTexts();
  const item: VibeTextItem = { id: generateId(), content, createdAt: new Date().toISOString() };
  const next = [...all, item];
  writeVibeList(KEY_VIBE_LETTERS, next);
  return item;
}

export function deleteLetterText(id: string): void {
  const all = getLetterTexts().filter((x) => x.id !== id);
  writeVibeList(KEY_VIBE_LETTERS, all);
}

export function getRandomLetterText(): string | null {
  const list = getLetterTexts();
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)].content;
}

export function generateLetterContent(minCards = 5, maxCards = 15): string {
  let all = getReplyCards();
  const blocked = getBlockedCardIds();
  if (blocked.length > 0) {
    const blockedSet = new Set(blocked);
    all = all.filter((c) => !blockedSet.has(c.id));
  }
  if (all.length === 0) return '见字如面。';

  const min = Math.max(1, minCards);
  const max = Math.max(min, maxCards);
  const count = Math.min(all.length, Math.floor(min + Math.random() * (max - min + 1)));

  const shuffled = [...all].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  const emojis = getEmojiLib();
  const lines = selected.map((card) => {
    let text = card.content;
    if (emojis.length > 0 && Math.random() < 0.3) {
      text += ' ' + emojis[Math.floor(Math.random() * emojis.length)];
    }
    return text;
  });

  return lines.join('\n');
}

export function getSoundConfig(): SoundConfig {
  const raw = safeGetItem(KEY_SOUND_CONFIG);
  if (!raw) return { ...DEFAULT_SOUND_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<SoundConfig>;
    const clampNum = (v: unknown, min: number, max: number, fallback: number): number => {
      const n = Number(v);
      if (Number.isNaN(n) || n < min || n > max) return fallback;
      return n;
    };
    const boolOf = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
    const validStyle = SOUND_STYLE_LIST.some((s) => s.name === parsed.style)
      ? (parsed.style as SoundStyleName)
      : DEFAULT_SOUND_CONFIG.style;
    const parsedSceneSounds = (parsed.sceneSounds ?? {}) as Partial<Record<SoundSceneName, SoundTypeName>>;
    const sceneSounds = { ...DEFAULT_SCENE_SOUNDS };
    let hasSceneSounds = false;
    (Object.keys(parsedSceneSounds) as SoundSceneName[]).forEach((key) => {
      const val = parsedSceneSounds[key];
      if (val && typeof val === 'string') {
        sceneSounds[key] = val as SoundTypeName;
        hasSceneSounds = true;
      }
    });
    if (!hasSceneSounds) {
      const preset = STYLE_SCENE_PRESETS[validStyle];
      if (preset) {
        (Object.keys(preset) as SoundSceneName[]).forEach((key) => {
          sceneSounds[key] = preset[key];
        });
      }
    }
    return {
      enabled: boolOf(parsed.enabled, DEFAULT_SOUND_CONFIG.enabled),
      volume: clampNum(parsed.volume, 0, 1, DEFAULT_SOUND_CONFIG.volume),
      sendEnabled: boolOf(parsed.sendEnabled, DEFAULT_SOUND_CONFIG.sendEnabled),
      receiveEnabled: boolOf(parsed.receiveEnabled, DEFAULT_SOUND_CONFIG.receiveEnabled),
      patEnabled: boolOf(parsed.patEnabled, DEFAULT_SOUND_CONFIG.patEnabled),
      callEnabled: boolOf(parsed.callEnabled, DEFAULT_SOUND_CONFIG.callEnabled),
      style: validStyle,
      sceneSounds,
    };
  } catch {
    return { ...DEFAULT_SOUND_CONFIG };
  }
}

export function saveSoundConfig(patch: Partial<SoundConfig>): SoundConfig {
  const current = getSoundConfig();
  const next = { ...current, ...patch };
  safeSetItem(KEY_SOUND_CONFIG, JSON.stringify(next));
  return next;
}
