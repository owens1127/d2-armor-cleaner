import {
  SS_BUNGIE_EXPIRES,
  SS_BUNGIE_REFRESH,
  SS_BUNGIE_TOKEN,
  SS_DIM_TOKEN,
  SS_MEMBERSHIP,
} from '@/lib/storage/keys';

/** Persisted across tabs (OAuth tokens + membership + DIM token). */
export const BUNGIE_AUTH_STORAGE_KEYS = [
  SS_BUNGIE_TOKEN,
  SS_BUNGIE_REFRESH,
  SS_BUNGIE_EXPIRES,
  SS_MEMBERSHIP,
  SS_DIM_TOKEN,
] as const;

let sessionToLocalMigrated = false;

function migrateSessionAuthToLocal(): void {
  if (sessionToLocalMigrated) return;
  sessionToLocalMigrated = true;
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;

  for (const key of BUNGIE_AUTH_STORAGE_KEYS) {
    if (localStorage.getItem(key) != null) continue;
    const fromSession = sessionStorage.getItem(key);
    if (fromSession != null) {
      localStorage.setItem(key, fromSession);
    }
  }
}

export function getBungieAuthItem(key: (typeof BUNGIE_AUTH_STORAGE_KEYS)[number]): string | null {
  migrateSessionAuthToLocal();
  return localStorage.getItem(key);
}

export function setBungieAuthItem(key: (typeof BUNGIE_AUTH_STORAGE_KEYS)[number], value: string): void {
  migrateSessionAuthToLocal();
  localStorage.setItem(key, value);
}

export function removeBungieAuthItem(key: (typeof BUNGIE_AUTH_STORAGE_KEYS)[number]): void {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function clearBungieAuthStorage(): void {
  for (const key of BUNGIE_AUTH_STORAGE_KEYS) {
    removeBungieAuthItem(key);
  }
}

/** React to login/logout/token refresh in another tab (`storage` does not fire in the writer tab). */
export function subscribeBungieAuthSync(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (!event.key || !(BUNGIE_AUTH_STORAGE_KEYS as readonly string[]).includes(event.key)) return;
    onChange();
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
