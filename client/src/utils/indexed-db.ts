import { logger } from '@lark-apaas/client-toolkit/logger';
import type { ChatMessage } from '@shared/api.interface';

const DB_NAME = 'ta_chat_db';
const DB_VERSION = 3;

export interface StickerRecord {
  id: string;
  dataUrl: string;
  createdAt: string;
}

export interface BlobImageRecord {
  key: string;
  dataUrl: string;
  createdAt: string;
}

const STORE_MESSAGES = 'messages';
const STORE_STICKERS = 'stickers';
const STORE_IMAGES = 'images';
const STORE_CUSTOM_SOUNDS = 'custom_sounds';

export interface CustomSoundRecord {
  id: string;
  name: string;
  type: 'local' | 'url';
  dataUrl: string;
  url: string;
  duration: number;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => {
        logger.error('IndexedDB 打开失败', req.error?.message);
        reject(req.error ?? new Error('IndexedDB open failed'));
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (event.oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
            const store = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('sender', 'sender', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_STICKERS)) {
            const store = db.createObjectStore(STORE_STICKERS, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_IMAGES)) {
            db.createObjectStore(STORE_IMAGES, { keyPath: 'key' });
          }
        }
        if (event.oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORE_CUSTOM_SOUNDS)) {
            const store = db.createObjectStore(STORE_CUSTOM_SOUNDS, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        }
        if (event.oldVersion < 3) {
          const store = req.transaction?.objectStore(STORE_CUSTOM_SOUNDS);
          if (store) {
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor) {
                const val = cursor.value as CustomSoundRecord;
                if (!val.type) {
                  val.type = 'local';
                  val.url = '';
                  cursor.update(val);
                }
                cursor.continue();
              }
            };
          }
        }
      };
    } catch (err) {
      logger.error('IndexedDB 初始化异常', String(err));
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

function withTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, resolve: (val: T) => void, reject: (err: unknown) => void) => void
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        tx.onerror = () => reject(tx.error ?? new Error('tx error'));
        tx.onabort = () => reject(tx.error ?? new Error('tx abort'));
        const store = tx.objectStore(storeName);
        work(store, resolve, reject);
      })
  );
}

// ---------- Messages ----------

export function getAllMessages(): Promise<ChatMessage[]> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  return withTx<ChatMessage[]>(STORE_MESSAGES, 'readonly', (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result as ChatMessage[];
      // ISO 8601 字符串字典序与时间序一致，直接比较比 new Date() 快得多
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
      logger.info(`[idb-perf] getAllMessages: count=${list.length}, total=${(t1 - t0).toFixed(1)}ms`);
      resolve(list);
    };
  });
}

export function addMessage(message: ChatMessage): Promise<ChatMessage> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  return openDb().then((db) => {
    const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
    return new Promise<ChatMessage>((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      tx.oncomplete = () => {
        const t2 = typeof performance !== 'undefined' ? performance.now() : 0;
        logger.info(
          `[idb-perf] addMessage complete: dbOpen=${(t1 - t0).toFixed(1)}ms, ` +
          `txTotal=${(t2 - t1).toFixed(1)}ms, total=${(t2 - t0).toFixed(1)}ms, ` +
          `sender=${message.sender}, len=${message.content.length}, ` +
          `sticker=${!!(message as { stickerUrl?: string }).stickerUrl}`
        );
        resolve(message);
      };
      tx.onerror = () => reject(tx.error ?? new Error('tx error'));
      tx.onabort = () => reject(tx.error ?? new Error('tx abort'));
      const store = tx.objectStore(STORE_MESSAGES);
      store.add(message);
    });
  });
}

export function putMessage(message: ChatMessage): Promise<ChatMessage> {
  return withTx<ChatMessage>(STORE_MESSAGES, 'readwrite', (store, resolve, reject) => {
    const req = store.put(message);
    req.onsuccess = () => resolve(message);
    req.onerror = () => reject(req.error ?? new Error('put message failed'));
  });
}

export function clearAllMessages(): Promise<void> {
  return withTx<void>(STORE_MESSAGES, 'readwrite', (store, resolve) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
  });
}

export function bulkPutMessages(messages: ChatMessage[]): Promise<void> {
  return withTx<void>(STORE_MESSAGES, 'readwrite', (store, resolve) => {
    for (const msg of messages) {
      store.put(msg);
    }
    const req = store.count();
    req.onsuccess = () => resolve();
  });
}

