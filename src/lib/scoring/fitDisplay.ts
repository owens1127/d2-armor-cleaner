import type { ScoreBreakdown } from '@/types';

/** Clamp internal score to a 0–100 display percentage (never negative). */
export function matchPercent(total: number): number {
  return Math.max(0, Math.round(total * 100));
}

/**
 * User-facing match label for a piece.
 * Dominated rolls show plain language instead of a negative percentage.
 */
export function formatMatchScore(breakdown: ScoreBreakdown): string {
  if (breakdown.dominance < 0) return 'Poor match';
  return `${matchPercent(breakdown.total)}% match`;
}

/** Non-negative gap between two pieces for duel banners. */
export function matchGapPercent(a: ScoreBreakdown, b: ScoreBreakdown): number {
  return Math.abs(a.total - b.total) * 100;
}

/** Short gap copy for suggested-keep banners. */
export function formatMatchGap(gapPercent: number): string {
  if (gapPercent < 1) return 'Close call';
  return `${Math.round(gapPercent)}% apart`;
}
