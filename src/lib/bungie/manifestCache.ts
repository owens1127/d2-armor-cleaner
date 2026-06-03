import type { AppLocale } from '@/i18n/manifestLocales';
import { bungieFetch } from './client';
import type { ManifestTables } from './manifest';
import { idbGet, idbPut, openAppDb } from '@/lib/storage/idb';
import { IDB_MANIFEST_KEY, IDB_MANIFEST_STORE } from '@/lib/storage/keys';

export function manifestCacheKey(locale: AppLocale): string {
  return `destiny-manifest-${locale}`;
}

export interface CachedManifest {
  version: string;
  tables: ManifestTables;
}

/** Read cached manifest regardless of version (for stale-while-revalidate). */
export async function readCachedManifest(
  locale: AppLocale = 'en',
): Promise<CachedManifest | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openAppDb();
    const key = manifestCacheKey(locale);
    let cached = await idbGet<CachedManifest>(db, IDB_MANIFEST_STORE, key);
    if (!cached && locale === 'en') {
      cached = await idbGet<CachedManifest>(db, IDB_MANIFEST_STORE, IDB_MANIFEST_KEY);
      if (cached) {
        await idbPut(db, IDB_MANIFEST_STORE, key, cached);
      }
    }
    db.close();
    return cached;
  } catch {
    return null;
  }
}

export async function readManifestCache(
  version: string,
  locale: AppLocale = 'en',
): Promise<ManifestTables | null> {
  const cached = await readCachedManifest(locale);
  if (!cached || cached.version !== version) return null;
  return cached.tables;
}

export async function writeManifestCache(
  version: string,
  tables: ManifestTables,
  locale: AppLocale = 'en',
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAppDb();
    await idbPut(db, IDB_MANIFEST_STORE, manifestCacheKey(locale), { version, tables });
    db.close();
  } catch {
    /* cache is best-effort */
  }
}

export async function fetchManifestVersion(): Promise<string> {
  const info = await bungieFetch<{ version: string }>('/Platform/Destiny2/Manifest/');
  return info.version;
}
