import { logger } from '@lark-apaas/client-toolkit/logger';
import { getAllMessages, clearAllMessages, clearAllStickers, bulkPutMessages, replaceAllMessages, bulkPutStickers, bulkPutImages, bulkPutCustomSounds, clearAllImages, clearAllCustomSounds } from '@client/src/utils/indexed-db';
import { getAllLetters, clearAllLetters, bulkPutLetters, replaceAllLetters } from '@client/src/utils/letter-storage';
import type { ChatMessage } from '@shared/api.interface';

export interface StorageUsage {
  messages: number;
  settings: number;
  media: number;
  total: number;
  quota: number;
}

const LS_KEYS_PREFIX = 'ta_';

function estimateStringBytes(str: string): number {
  return new Blob([str]).size;
}

function estimateObjBytes(obj: unknown): number {
  try {
    return estimateStringBytes(JSON.stringify(obj));
  } catch {
    return 0;
  }
}

async function getStoreSize(dbName: string, storeName: string): Promise<number> {
  return new Promise<number>((resolve) => {
    try {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const cursorReq = store.openCursor();
          let total = 0;
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              total += estimateObjBytes(cursor.value);
              cursor.continue();
            } else {
              db.close();
              resolve(total);
            }
          };
          cursorReq.onerror = () => {
            db.close();
            resolve(0);
          };
        } catch (err) {
          db.close();
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export async function calcStorageUsage(): Promise<StorageUsage> {
  let messages = 0;
  let media = 0;

  try {
    messages = await getStoreSize('ta_chat_db', 'messages');
  } catch (err) {
    logger.warn('计算聊天记录大小失败', err);
  }

  try {
    const [stickers, images, customSounds, letters] = await Promise.all([
      getStoreSize('ta_chat_db', 'stickers'),
      getStoreSize('ta_chat_db', 'images'),
      getStoreSize('ta_chat_db', 'custom_sounds'),
      getStoreSize('ta_letter_db', 'letters'),
    ]);
    media = stickers + images + customSounds + letters;
  } catch (err) {
    logger.warn('计算媒体大小失败', err);
  }

  let settings = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(LS_KEYS_PREFIX) || key.startsWith('user_pat_')) {
        const val = localStorage.getItem(key) || '';
        settings += estimateStringBytes(val) + estimateStringBytes(key);
      }
    }
  } catch (err) {
    logger.warn('计算设置大小失败', err);
  }

  let quota = 10 * 1024 * 1024 * 1024;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota) quota = est.quota;
    }
  } catch {
    // use default
  }

  const total = messages + settings + media;
  return { messages, settings, media, total, quota };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function getAllLocalStorageData(): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(LS_KEYS_PREFIX) || key.startsWith('user_pat_')) {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }
  }
  return data;
}

async function getAllIndexedDbData(): Promise<{
  messages: ChatMessage[];
  stickers: unknown[];
  images: unknown[];
  customSounds: unknown[];
  letters: unknown[];
}> {
  const [messages, stickers, images, customSounds, letters] = await Promise.all([
    getAllMessages().catch(() => [] as ChatMessage[]),
    getAllStoreRecords('ta_chat_db', 'stickers'),
    getAllStoreRecords('ta_chat_db', 'images'),
    getAllStoreRecords('ta_chat_db', 'custom_sounds'),
    getAllLetters().catch(() => []),
  ]);
  return { messages, stickers, images, customSounds, letters };
}

function getAllStoreRecords(dbName: string, storeName: string): Promise<unknown[]> {
  return new Promise<unknown[]>((resolve, reject) => {
    try {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            db.close();
            resolve(allReq.result);
          };
          allReq.onerror = () => {
            db.close();
            reject(allReq.error);
          };
        } catch (err) {
          db.close();
          reject(err);
        }
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function exportFullBackup(): Promise<void> {
  const [localStorageData, idbData] = await Promise.all([
    getAllLocalStorageData(),
    getAllIndexedDbData(),
  ]);
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: localStorageData,
    indexedDB: idbData,
  };
  downloadJson(backup, `专属私语聊天_全量备份_${getTodayStr()}.json`);
  logger.info('[data-mgmt] full backup exported');
}

export async function exportMessagesBackup(): Promise<void> {
  const messages = await getAllMessages().catch(() => [] as ChatMessage[]);
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    messages,
  };
  downloadJson(backup, `专属私语聊天_聊天记录_${getTodayStr()}.json`);
  logger.info(`[data-mgmt] messages backup exported, count=${messages.length}`);
}

