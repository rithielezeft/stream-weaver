import type { Channel } from "./m3u";

/**
 * Guarda a lista importada no próprio dispositivo (IndexedDB), para o cliente
 * não precisar carregar tudo de novo a cada visita. IndexedDB — e não
 * localStorage — porque listas de IPTV passam facilmente de 5 MB.
 */

const DB_NAME = "vela-tv";
const STORE = "playlists";
const KEY = "current";

export interface SavedPlaylist {
  channels: Channel[];
  source: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB indisponível"));
  });
}

export async function loadPlaylist(): Promise<SavedPlaylist | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const value = await new Promise<SavedPlaylist | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as SavedPlaylist | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value && Array.isArray(value.channels) && value.channels.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function savePlaylist(channels: Channel[], source: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ channels, source, savedAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* espaço cheio ou modo privado: seguimos sem salvar */
  }
}

export async function clearPlaylist(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* noop */
  }
}
