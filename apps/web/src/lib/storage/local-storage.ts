/**
 * SSR-safe typed wrapper around `window.localStorage`.
 *
 * - Never throws on the server (returns default / no-op).
 * - Corrupt JSON is logged once and treated as "missing" rather than crashing.
 * - All values are JSON. Callers own the shape.
 */

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readJSON<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[storage] Corrupt JSON at "${key}" — treating as missing.`, err);
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded, private mode, etc. — log but don't crash.
    console.error(`[storage] Failed to write "${key}".`, err);
  }
}

export function removeKey(key: string): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(key);
}

export function readCollection<T>(key: string): T[] {
  return readJSON<T[]>(key, []);
}

export function writeCollection<T>(key: string, items: T[]): void {
  writeJSON(key, items);
}
