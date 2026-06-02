import type { ArmorPiece, Stat } from '@/types';
import { ARCHETYPE_STATS, STATS } from '@/lib/constants';

export interface IntrinsicStatDelta {
  stat: Stat;
  delta: number;
}

/**
 * Modless, masterworkless intrinsic roll lines on an armor piece.
 *
 * Contract: `ArmorPiece.baseStats` from hidden socket roll plugs (`intrinsicStatsFromHiddenPlugs`).
 * **Always use for redundancy/dominance comparisons: never `effectiveStats`.**
 *
 * Note: `effectiveStats.rollStats` adds masterwork (+2 per line) for display;
 * use this module when comparing rolls between peers.
 */
export function intrinsicStats(item: ArmorPiece): Partial<Record<Stat, number>> {
  return item.baseStats;
}

/** @alias intrinsicStats: not `effectiveStats.rollStats` (which includes masterwork). */
export const rollStats = intrinsicStats;

export function intrinsicStatValue(item: ArmorPiece, stat: Stat): number {
  return intrinsicStats(item)[stat] ?? 0;
}

/** Signed delta on one intrinsic line: `a - b`. */
export function intrinsicStatDelta(a: ArmorPiece, b: ArmorPiece, stat: Stat): number {
  return intrinsicStatValue(a, stat) - intrinsicStatValue(b, stat);
}

/**
 * Every stat line that matters for T5 budget comparisons between two peers.
 * Archetype primaries, tertiary, tuning targets, and any non-zero intrinsic line.
 */
export function budgetRelevantIntrinsicStats(a: ArmorPiece, b: ArmorPiece): Stat[] {
  const aRoll = intrinsicStats(a);
  const bRoll = intrinsicStats(b);
  const relevant = new Set<Stat>();

  for (const piece of [a, b]) {
    const [primary, secondary] = ARCHETYPE_STATS[piece.archetype];
    relevant.add(primary);
    relevant.add(secondary);
    relevant.add(piece.tertiaryStat);
    if (piece.tuningStat) relevant.add(piece.tuningStat);
  }

  for (const stat of STATS) {
    if ((aRoll[stat] ?? 0) !== 0 || (bRoll[stat] ?? 0) !== 0) {
      relevant.add(stat);
    }
  }

  return STATS.filter((s) => relevant.has(s));
}

/**
 * Signed intrinsic-roll deltas on comparable budget lines (`a - b`).
 * Returns `[]` when tertiary rolls differ.
 */
export function intrinsicStatDeltas(
  a: ArmorPiece,
  b: ArmorPiece,
  stats?: Stat[],
): IntrinsicStatDelta[] {
  if (a.tertiaryStat !== b.tertiaryStat) return [];

  const lines = stats ?? budgetRelevantIntrinsicStats(a, b);
  return lines.map((stat) => ({
    stat,
    delta: intrinsicStatDelta(a, b, stat),
  }));
}

/** True when both pieces match on every budget-relevant intrinsic line. */
export function intrinsicStatsEqual(
  a: ArmorPiece,
  b: ArmorPiece,
  stats?: Stat[],
): boolean {
  const lines = stats ?? budgetRelevantIntrinsicStats(a, b);
  for (const stat of lines) {
    if (intrinsicStatValue(a, stat) !== intrinsicStatValue(b, stat)) return false;
  }
  return true;
}

/** @alias intrinsicStatsEqual */
export const sameIntrinsicRoll = intrinsicStatsEqual;
