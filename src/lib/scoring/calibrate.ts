import type { ArmorPiece, Archetype, ArmorSetInfo, Stat } from '@/types';
import { ARCHETYPES, STATS, tertiaryStatsForArchetype } from '@/lib/constants';
import { resolveArmorSetInfoForHash } from '@/lib/items/setIcons';
import type { PairwiseDecision } from '@/lib/onboarding/storage';
import {
  greedyPairwiseCap,
  replayPairwiseRank,
  type PairwiseRank,
  type PairwiseRankOptions,
} from '@/lib/scoring/pairwiseRank';

/** Count tertiary stats on vault pieces for a focus archetype. */
export function countVaultTertiaries(
  items: ArmorPiece[],
  archetype: Archetype,
): Map<Stat, number> {
  const counts = new Map<Stat, number>();
  for (const item of items) {
    if (item.archetype !== archetype) continue;
    counts.set(item.tertiaryStat, (counts.get(item.tertiaryStat) ?? 0) + 1);
  }
  return counts;
}

/** Archetypes represented in the user's vault for this class. */
export function archetypesInVault(items: ArmorPiece[]): Archetype[] {
  const counts = new Map<Archetype, number>();
  for (const item of items) {
    counts.set(item.archetype, (counts.get(item.archetype) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a);
}

/** All six archetypes for pairwise calibration. */
export function calibrationArchetypes(): Archetype[] {
  return [...ARCHETYPES];
}

/** Default archetype rank list (all six, vault frequency not applied). */
export function defaultArchetypeOrder(): Archetype[] {
  return calibrationArchetypes();
}

/** Full six-archetype list with duplicates removed and any missing entries appended. */
export function normalizeArchetypeOrder(order: readonly Archetype[]): Archetype[] {
  const expected = defaultArchetypeOrder();
  if (order.length !== expected.length) return [...expected];

  const seen = new Set<Archetype>();
  const deduped: Archetype[] = [];
  for (const arch of order) {
    if (!ARCHETYPES.includes(arch) || seen.has(arch)) continue;
    seen.add(arch);
    deduped.push(arch);
  }
  for (const arch of expected) {
    if (!seen.has(arch)) deduped.push(arch);
  }
  return deduped.length === expected.length ? deduped : [...expected];
}

/** Default set hash rank list from vault frequency. */
export function defaultSetOrderHashes(items: ArmorPiece[]): number[] {
  return calibrationSetPieces(items).map((p) => p.armorSet!.hash);
}

const ARCHETYPE_COMPARISON_CAP = 9;
const TERTIARY_COMPARISON_CAP = 8;
const TUNING_COMPARISON_CAP = 7;
const SET_COMPARISON_CAP = 10;

export function maxArchetypeComparisons(): number {
  return greedyPairwiseCap(ARCHETYPES.length, ARCHETYPE_COMPARISON_CAP);
}

/** Tertiary stats to rank for one focus archetype, or a vault union when unspecified. */
export function calibrationTertiaryStats(
  items: ArmorPiece[],
  archetype?: Archetype,
): Stat[] {
  if (archetype) {
    return tertiaryStatsForPairing(archetype, items);
  }

  const ownedArchetypes =
    archetypesInVault(items).length > 0 ? archetypesInVault(items) : [...ARCHETYPES];
  if (ownedArchetypes.length === 1) {
    return tertiaryStatsForPairing(ownedArchetypes[0], items);
  }

  const seen = new Set<Stat>();
  const stats: Stat[] = [];
  for (const arch of ownedArchetypes) {
    for (const stat of tertiaryStatsForPairing(arch, items)) {
      if (seen.has(stat)) continue;
      seen.add(stat);
      stats.push(stat);
    }
  }
  return stats;
}

export function maxTertiaryComparisons(statCount: number): number {
  return greedyPairwiseCap(statCount, TERTIARY_COMPARISON_CAP);
}

/** Count tuned stats on vault pieces for a focus archetype. */
export function countVaultTuningStats(
  items: ArmorPiece[],
  archetype: Archetype,
): Map<Stat, number> {
  const counts = new Map<Stat, number>();
  for (const item of items) {
    if (item.archetype !== archetype || !item.tuningStat) continue;
    counts.set(item.tuningStat, (counts.get(item.tuningStat) ?? 0) + 1);
  }
  return counts;
}

/** Count tuning stats across all class vault pieces. */
export function countClassVaultTuningStats(items: ArmorPiece[]): Map<Stat, number> {
  const counts = new Map<Stat, number>();
  for (const item of items) {
    if (!item.tuningStat) continue;
    counts.set(item.tuningStat, (counts.get(item.tuningStat) ?? 0) + 1);
  }
  return counts;
}

/** Tuning stats to rank for one archetype. */
export function calibrationTuningStats(
  items: ArmorPiece[],
  archetype: Archetype,
): Stat[] {
  return tuningStatsForPairing(archetype, items);
}

/** Archetypes to calibrate tuning for (vault-owned, or all six when empty). */
export function calibrationTuningArchetypes(items: ArmorPiece[]): Archetype[] {
  const owned = archetypesInVault(items);
  return owned.length > 0 ? owned : [...ARCHETYPES];
}

export function maxTuningComparisons(statCount: number): number {
  return greedyPairwiseCap(statCount, TUNING_COMPARISON_CAP);
}

/** Prefer the richest perk list for a set hash across vault pieces (manifest fallback). */
export function resolveArmorSetInfo(
  items: ArmorPiece[],
  piece: ArmorPiece,
): ArmorSetInfo | undefined {
  const hash = piece.armorSet?.hash;
  if (!hash) return undefined;
  return resolveArmorSetInfoForHash(hash, items);
}

/** Piece count per armor set hash in the vault. */
export function countVaultSetPieces(items: ArmorPiece[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const item of items) {
    const hash = item.armorSet?.hash;
    if (hash === undefined) continue;
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }
  return counts;
}

/** One vault piece per armor set hash (richest perk list wins). */
export function representativeSetPieces(items: ArmorPiece[]): ArmorPiece[] {
  const withSet = items.filter((i) => i.armorSet);
  const byHash = new Map<number, ArmorPiece>();

  for (const piece of withSet) {
    const hash = piece.armorSet!.hash;
    const existing = byHash.get(hash);
    if (!existing) {
      byHash.set(hash, piece);
      continue;
    }
    const existingPerks = resolveArmorSetInfo(items, existing)?.perks.length ?? 0;
    const nextPerks = resolveArmorSetInfo(items, piece)?.perks.length ?? 0;
    if (nextPerks > existingPerks) byHash.set(hash, piece);
  }

  return [...byHash.values()];
}

/**
 * Representative set pieces ordered by vault ownership (most pieces first),
 * tie-breaking by set hash for stable ordering.
 */
export function orderRepresentativeSetsByVaultFrequency(
  items: ArmorPiece[],
): ArmorPiece[] {
  const counts = countVaultSetPieces(items);
  return representativeSetPieces(items).sort((a, b) => {
    const countDiff =
      (counts.get(b.armorSet!.hash) ?? 0) - (counts.get(a.armorSet!.hash) ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.armorSet!.hash - b.armorSet!.hash;
  });
}

/** Unique armor sets in vault for pairwise calibration (prior = vault frequency). */
export function calibrationSetPieces(items: ArmorPiece[]): ArmorPiece[] {
  return orderRepresentativeSetsByVaultFrequency(items);
}

export function maxSetComparisons(setCount: number): number {
  return greedyPairwiseCap(setCount, SET_COMPARISON_CAP);
}

function decisionsToReplay<T extends string | number>(decisions: PairwiseDecision[]) {
  return decisions.map((d) => {
    if ('tie' in d && d.tie) {
      return { tie: [d.a as T, d.b as T] as [T, T] };
    }
    const pick = d as { winner: string; loser: string };
    return { winner: pick.winner as T, loser: pick.loser as T };
  });
}

function archetypeRankerOptions(): PairwiseRankOptions<Archetype> {
  return {
    priorOrder: calibrationArchetypes(),
    maxComparisons: maxArchetypeComparisons(),
    greedyTopK: 3,
  };
}

export function buildArchetypeRanker(
  decisions: PairwiseDecision[],
): PairwiseRank<Archetype> {
  return replayPairwiseRank<Archetype>(
    calibrationArchetypes(),
    decisionsToReplay<Archetype>(decisions),
    archetypeRankerOptions(),
  );
}

export function buildTertiaryRanker(
  items: ArmorPiece[],
  decisions: PairwiseDecision[],
  archetype?: Archetype,
): PairwiseRank<Stat> {
  const stats = calibrationTertiaryStats(items, archetype);
  return replayPairwiseRank<Stat>(stats, decisionsToReplay<Stat>(decisions), {
    priorOrder: stats,
    maxComparisons: maxTertiaryComparisons(stats.length),
    greedyTopK: 2,
  });
}

export function buildTuningRanker(
  items: ArmorPiece[],
  archetype: Archetype,
  decisions: PairwiseDecision[],
): PairwiseRank<Stat> {
  const stats = calibrationTuningStats(items, archetype);
  return replayPairwiseRank<Stat>(stats, decisionsToReplay<Stat>(decisions), {
    priorOrder: stats,
    maxComparisons: maxTuningComparisons(stats.length),
    greedyTopK: 2,
  });
}

function setDecisionsToReplay(decisions: PairwiseDecision[]) {
  return decisions.map((d) => {
    if ('tie' in d && d.tie) {
      return { tie: [Number(d.a), Number(d.b)] as [number, number] };
    }
    const pick = d as { winner: string; loser: string };
    return { winner: Number(pick.winner), loser: Number(pick.loser) };
  });
}

export function buildSetRanker(
  items: ArmorPiece[],
  decisions: PairwiseDecision[],
): PairwiseRank<number> {
  const sets = calibrationSetPieces(items);
  const hashes = sets.map((p) => p.armorSet!.hash);
  return replayPairwiseRank<number>(hashes, setDecisionsToReplay(decisions), {
    priorOrder: hashes,
    maxComparisons: maxSetComparisons(hashes.length),
    greedyTopK: 3,
  });
}

export function orderTertiaryStatsForCalibration(
  archetype: Archetype,
  items?: ArmorPiece[],
): Stat[] {
  const valid = tertiaryStatsForArchetype(archetype);
  if (!items?.length) return valid;

  const counts = countVaultTertiaries(items, archetype);
  return [...valid].sort((a, b) => {
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return valid.indexOf(a) - valid.indexOf(b);
  });
}

export function tertiaryStatsForPairing(
  archetype: Archetype,
  items?: ArmorPiece[],
): Stat[] {
  const ordered = orderTertiaryStatsForCalibration(archetype, items);
  if (!items?.length) return ordered;

  const counts = countVaultTertiaries(items, archetype);
  const vaultPresent = ordered.filter((s) => (counts.get(s) ?? 0) > 0);
  return vaultPresent.length >= 2 ? vaultPresent : ordered;
}

export function orderTuningStatsForCalibration(
  archetype: Archetype,
  items?: ArmorPiece[],
): Stat[] {
  if (!items?.length) return [...STATS];

  const counts = countVaultTuningStats(items, archetype);
  return [...STATS].sort((a, b) => {
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return STATS.indexOf(a) - STATS.indexOf(b);
  });
}

export function tuningStatsForPairing(
  archetype: Archetype,
  items?: ArmorPiece[],
): Stat[] {
  const ordered = orderTuningStatsForCalibration(archetype, items);
  if (!items?.length) return ordered;

  const counts = countVaultTuningStats(items, archetype);
  const vaultPresent = ordered.filter((s) => (counts.get(s) ?? 0) > 0);
  return vaultPresent.length >= 2 ? vaultPresent : ordered;
}