export function replaceAllMessages(messages: ChatMessage[]): Promise<void> {
  return withTx<void>(STORE_MESSAGES, 'readwrite', (store, resolve) => {
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      for (const msg of messages) {
        store.add(msg);
      }
      const req = store.count();
      req.onsuccess = () => resolve();
    };
  });
}

export function bulkPutStickers(stickers: StickerRecord[]): Promise<void> {
  return withTx<void>(STORE_STICKERS, 'readwrite', (store, resolve) => {
    for (const s of stickers) {
      store.put(s);
    }
    const req = store.count();
    req.onsuccess = () => resolve();
  });
}

export function bulkPutImages(images: BlobImageRecord[]): Promise<void> {
  return withTx<void>(STORE_IMAGES, 'readwrite', (store, resolve) => {
    for (const img of images) {
      store.put(img);
    }
    const req = store.count();
    req.onsuccess = () => resolve();
  });
}

export function bulkPutCustomSounds(sounds: CustomSoundRecord[]): Promise<void> {
  return withTx<void>(STORE_CUSTOM_SOUNDS, 'readwrite', (store, resolve) => {
    for (const s of sounds) {
      store.put(s);
    }
    const req = store.count();
    req.onsuccess = () => resolve();
  });
}

export function clearAllImages(): Promise<void> {
  return withTx<void>(STORE_IMAGES, 'readwrite', (store, resolve) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
  });
}

export function clearAllCustomSounds(): Promise<void> {
  return withTx<void>(STORE_CUSTOM_SOUNDS, 'readwrite', (store, resolve) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
  });
}

export function deleteMessage(id: string): Promise<void> {
  return withTx<void>(STORE_MESSAGES, 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete message failed'));
  });
}

export function getMessage(id: string): Promise<ChatMessage | undefined> {
  return withTx<ChatMessage | undefined>(STORE_MESSAGES, 'readonly', (store, resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as ChatMessage | undefined);
  });
}

// ---------- Stickers ----------

export function getAllStickers(): Promise<StickerRecord[]> {
  return withTx<StickerRecord[]>(STORE_STICKERS, 'readonly', (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result as StickerRecord[];
      // ISO 8601 字符串字典序与时间序一致
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(list);
    };
  });
}

export function addStickerRecord(record: StickerRecord): Promise<StickerRecord> {
  return withTx<StickerRecord>(STORE_STICKERS, 'readwrite', (store, resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error ?? new Error('add sticker failed'));
  });
}

export function removeStickerRecord(id: string): Promise<boolean> {
  return withTx<boolean>(STORE_STICKERS, 'readwrite', (store, resolve) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
  });
}

export function clearAllStickers(): Promise<void> {
  return withTx<void>(STORE_STICKERS, 'readwrite', (store, resolve) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
  });
}

// ---------- Images (avatars / background) ----------

export function getImage(key: string): Promise<BlobImageRecord | null> {
  return withTx<BlobImageRecord | null>(STORE_IMAGES, 'readonly', (store, resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as BlobImageRecord) ?? null);
  });
}

export function putImage(record: BlobImageRecord): Promise<BlobImageRecord> {
  return withTx<BlobImageRecord>(STORE_IMAGES, 'readwrite', (store, resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error ?? new Error('put image failed'));
  });
}

export function deleteImage(key: string): Promise<boolean> {
  return withTx<boolean>(STORE_IMAGES, 'readwrite', (store, resolve) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
  });
}

// ---------- Migration ----------

const LS_KEY_MESSAGES = 'ta_chat_messages';
const LS_KEY_STICKERS = 'ta_sticker_library';
const LS_KEY_PROFILE = 'ta_profile_settings';
const MIGRATION_FLAG = 'ta_idb_migration_v1';

function safeLsGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeLsRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}
function safeLsGetBool(key: string): boolean {
  return safeLsGet(key) === '1';
}
function safeLsSetBool(key: string, v: boolean): void {
  try { window.localStorage.setItem(key, v ? '1' : '0'); } catch { /* ignore */ }
}

export async function migrateMessagesFromLocalStorage(): Promise<number> {
  if (safeLsGetBool(MIGRATION_FLAG + '_messages')) return 0;
  const raw = safeLsGet(LS_KEY_MESSAGES);
  if (!raw) {
    safeLsSetBool(MIGRATION_FLAG + '_messages', true);
    return 0;
  }
  try {
    const list = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(list) || list.length === 0) {
      safeLsSetBool(MIGRATION_FLAG + '_messages', true);
      return 0;
    }
    let count = 0;
    for (const m of list) {
      try {
        await addMessage(m);
        count += 1;
      } catch {
        // 跳过已存在或有问题的消息
      }
    }
    safeLsRemove(LS_KEY_MESSAGES);
    safeLsSetBool(MIGRATION_FLAG + '_messages', true);
    logger.info(`已迁移 ${count} 条聊天记录到 IndexedDB`);
    return count;
  } catch (err) {
    logger.error('迁移聊天记录失败', String(err));
    return 0;
  }
}