export async function clearChatMessages(): Promise<void> {
  await clearAllMessages();
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key === 'ta_chat_messages' || key === 'ta_sent_message_ids' || key === 'ta_pending_reply')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  logger.info('[data-mgmt] chat messages cleared');
}

export async function resetAllData(): Promise<void> {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(LS_KEYS_PREFIX) || key.startsWith('user_pat_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  try {
    await clearAllMessages();
  } catch (err) {
    logger.warn('清除消息失败', err);
  }
  try {
    await clearAllLetters();
  } catch (err) {
    logger.warn('清除信箱失败', err);
  }
  try {
    await clearAllStickers();
    await clearObjectStore('ta_chat_db', 'images');
    await clearObjectStore('ta_chat_db', 'custom_sounds');
  } catch (err) {
    logger.warn('清除媒体数据失败', err);
  }

  logger.info('[data-mgmt] all data reset');
}

export async function restoreFullBackup(file: File): Promise<void> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('备份文件解析失败');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('文件格式不正确，请选择有效的备份文件');
  }

  const backup = data as { localStorage?: Record<string, unknown>; indexedDB?: { messages?: unknown[]; stickers?: unknown[]; images?: unknown[]; customSounds?: unknown[]; letters?: unknown[] } };

  if (!backup.localStorage && !backup.indexedDB) {
    throw new Error('文件格式不正确，请选择有效的备份文件');
  }

  if (backup.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(LS_KEYS_PREFIX) || key.startsWith('user_pat_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    for (const [key, val] of Object.entries(backup.localStorage)) {
      if (typeof val === 'string') {
        localStorage.setItem(key, val);
      } else {
        localStorage.setItem(key, JSON.stringify(val));
      }
    }
  }

  if (backup.indexedDB) {
    const idb = backup.indexedDB;
    const tasks: Promise<void>[] = [];

    if (Array.isArray(idb.messages)) {
      tasks.push(replaceAllMessages(idb.messages as ChatMessage[]).catch(err => {
        logger.warn('恢复消息失败', err);
      }));
    }
    if (Array.isArray(idb.stickers)) {
      tasks.push((async () => {
        try { await clearAllStickers(); } catch { /* ignore */ }
        try { await bulkPutStickers(idb.stickers as any[]); } catch (err) { logger.warn('恢复表情包失败', err); }
      })());
    }
    if (Array.isArray(idb.images)) {
      tasks.push((async () => {
        try { await clearAllImages(); } catch { /* ignore */ }
        try { await bulkPutImages(idb.images as any[]); } catch (err) { logger.warn('恢复图片失败', err); }
      })());
    }
    if (Array.isArray(idb.customSounds)) {
      tasks.push((async () => {
        try { await clearAllCustomSounds(); } catch { /* ignore */ }
        try { await bulkPutCustomSounds(idb.customSounds as any[]); } catch (err) { logger.warn('恢复自定义音效失败', err); }
      })());
    }
    if (Array.isArray(idb.letters)) {
      tasks.push(replaceAllLetters(idb.letters as any[]).catch(err => {
        logger.warn('恢复信箱失败', err);
      }));
    }

    await Promise.all(tasks);
  }

  logger.info('[data-mgmt] full backup restored');
}

export type ImportMode = 'append' | 'replace';

export async function importMessagesBackup(file: File, mode: ImportMode): Promise<number> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('聊天记录文件解析失败');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('文件格式不正确，请选择有效的聊天记录文件');
  }

  const backup = data as { messages?: ChatMessage[] };
  if (!Array.isArray(backup.messages)) {
    throw new Error('文件格式不正确，未找到消息数据');
  }

  const messages = backup.messages;

  if (mode === 'replace') {
    await replaceAllMessages(messages);
  } else {
    const existing = await getAllMessages();
    const existingIds = new Set(existing.map((m: ChatMessage) => m.id));
    const toAdd = messages.filter((m: ChatMessage) => !existingIds.has(m.id));
    if (toAdd.length > 0) {
      await bulkPutMessages(toAdd);
    }
  }

  logger.info(`[data-mgmt] messages imported, mode=${mode}, count=${messages.length}`);
  return messages.length;
}

function clearObjectStore(dbName: string, storeName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const clearReq = store.clear();
          clearReq.onsuccess = () => {
            db.close();
            resolve();
          };
          clearReq.onerror = () => {
            db.close();
            reject(clearReq.error);
          };
        } catch (err) {
          db.close();
          reject(err);
        }
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}
