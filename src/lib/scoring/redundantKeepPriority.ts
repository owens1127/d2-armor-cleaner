import type { ArmorPiece, ClassPreferenceProfile } from '@/types';
import { STATS } from '@/lib/constants';
import { intrinsicStats } from '@/lib/armor/intrinsicCompare';
import { armorIsDimKeepOrFavorite } from '@/lib/dim/parseTags';

/** Set preference from calibration / dupe learning (`setWeights`). */
export function preferredSetWeight(
  item: ArmorPiece,
  prefs: ClassPreferenceProfile,
): number {
  if (!item.armorSet) return 0.4;
  return prefs.setWeights[item.armorSet.hash] ?? 0.4;
}

/** Tuning preference from calibration / dupe learning (`tuningWeights`). */
export function preferredTuningWeight(
  item: ArmorPiece,
  prefs: ClassPreferenceProfile,
): number {
  if (!item.tuningStat) return 0.3;
  return prefs.tuningWeights[item.archetype]?.[item.tuningStat] ?? 0.5;
}

/** Power, intrinsic sum, DIM tags: after set / tuning / MW tiebreakers. */
export function redundantKeepTailScore(item: ArmorPiece): number {
  let statSum = 0;
  for (const stat of STATS) statSum += intrinsicStats(item)[stat] ?? 0;
  let score = item.power * 100 + statSum;
  if (armorIsDimKeepOrFavorite(item)) score += 200;
  return score;
}

/**
 * Sort key for which interchangeable piece to keep (higher = keep).
 * Order: preferred set → preferred tuning → masterwork → power / tags.
 */
export function redundantKeepRank(
  item: ArmorPiece,
  prefs: ClassPreferenceProfile,
): number {
  const setTier = preferredSetWeight(item, prefs) * 1e6;
  const tuneTier = preferredTuningWeight(item, prefs) * 1e4;
  const mwTier = item.isMasterwork ? 1e3 : 0;
  return setTier + tuneTier + mwTier + redundantKeepTailScore(item);
}

/** Positive when `a` should be kept over `b` (same redundant peer group). */
export function compareRedundantKeepPriority(
  a: ArmorPiece,
  b: ArmorPiece,
  prefs: ClassPreferenceProfile,
): number {
  return redundantKeepRank(a, prefs) - redundantKeepRank(b, prefs);
}

export function sortByRedundantKeepPriority(
  items: ArmorPiece[],
  prefs: ClassPreferenceProfile,
): ArmorPiece[] {
  return [...items].sort(
    (a, b) => compareRedundantKeepPriority(b, a, prefs),
  );
}
