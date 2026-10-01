import { logger } from '@lark-apaas/client-toolkit/logger';

export type LetterType = 'sent' | 'received' | 'space_time';

export interface Letter {
  id: string;
  type: LetterType;
  content: string;
  timestamp: number;
  read: boolean;
  replyTo?: string;
}

const DB_NAME = 'ta_letter_db';
const DB_VERSION = 1;
const STORE_NAME = 'letters';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;
let useFallback = false;
const fallbackStore: Letter[] = [];

function generateLetterId(): string {
  return `letter_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function initLetterDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  if (typeof indexedDB === 'undefined') {
    useFallback = true;
    return Promise.reject(new Error('indexedDB not available'));
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.warn('IndexedDB 打开失败，降级到内存存储', request.error);
        useFallback = true;
        dbPromise = null;
        reject(request.error ?? new Error('IndexedDB open failed'));
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        dbInstance.onerror = (event) => {
          logger.warn('IndexedDB 错误', event);
        };
        dbPromise = null;
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('read', 'read', { unique: false });
        }
      };
    } catch (err) {
      logger.warn('IndexedDB 初始化异常，降级到内存存储', err);
      useFallback = true;
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

function withDB<T>(fn: (db: IDBDatabase) => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (useFallback) {
    return Promise.resolve().then(fallback);
  }
  return initLetterDB()
    .then((db) => fn(db))
    .catch(() => {
      useFallback = true;
      return Promise.resolve().then(fallback);
    });
}

function sortByTimestampDesc(a: Letter, b: Letter): number {
  return b.timestamp - a.timestamp;
}

export function addLetter(letter: Omit<Letter, 'id'> & { id?: string }): Promise<Letter> {
  const newLetter: Letter = {
    ...letter,
    id: letter.id ?? generateLetterId(),
  };

  return withDB(
    (db) =>
      new Promise<Letter>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(newLetter);
        request.onsuccess = () => resolve(newLetter);
        request.onerror = () => reject(request.error);
      }),
    () => {
      fallbackStore.push(newLetter);
      return newLetter;
    }
  );
}

export function getLettersByType(type: LetterType): Promise<Letter[]> {
  return withDB(
    (db) =>
      new Promise<Letter[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('type');
        const request = index.getAll(type);
        request.onsuccess = () => {
          const result = request.result as Letter[];
          result.sort(sortByTimestampDesc);
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      }),
    () => fallbackStore.filter((l) => l.type === type).sort(sortByTimestampDesc)
  );
}

export function getAllLetters(): Promise<Letter[]> {
  return withDB(
    (db) =>
      new Promise<Letter[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const result = request.result as Letter[];
          result.sort(sortByTimestampDesc);
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      }),
    () => [...fallbackStore].sort(sortByTimestampDesc)
  );
}

export function markAsRead(id: string): Promise<void> {
  return withDB(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const letter = getReq.result as Letter | undefined;
          if (!letter) {
            resolve();
            return;
          }
          const updated: Letter = { ...letter, read: true };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      }),
    () => {
      const idx = fallbackStore.findIndex((l) => l.id === id);
      if (idx >= 0) {
        fallbackStore[idx] = { ...fallbackStore[idx], read: true };
      }
    }
  );
}

export function markAllAsRead(type?: LetterType): Promise<void> {
  return withDB(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const source = type ? store.index('type') : store;
        const cursorReq = source.openCursor();
        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const letter = cursor.value as Letter;
            if (!letter.read) {
              const updated: Letter = { ...letter, read: true };
              cursor.update(updated);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      }),
    () => {
      for (let i = 0; i < fallbackStore.length; i += 1) {
        if (type === undefined || fallbackStore[i].type === type) {
          fallbackStore[i] = { ...fallbackStore[i], read: true };
        }
      }
    }
  );
}

export function getUnreadCount(type?: LetterType): Promise<number> {
  return withDB(
    (db) =>
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const all = request.result as Letter[];
          const filtered = type ? all.filter((l) => l.type === type) : all;
          const count = filtered.filter((l) => !l.read).length;
          resolve(count);
        };
        request.onerror = () => reject(request.error);
      }),
    () => {
      const filtered = type ? fallbackStore.filter((l) => l.type === type) : fallbackStore;
      return filtered.filter((l) => !l.read).length;
    }
  );
}

export function getLetterById(id: string): Promise<Letter | null> {
  return withDB(
    (db) =>
      new Promise<Letter | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => {
          const result = request.result as Letter | undefined;
          resolve(result ?? null);
        };
        request.onerror = () => reject(request.error);
      }),
    () => fallbackStore.find((l) => l.id === id) ?? null
  );
}

export function getReceivedReplyForSent(sentId: string): Promise<Letter | null> {
  return withDB(
    (db) =>
      new Promise<Letter | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const typeIndex = store.index('type');
        const request = typeIndex.getAll('received');
        request.onsuccess = () => {
          const all = request.result as Letter[];
          const found = all.find((l) => l.replyTo === sentId) ?? null;
          resolve(found);
        };
        request.onerror = () => reject(request.error);
      }),
    () => fallbackStore.find((l) => l.type === 'received' && l.replyTo === sentId) ?? null
  );
}

export function getSentReplyForReceived(receivedId: string): Promise<Letter | null> {
  return withDB(
    (db) =>
      new Promise<Letter | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const typeIndex = store.index('type');
        const request = typeIndex.getAll('sent');
        request.onsuccess = () => {
          const all = request.result as Letter[];
          const found = all.find((l) => l.replyTo === receivedId) ?? null;
          resolve(found);
        };
        request.onerror = () => reject(request.error);
      }),
    () => fallbackStore.find((l) => l.type === 'sent' && l.replyTo === receivedId) ?? null
  );
}

export function hasUserRepliedTo(receivedIds: string[]): Promise<Set<string>> {
  return withDB(
    (db) =>
      new Promise<Set<string>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const typeIndex = store.index('type');
        const request = typeIndex.getAll('sent');
        request.onsuccess = () => {
          const allSent = request.result as Letter[];
          const repliedIds = new Set<string>();
          for (const sent of allSent) {
            if (sent.replyTo && receivedIds.includes(sent.replyTo)) {
              repliedIds.add(sent.replyTo);
            }
          }
          resolve(repliedIds);
        };
        request.onerror = () => reject(request.error);
      }),
    () => {
      const repliedIds = new Set<string>();
      for (const l of fallbackStore) {
        if (l.type === 'sent' && l.replyTo && receivedIds.includes(l.replyTo)) {
          repliedIds.add(l.replyTo);
        }
      }
      return repliedIds;
    }
  );
}

export function deleteLetter(id: string): Promise<void> {
  return withDB(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    () => {
      const idx = fallbackStore.findIndex((l) => l.id === id);
      if (idx >= 0) {
        fallbackStore.splice(idx, 1);
      }
    }
  );
}

export function clearAllLetters(): Promise<void> {
  return withDB(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    () => {
      fallbackStore.length = 0;
    }
  );
}

export function bulkPutLetters(letters: Letter[]): Promise<void> {
  return withDB(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const letter of letters) {
          store.put(letter);
        }
        const req = store.count();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
    () => {
      for (const letter of letters) {
        const idx = fallbackStore.findIndex((l: Letter) => l.id === letter.id);
        if (idx >= 0) fallbackStore[idx] = letter;
        else fallbackStore.push(letter);
      }
    }
  );
}

export function replaceAllLetters(letters: Letter[]): Promise<void> {
  return withDB(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
          for (const letter of letters) {
            store.add(letter);
          }
          const req = store.count();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        };
        clearReq.onerror = () => reject(clearReq.error);
      }),
    () => {
      fallbackStore.length = 0;
      for (const letter of letters) {
        fallbackStore.push(letter);
      }
    }
  );
}


