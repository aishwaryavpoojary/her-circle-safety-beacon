import { openDB, type IDBPDatabase } from "idb";

// Local mirror of everything the app needs offline.
// Stores: kv (settings, last location, guest data), queue (unsent GPS points),
// cache (police/hospital results), clips (fake-call voice recordings).
let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
  if (!dbPromise) {
    dbPromise = openDB("safe-her", 1, {
      upgrade(d) {
        d.createObjectStore("kv");
        d.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
        d.createObjectStore("cache");
        d.createObjectStore("clips", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get("kv", key)) as T | undefined;
  } catch {
    return undefined;
  }
}
export async function kvSet(key: string, value: unknown) {
  try {
    await (await db()).put("kv", value, key);
  } catch {
    /* storage unavailable */
  }
}

export type QueuedPoint = {
  id?: number;
  alert_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
};
export async function queueAdd(p: QueuedPoint) {
  await (await db()).add("queue", p);
}
export async function queueAll(): Promise<QueuedPoint[]> {
  return (await (await db()).getAll("queue")) as QueuedPoint[];
}
export async function queueRemove(ids: number[]) {
  const tx = (await db()).transaction("queue", "readwrite");
  await Promise.all(ids.map((i) => tx.store.delete(i)));
  await tx.done;
}

export async function cacheGet<T>(key: string) {
  try {
    return (await (await db()).get("cache", key)) as T | undefined;
  } catch {
    return undefined;
  }
}
export async function cacheSet(key: string, v: unknown) {
  await (await db()).put("cache", v, key);
}

export type Clip = { id: string; name: string; blob: Blob };
export async function clipsAll(): Promise<Clip[]> {
  try {
    return (await (await db()).getAll("clips")) as Clip[];
  } catch {
    return [];
  }
}
export async function clipAdd(c: Clip) {
  await (await db()).put("clips", c);
}
export async function clipRemove(id: string) {
  await (await db()).delete("clips", id);
}

export async function wipeLocal() {
  const d = await db();
  await Promise.all(["kv", "queue", "cache", "clips"].map((s) => d.clear(s)));
  localStorage.clear();
}
