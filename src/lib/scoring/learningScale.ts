import { intrinsicStatsEqual } from '@/lib/armor/diff';
import { matchGapPercent } from '@/lib/scoring/fitDisplay';
import { scoreItem } from '@/lib/scoring/score';
import type { ArmorPiece, ClassPreferenceProfile } from '@/types';

/** Match % gap at or below this is treated as a close call (minimum learning scale). */
export const LEARNING_CLOSE_CALL_GAP_PERCENT = 2;

/** Match % gap at or above this applies full learning rate. */
export const LEARNING_FULL_CONFIDENCE_GAP_PERCENT = 15;

/** Minimum multiplier on base learning rate for close calls. */
export const LEARNING_MIN_SCALE = 0.25;

/** Maximum multiplier on base learning rate (never exceeds 1). */
export const LEARNING_MAX_SCALE = 1;

/**
 * Scale a base learning rate by how far apart two pieces score.
 * Close calls (~2% match gap) use {@link LEARNING_MIN_SCALE}; gaps of 15%+ use full rate.
 */
export function learningScaleFromGapPercent(gapPercent: number): number {
  if (gapPercent <= LEARNING_CLOSE_CALL_GAP_PERCENT) return LEARNING_MIN_SCALE;
  if (gapPercent >= LEARNING_FULL_CONFIDENCE_GAP_PERCENT) return LEARNING_MAX_SCALE;

  const t =
    (gapPercent - LEARNING_CLOSE_CALL_GAP_PERCENT) /
    (LEARNING_FULL_CONFIDENCE_GAP_PERCENT - LEARNING_CLOSE_CALL_GAP_PERCENT);
  return LEARNING_MIN_SCALE + t * (LEARNING_MAX_SCALE - LEARNING_MIN_SCALE);
}

/** Effective learning rate after gap scaling (bounded by weight clamps in record* helpers). */
export function scaledLearningRate(baseLr: number, gapPercent: number): number {
  return baseLr * learningScaleFromGapPercent(gapPercent);
}

/**
 * Derive learning scale from current prefs and vault context (same scoring as duel compare).
 */
export function learningScaleFromPieces(
  winner: ArmorPiece,
  loser: ArmorPiece,
  prefs: ClassPreferenceProfile,
  allItems: ArmorPiece[],
): number {
  const peerDuel = intrinsicStatsEqual(winner, loser);
  const scoreOpts = peerDuel ? { peerDuel: true, ignoreDominance: true } : undefined;
  const breakdownWinner = scoreItem(winner, prefs, allItems, scoreOpts);
  const breakdownLoser = scoreItem(loser, prefs, allItems, scoreOpts);
  return learningScaleFromGapPercent(matchGapPercent(breakdownWinner, breakdownLoser));
}
