import { manifestCacheKey } from '@/lib/bungie/manifestCache';
import { clearManifestMemoryCache } from '@/lib/bungie/manifest';
import { resetManifestLocaleSyncState } from '@/lib/bungie/manifestLocaleSync';
import { MANIFEST_LOCALES } from '@/i18n/manifestLocales';
import { clearManifestArmorSetIcons } from '@/lib/items/setIcons';
import { clearVaultComputeCache } from '@/lib/coverage/vaultComputeCache';
import {
  IDB_MANIFEST_KEY,
  IDB_MANIFEST_STORE,
  IDB_VAULT_STORE,
  LEGACY,
} from './keys';
import { deleteIndexedDb, idbDelete, idbGetAllKeys, openAppDb } from './idb';

/** Known manifest IDB keys (per-locale + legacy English key). */
export function collectManifestVaultIdbKeys(extraKeys: string[] = []): string[] {
  const keys = new Set<string>([
    IDB_MANIFEST_KEY,
    ...MANIFEST_LOCALES.map((locale) => manifestCacheKey(locale)),
    ...extraKeys,
  ]);
  return [...keys];
}

async function clearIdbStore(db: IDBDatabase, store: string): Promise<void> {
  const keys = await idbGetAllKeys(db, store);
  await Promise.all(keys.map((key) => idbDelete(db, store, key)));
}

/**
 * Clear manifest and vault caches only (IDB + in-memory).
 * Keeps prefs, auth tokens, locale, onboarding, and dupe rules.
 */
export async function clearManifestVaultCacheOnly(): Promise<void> {
  clearManifestMemoryCache();
  clearManifestArmorSetIcons();
  clearVaultComputeCache();
  resetManifestLocaleSyncState();

  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await openAppDb();
      await clearIdbStore(db, IDB_MANIFEST_STORE);
      await clearIdbStore(db, IDB_VAULT_STORE);
      db.close();
    } catch {
      // Best-effort; reload will refetch anyway.
    }
    await deleteIndexedDb(LEGACY.idbVault);
    await deleteIndexedDb(LEGACY.idbManifest);
  }
}
