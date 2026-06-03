import { intrinsicStatsEqual } from '@/lib/armor/intrinsicCompare';
import {
  isTierSingletonRoll,
  matchesRollProfileAndTier,
  type CountRollProfilePeersOptions,
} from '@/lib/armor/uniqueRoll';
import { isBuildOptimalPiece } from '@/lib/coverage/buildOptimal';
import { matchPercent } from '@/lib/scoring/fitDisplay';
import type {
  ArmorPiece,
  ClassPreferenceProfile,
  DupeRuleConfig,
  ScoreBreakdown,
} from '@/types';

/** Minimum display match % for both pieces before suppressing a duel suggestion. */
export const DUEL_SUGGESTION_MIN_MATCH_PERCENT = 70;

/**
 * True when two duel peers differ only cosmetically (power, location, tags, instance id).
 * Requires matching intrinsic stats plus roll profile, altar tier, and armor set.
 */
export function isFullyIdenticalDuel(a: ArmorPiece, b: ArmorPiece): boolean {
  if (!intrinsicStatsEqual(a, b)) return false;
  if (!matchesRollProfileAndTier(a, b)) return false;
  return (a.armorSet?.hash ?? null) === (b.armorSet?.hash ?? null);
}

export type SuppressDuelSuggestionOptions = CountRollProfilePeersOptions;

export function isHighMatchScore(
  breakdown: ScoreBreakdown,
  minPercent = DUEL_SUGGESTION_MIN_MATCH_PERCENT,
): boolean {
  if (breakdown.dominance < 0) return false;
  return matchPercent(breakdown.total) >= minPercent;
}

/** Positive when `a` should be kept over `b` for enabled desired-build roll shapes. */
export function compareBuildOptimalKeepPriority(
  a: ArmorPiece,
  b: ArmorPiece,
  prefs: ClassPreferenceProfile,
): number {
  const aOpt = isBuildOptimalPiece(a, prefs);
  const bOpt = isBuildOptimalPiece(b, prefs);
  if (aOpt === bOpt) return 0;
  return aOpt ? 1 : -1;
}

/**
 * Skip a suggested pick when both pieces score ≥70% match and each is the only
 * vault copy at its altar tier for class + slot + archetype + tertiary + tuning.
 */
export function shouldSuppressDuelSuggestion(
  a: ArmorPiece,
  b: ArmorPiece,
  breakdownA: ScoreBreakdown,
  breakdownB: ScoreBreakdown,
  allItems: ArmorPiece[],
  dupeRules: DupeRuleConfig,
  options?: SuppressDuelSuggestionOptions,
): boolean {
  if (!isHighMatchScore(breakdownA) || !isHighMatchScore(breakdownB)) return false;
  if (!isTierSingletonRoll(a, allItems, dupeRules, options)) return false;
  if (!isTierSingletonRoll(b, allItems, dupeRules, options)) return false;
  return true;
}
