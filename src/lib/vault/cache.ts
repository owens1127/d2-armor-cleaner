import type { ArmorPiece, TagValue } from '@/types';
import type { DimItemTagState } from '@/lib/dim/parseTags';
import { dimItemTagStateFromTag } from '@/lib/dim/localTagOverrides';
import { parseDimItemTag } from '@/lib/dim/parseTags';
import { idbDelete, idbGet, idbPut, openAppDb } from '@/lib/storage/idb';
import {
  IDB_VAULT_STORE,
  SS_VAULT_META,
} from '@/lib/storage/keys';

/** Bump when vault parse/fetch semantics change: stale small caches are dropped. */
export const VAULT_CACHE_SCHEMA_VERSION = 5;

export interface VaultCacheEntry {
  schemaVersion: number;
  destinyMembershipId: string;
  items: ArmorPiece[];
  lastParsedCount: number;
  dimTags: Record<string, DimItemTagState>;
  fetchedAt: number;
  parseDiagnostics?: import('@/lib/armor/parse').ParseDiagnostics;
  fetchDiagnostics?: import('@/lib/bungie/profile').FetchProfileDiagnostics;
}

export interface VaultCacheMeta {
  destinyMembershipId: string;
  fetchedAt: number;
  lastParsedCount: number;
}

import { VAULT_STALE_MS } from '@/lib/vault/refreshPolicy';

function writeVaultCacheMeta(meta: VaultCacheMeta): void {
  sessionStorage.setItem(SS_VAULT_META, JSON.stringify(meta));
}

export function clearVaultCacheMeta(): void {
  sessionStorage.removeItem(SS_VAULT_META);
}

export function isVaultCacheStale(
  fetchedAt: number | null | undefined,
  maxAgeMs = VAULT_STALE_MS,
): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt > maxAgeMs;
}

export async function readVaultCache(
  destinyMembershipId: string,
): Promise<VaultCacheEntry | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openAppDb();
    const entry = await idbGet<VaultCacheEntry>(db, IDB_VAULT_STORE, destinyMembershipId);
    db.close();
    if (!entry || entry.destinyMembershipId !== destinyMembershipId) return null;
    if (!Array.isArray(entry.items)) return null;
    if ((entry.schemaVersion ?? 0) < VAULT_CACHE_SCHEMA_VERSION) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function writeVaultCache(entry: VaultCacheEntry): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAppDb();
    await idbPut(db, IDB_VAULT_STORE, entry.destinyMembershipId, {
      ...entry,
      schemaVersion: VAULT_CACHE_SCHEMA_VERSION,
    });
    db.close();
    writeVaultCacheMeta({
      destinyMembershipId: entry.destinyMembershipId,
      fetchedAt: entry.fetchedAt,
      lastParsedCount: entry.lastParsedCount,
    });
  } catch {
    /* cache is best-effort */
  }
}

/** Best-effort patch of cached vault items/DIM tags after a local tag apply. */
export async function patchVaultCacheDimTags(
  destinyMembershipId: string,
  updates: { instanceId: string; tag: TagValue | null }[],
): Promise<void> {
  if (updates.length === 0) return;
  const cached = await readVaultCache(destinyMembershipId);
  if (!cached) return;

  const updateMap = new Map(updates.map((u) => [u.instanceId, u.tag]));
  const nextDimTags = { ...cached.dimTags };
  const nextItems = cached.items.map((item) => {
    const tag = updateMap.get(item.instanceId);
    if (tag === undefined) return item;
    const parsed = tag === null ? { dimTag: null, dimFavorite: false } : parseDimItemTag(tag);
    nextDimTags[item.instanceId] = dimItemTagStateFromTag(tag);
    return {
      ...item,
      dimTag: parsed.dimTag,
      dimFavorite: parsed.dimFavorite,
    };
  });

  await writeVaultCache({
    ...cached,
    items: nextItems,
    dimTags: nextDimTags,
  });
}

export async function clearVaultCache(destinyMembershipId?: string): Promise<void> {
  clearVaultCacheMeta();
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openAppDb();
    if (destinyMembershipId) {
      await idbDelete(db, IDB_VAULT_STORE, destinyMembershipId);
    }
    db.close();
  } catch {
    /* best-effort */
  }
}
