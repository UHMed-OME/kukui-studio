/**
 * IndexedDB blob store for course-presentation slide images.
 *
 * Imported decks (PDF / PowerPoint / Google Slides) rasterize to one PNG per
 * slide. Those bytes are far too large for the 2 MB localStorage draft cap
 * (apps/studio-app/src/drafts.ts), so the draft JSON keeps only a generated
 * `assetId` per slide background and the PNG lives here, keyed by that id.
 * Cache survives tab close (IndexedDB is persistent); authors can clear it
 * (see clearAllSlideAssets).
 *
 * Generalized from sketchfab/modelCache.ts — same structured-clone-safe
 * { buffer, type } record (so IndexedDB and fake-indexeddb round-trip the
 * binary in all environments including jsdom) and the same single-store,
 * no-index shape. Schema upgrades from here should add a new store version,
 * not mutate the existing one.
 */

const DB_NAME = "kukui-slides";
const DB_VERSION = 1;
const STORE = "images";

interface BlobRecord {
  buffer: ArrayBuffer;
  type: string;
}

/** Generate an opaque, collision-resistant asset id (no Math.random reliance). */
let assetSeq = 0;
export function newAssetId(): string {
  assetSeq += 1;
  const t = typeof performance !== "undefined" ? Math.floor(performance.now() * 1000) : 0;
  return `slide-${t.toString(36)}-${assetSeq.toString(36)}`;
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

/** Extract an ArrayBuffer from a Blob (browsers via .arrayBuffer, jsdom via FileReader). */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsArrayBuffer(blob);
  });
}

export async function putSlideAsset(id: string, blob: Blob): Promise<void> {
  const buffer = await blobToArrayBuffer(blob);
  const record: BlobRecord = { buffer, type: blob.type || "image/png" };
  await withStore("readwrite", (store) => {
    store.put(record, id);
  });
}

export function loadSlideAsset(id: string): Promise<Blob | null> {
  return withStore("readonly", (store) => {
    return new Promise<Blob | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const record = req.result as BlobRecord | undefined;
        resolve(record ? new Blob([record.buffer], { type: record.type }) : null);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
    });
  });
}

export function deleteSlideAsset(id: string): Promise<void> {
  return withStore("readwrite", (store) => {
    store.delete(id);
  });
}

export function slideAssetCount(): Promise<number> {
  return withStore("readonly", (store) => {
    return new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB count failed"));
    });
  });
}

export function clearAllSlideAssets(): Promise<void> {
  return withStore("readwrite", (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("IndexedDB clear failed"));
    });
  });
}
