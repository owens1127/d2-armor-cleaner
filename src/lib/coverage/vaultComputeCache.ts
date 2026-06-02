import { analyzeDesiredBuilds } from '@/lib/coverage/analyze';
import type { CoverageAnalysis } from '@/lib/coverage/analyze';
import type { BuildProfile } from '@/lib/coverage/builds';
import { countEligibleBuildBadgesByInstance } from '@/lib/coverage/loadout';
import type { ArmorPiece, ClassPreferenceProfile, ClassType, DupeBucket, Stat } from '@/types';

const MAX_CACHE_ENTRIES = 24;

/** FNV-1a 32-bit — fast, stable enough for cache keys. */
function fnv1aUpdate(hash: number, text: string): number {
  let h = hash;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mixPiece(hash: number, piece: ArmorPiece): number {
  let h = hash;
  h = fnv1aUpdate(h, piece.instanceId);
  h = fnv1aUpdate(h, piece.dimTag ?? 'none');
  h = fnv1aUpdate(h, piece.archetype);
  h = fnv1aUpdate(h, piece.tertiaryStat);
  h = fnv1aUpdate(h, piece.tuningStat ?? 'none');
  h = fnv1aUpdate(h, String(piece.tier ?? ''));
  h = fnv1aUpdate(h, String(piece.armorSet?.hash ?? ''));
  return h;
}

/** Vault armor fingerprint — invalidates when pieces or roll-relevant fields change. */
export function fingerprintArmorItems(items: readonly ArmorPiece[]): string {
  let h = 0x811c9dc5;
  for (const piece of items) {
    h = mixPiece(h, piece);
  }
  return `${items.length}:${h.toString(36)}`;
}

export function fingerprintDupeBuckets(buckets: readonly DupeBucket[]): string {
  let h = 0x811c9dc5;
  h = fnv1aUpdate(h, String(buckets.length));
  for (const bucket of buckets) {
    h = fnv1aUpdate(h, bucket.key.archetype);
    h = fnv1aUpdate(h, bucket.key.armorSlot);
    h = fnv1aUpdate(h, bucket.key.tertiaryStat);
    h = fnv1aUpdate(h, String(bucket.items.length));
  }
  return h.toString(36);
}

/** Combo prefs fingerprint — desired builds and per-slot representatives. */
export function fingerprintCoveragePrefs(prefs: ClassPreferenceProfile): string {
  return JSON.stringify({
    desiredBuilds: prefs.desiredBuilds,
    statWeights: prefs.statWeights,
    archetypeWeights: prefs.archetypeWeights,
    tertiaryWeights: prefs.tertiaryWeights,
    tuningWeights: prefs.tuningWeights,
    setWeights: prefs.setWeights,
  });
}

export function vaultCoverageCacheKey(
  items: readonly ArmorPiece[],
  buckets: readonly DupeBucket[],
  prefs: ClassPreferenceProfile,
): string {
  return `cov:${fingerprintArmorItems(items)}:${fingerprintDupeBuckets(buckets)}:${fingerprintCoveragePrefs(prefs)}`;
}

const store = new Map<string, unknown>();

function trimCache(): void {
  while (store.size > MAX_CACHE_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function getOrComputeVaultCache<T>(key: string, compute: () => T): T {
  const hit = store.get(key);
  if (hit !== undefined) return hit as T;
  const value = compute();
  store.set(key, value);
  trimCache();
  return value;
}

/** Clears module cache (tests only). */
export function clearVaultComputeCache(): void {
  store.clear();
}

export function getCachedDesiredBuildAnalyses(
  items: ArmorPiece[],
  buckets: DupeBucket[],
  prefs: ClassPreferenceProfile,
  classType: ClassType,
): CoverageAnalysis[] {
  const key = `analyses:${vaultCoverageCacheKey(items, buckets, prefs)}:${classType}`;
  return getOrComputeVaultCache(key, () =>
    analyzeDesiredBuilds(items, buckets, prefs, classType),
  );
}

export function getCachedComboBadgeCounts(
  items: readonly ArmorPiece[],
  builds: readonly Pick<BuildProfile, 'statTargets' | 'setBonus2pc' | 'setBonus4pc'>[],
  cacheKeySuffix: string,
): ReadonlyMap<string, number> {
  const key = `badges:${fingerprintArmorItems(items)}:${cacheKeySuffix}`;
  return getOrComputeVaultCache(key, () => countEligibleBuildBadgesByInstance(items, builds));
}

export function patternGridCacheKey(input: {
  itemsFingerprint: string;
  buildId: string;
  focusStats: readonly Stat[];
  setBonus2pc?: number;
  setBonus4pc?: number;
  representativesFingerprint: string;
}): string {
  return [
    'grid',
    input.itemsFingerprint,
    input.buildId,
    input.focusStats.join(','),
    String(input.setBonus2pc ?? ''),
    String(input.setBonus4pc ?? ''),
    input.representativesFingerprint,
  ].join(':');
}

export function fingerprintRollRepresentatives(input: {
  rollPatternSlotRepresentatives?: unknown;
  rollPatternRepresentatives?: unknown;
  tuningRepresentatives?: unknown;
  slotRepresentatives?: unknown;
}): string {
  return JSON.stringify(input);
}