export async function migrateStickersFromLocalStorage(): Promise<number> {
  if (safeLsGetBool(MIGRATION_FLAG + '_stickers')) return 0;
  const raw = safeLsGet(LS_KEY_STICKERS);
  if (!raw) {
    safeLsSetBool(MIGRATION_FLAG + '_stickers', true);
    return 0;
  }
  try {
    const list = JSON.parse(raw) as string[];
    if (!Array.isArray(list) || list.length === 0) {
      safeLsSetBool(MIGRATION_FLAG + '_stickers', true);
      return 0;
    }
    let count = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < list.length; i++) {
      const dataUrl = list[i];
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
        const id = `sticker_${i}_${now}`;
        try {
          await addStickerRecord({ id, dataUrl, createdAt: now });
          count += 1;
        } catch {
          // 跳过重复
        }
      }
    }
    safeLsRemove(LS_KEY_STICKERS);
    safeLsSetBool(MIGRATION_FLAG + '_stickers', true);
    logger.info(`已迁移 ${count} 张表情包到 IndexedDB`);
    return count;
  } catch (err) {
    logger.error('迁移表情包失败', String(err));
    return 0;
  }
}

// ---------- Custom Sounds ----------

export function getAllCustomSounds(): Promise<CustomSoundRecord[]> {
  return withTx<CustomSoundRecord[]>(STORE_CUSTOM_SOUNDS, 'readonly', (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result as CustomSoundRecord[];
      // ISO 8601 字符串字典序与时间序一致
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(list);
    };
  });
}

export function addCustomSound(record: CustomSoundRecord): Promise<CustomSoundRecord> {
  return withTx<CustomSoundRecord>(STORE_CUSTOM_SOUNDS, 'readwrite', (store, resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error ?? new Error('add custom sound failed'));
  });
}

export function deleteCustomSound(id: string): Promise<void> {
  return withTx<void>(STORE_CUSTOM_SOUNDS, 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete custom sound failed'));
  });
}

export function getCustomSound(id: string): Promise<CustomSoundRecord | undefined> {
  return withTx<CustomSoundRecord | undefined>(STORE_CUSTOM_SOUNDS, 'readonly', (store, resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as CustomSoundRecord | undefined);
  });
}

export async function migrateProfileImagesFromLocalStorage(): Promise<{
  taAvatar: string;
  myAvatar: string;
  chatBgImage: string;
}> {
  const result = { taAvatar: '', myAvatar: '', chatBgImage: '' };
  if (safeLsGetBool(MIGRATION_FLAG + '_profile_images')) return result;
  const raw = safeLsGet(LS_KEY_PROFILE);
  if (!raw) {
    safeLsSetBool(MIGRATION_FLAG + '_profile_images', true);
    return result;
  }
  try {
    const parsed = JSON.parse(raw) as { taAvatar?: string; myAvatar?: string; chatBgImage?: string };
    const now = new Date().toISOString();
    if (typeof parsed.taAvatar === 'string' && parsed.taAvatar.startsWith('data:image')) {
      await putImage({ key: 'ta_avatar', dataUrl: parsed.taAvatar, createdAt: now });
      result.taAvatar = parsed.taAvatar;
    }
    if (typeof parsed.myAvatar === 'string' && parsed.myAvatar.startsWith('data:image')) {
      await putImage({ key: 'my_avatar', dataUrl: parsed.myAvatar, createdAt: now });
      result.myAvatar = parsed.myAvatar;
    }
    if (typeof parsed.chatBgImage === 'string' && parsed.chatBgImage.startsWith('data:image')) {
      await putImage({ key: 'chat_bg_image', dataUrl: parsed.chatBgImage, createdAt: now });
      result.chatBgImage = parsed.chatBgImage;
    }
    safeLsSetBool(MIGRATION_FLAG + '_profile_images', true);
    logger.info('已迁移头像和背景图片到 IndexedDB');
    return result;
  } catch (err) {
    logger.error('迁移头像和背景图片失败', String(err));
    return result;
  }
}
