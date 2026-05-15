/**
 * IndexedDB blob store for Sketchfab `.glb` model bodies.
 *
 * Sketchfab signed download URLs expire in minutes; the binary body
 * doesn't. After the first download we stash the Blob keyed by
 * Sketchfab UID so subsequent loads of the same activity don't hit
 * Sketchfab again. Cache survives tab close (IndexedDB is persistent);
 * users can clear it via the Sketchfab section in ConnectionsPane.
 *
 * Stored as { buffer: ArrayBuffer, type: string } rather than a raw
 * Blob so that structured-clone (used by IndexedDB and fake-indexeddb)
 * can round-trip the binary data in all environments including jsdom.
 *
 * Single object store, no indexes — UID → BlobRecord. Schema upgrades
 * from here should add a new store version, not mutate the existing one.
 */

const DB_NAME = "kukui-sketchfab";
const DB_VERSION = 1;
const STORE = "models";

interface BlobRecord {
  buffer: ArrayBuffer;
  type: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const out = fn(store);
      tx.oncomplete = () => Promise.resolve(out).then(resolve, reject);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
    });
  } finally {
    db.close();
  }
}

/**
 * Extract an ArrayBuffer from a Blob in a way that works in both
 * modern browsers (blob.arrayBuffer) and jsdom (FileReader).
 */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  // jsdom fallback
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader error"));
    reader.readAsArrayBuffer(blob);
  });
}

export async function cacheModelBlob(uid: string, blob: Blob): Promise<void> {
  const buffer = await blobToArrayBuffer(blob);
  const record: BlobRecord = { buffer, type: blob.type };
  await withStore("readwrite", (store) => {
    store.put(record, uid);
  });
}

export function loadCachedModelBlob(uid: string): Promise<Blob | null> {
  return withStore("readonly", (store) => {
    return new Promise<Blob | null>((resolve, reject) => {
      const req = store.get(uid);
      req.onsuccess = () => {
        const record = req.result as BlobRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        resolve(new Blob([record.buffer], { type: record.type }));
      };
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB get failed"));
    });
  });
}

export function cachedModelCount(): Promise<number> {
  return withStore("readonly", (store) => {
    return new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB count failed"));
    });
  });
}

export function clearAllCachedModels(): Promise<void> {
  return withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB clear failed"));
    });
  });
}
