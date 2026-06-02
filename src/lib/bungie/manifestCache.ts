import { bungieFetch } from './client';
import type { ManifestTables } from './manifest';
import { idbGet, idbPut, openAppDb } from '@/lib/storage/idb';
import { IDB_MANIFEST_KEY, IDB_MANIFEST_STORE } from '@/lib/storage/keys';

export interface CachedManifest {
  version: string;
  tables: ManifestTables;
}

/** Read cached manifest regardless of version (for stale-while-revalidate). */
export async function readCachedManifest(): Promise<CachedManifest | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openAppDb();
    const cached = await idbGet<CachedManifest>(db, IDB_MANIFEST_STORE, IDB_MANIFEST_KEY);
    db.close();
    return cached;
  } catch {
    return null;
  }
}

export async function readManifestCache(version: string): Promise<ManifestTables | null> {
  const cached = await readCachedManifest();
  if (!cached || cached.version !== version) return null;
  return cached.tables;
}

export async function writeManifestCache(
  version: string,
  tables: ManifestTables,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAppDb();
    await idbPut(db, IDB_MANIFEST_STORE, IDB_MANIFEST_KEY, { version, tables });
    db.close();
  } catch {
    /* cache is best-effort */
  }
}

export async function fetchManifestVersion(): Promise<string> {
  const info = await bungieFetch<{ version: string }>('/Platform/Destiny2/Manifest/');
  return info.version;
}
