import type { ArmorPiece, Stat } from '@/types';
import { STATS } from '@/lib/constants';

/** Per-stat bonus on each rolled stat when the piece is masterworked. */
export const MASTERWORK_STAT_BONUS = 2;

function cloneStats(stats: Partial<Record<Stat, number>>): Partial<Record<Stat, number>> {
  return { ...stats };
}

function statsOnPiece(stats: Partial<Record<Stat, number>>): Stat[] {
  return STATS.filter((s) => (stats[s] ?? 0) > 0);
}

/**
 * Intrinsic roll + masterwork (+2 per rolled line). Excludes transferable stat mods.
 * Used for optional display when showing MW-adjusted roll without mods.
 */
export function rollStats(item: ArmorPiece): Partial<Record<Stat, number>> {
  const out = cloneStats(item.baseStats);
  if (item.isMasterwork) {
    for (const s of statsOnPiece(out)) {
      out[s] = (out[s] ?? 0) + MASTERWORK_STAT_BONUS;
    }
  }
  return out;
}

/**
 * In-game worn totals: intrinsic roll + equipped stat mods + masterwork (+2 per rolled line).
 * `baseStats` on ArmorPiece are intrinsic only; `modStats` are socket stat mods when set.
 * For UI roll display and comparisons use `intrinsicStats`: never this for armor cards.
 */
export function effectiveStats(item: ArmorPiece): Partial<Record<Stat, number>> {
  const out = rollStats(item);
  if (item.modStatsAdditive) {
    for (const stat of STATS) {
      const mod = item.modStats?.[stat] ?? 0;
      if (mod) out[stat] = (out[stat] ?? 0) + mod;
    }
  }
  return out;
}

/** True when worn totals match on the given stat lines (mods + masterwork included). */
export function wornStatsEqual(a: ArmorPiece, b: ArmorPiece, stats: Stat[]): boolean {
  const aWorn = effectiveStats(a);
  const bWorn = effectiveStats(b);
  for (const stat of stats) {
    if ((aWorn[stat] ?? 0) !== (bWorn[stat] ?? 0)) return false;
  }
  return true;
}
