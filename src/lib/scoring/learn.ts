import {
  archetypesDiffer,
  intrinsicStatsEqual,
  setHashesDiffer,
  tertiaryStatsDiffer,
  tuningStatsDiffer,
} from '@/lib/armor/diff';
import { intrinsicStatDelta } from '@/lib/armor/intrinsicCompare';
import type {
  ArmorPiece,
  ClassPreferenceProfile,
  ClassType,
  PreferenceProfile,
  Stat,
} from '@/types';
import { STATS } from '@/lib/constants';
import { recordCalibrationChoice } from '@/lib/prefs/calibrationChoices';
import { getClassPrefs, updateClassPrefs } from '@/lib/prefs/profile';
import { learningScaleFromPieces } from '@/lib/scoring/learningScale';
import {
  LR_TUNING,
  recordArchetypePreference,
  recordPairwiseWin,
  recordTertiaryPreference,
  recordTuningPreference,
} from '@/lib/scoring/score';

export type CleanPickDiffKind = 'set' | 'tuning' | 'stat';

export interface LearnFromCleanPickOptions {
  /** Vault items for score-gap scaling; omitted → full learning rate. */
  allItems?: ArmorPiece[];
  /** Explicit scale override (0–1]; takes precedence over allItems. */
  scale?: number;
}

/** Stable calibration key for a clean-page pairwise preference signal. */
export function cleanPickCalibrationKey(
  kind: CleanPickDiffKind,
  ...parts: (string | number)[]
): string {
  return `clean:${kind}:${parts.join(':')}`;
}

function canonicalPairKey(a: number | string, b: number | string): [string, string] {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? [sa, sb] : [sb, sa];
}

/** Largest winner-favored vs loser-favored intrinsic lines for stat-weight learning. */
function intrinsicStatPreferencePair(
  winner: ArmorPiece,
  loser: ArmorPiece,
): [Stat, Stat] | null {
  let bestGain: { stat: Stat; delta: number } | null = null;
  let bestLoss: { stat: Stat; delta: number } | null = null;

  for (const stat of STATS) {
    const delta = intrinsicStatDelta(winner, loser, stat);
    if (delta === 0) continue;
    if (delta > 0 && (!bestGain || delta > bestGain.delta)) {
      bestGain = { stat, delta };
    }
    if (delta < 0 && (!bestLoss || -delta > bestLoss.delta)) {
      bestLoss = { stat, delta: -delta };
    }
  }

  if (bestGain && bestLoss) return [bestGain.stat, bestLoss.stat];
  return null;
}

/**
 * Apply calibrate-style learning from a clean-page keep pick.
 * Detects what differed between winner/loser and bumps the relevant weight maps.
 */
export function learnFromCleanPick(
  winner: ArmorPiece,
  loser: ArmorPiece,
  prefs: ClassPreferenceProfile,
  options?: LearnFromCleanPickOptions,
): ClassPreferenceProfile {
  const scale =
    options?.scale ??
    (options?.allItems
      ? learningScaleFromPieces(winner, loser, prefs, options.allItems)
      : 1);
  let next = prefs;
  let changed = false;

  const bump = (fn: (p: ClassPreferenceProfile) => ClassPreferenceProfile) => {
    next = fn(next);
    changed = true;
  };

  const winnerSetHash = winner.armorSet?.hash;
  const loserSetHash = loser.armorSet?.hash;
  if (
    setHashesDiffer(winner, loser) &&
    winnerSetHash !== undefined &&
    loserSetHash !== undefined
  ) {
    bump((p) => recordPairwiseWin(p, 'setWeights', winnerSetHash, loserSetHash, scale));
    const [lo, hi] = canonicalPairKey(winnerSetHash, loserSetHash);
    bump((p) => recordCalibrationChoice(p, cleanPickCalibrationKey('set', lo, hi)));
  }

  if (tuningStatsDiffer(winner, loser)) {
    if (winner.tuningStat && loser.tuningStat) {
      bump((p) =>
        recordTuningPreference(p, winner.archetype, winner.tuningStat!, loser.tuningStat!, LR_TUNING, scale),
      );
      const [lo, hi] = canonicalPairKey(winner.tuningStat, loser.tuningStat);
      bump((p) =>
        recordCalibrationChoice(p, cleanPickCalibrationKey('tuning', winner.archetype, lo, hi)),
      );
    } else if (winner.tuningStat && !loser.tuningStat) {
      bump((p) =>
        recordTuningPreference(p, winner.archetype, winner.tuningStat!, winner.tertiaryStat, LR_TUNING * 0.5, scale),
      );
      bump((p) =>
        recordCalibrationChoice(
          p,
          cleanPickCalibrationKey('tuning', winner.archetype, winner.tuningStat!, 'none'),
        ),
      );
    }
  }

  if (archetypesDiffer(winner, loser)) {
    bump((p) => recordArchetypePreference(p, winner.archetype, loser.archetype, scale));
  }

  if (
    tertiaryStatsDiffer(winner, loser) &&
    !archetypesDiffer(winner, loser)
  ) {
    bump((p) =>
      recordTertiaryPreference(p, winner.archetype, winner.tertiaryStat, loser.tertiaryStat, scale),
    );
  }

  if (
    !intrinsicStatsEqual(winner, loser) &&
    !archetypesDiffer(winner, loser) &&
    !tertiaryStatsDiffer(winner, loser)
  ) {
    const statPair = intrinsicStatPreferencePair(winner, loser);
    if (statPair) {
      const [winnerStat, loserStat] = statPair;
      bump((p) => recordPairwiseWin(p, 'statWeights', winnerStat, loserStat, scale));
      const [lo, hi] = canonicalPairKey(winnerStat, loserStat);
      bump((p) => recordCalibrationChoice(p, cleanPickCalibrationKey('stat', lo, hi)));
    }
  }

  return changed ? next : prefs;
}

/** @deprecated Use getClassPrefs instead */
export function getEffectiveProfile(
  profile: PreferenceProfile,
  classType: ClassType,
): ClassPreferenceProfile {
  return getClassPrefs(profile, classType);
}

export function learnFromDupeChoice(
  profile: PreferenceProfile,
  classType: ClassType,
  kept: ArmorPiece,
  junked: ArmorPiece,
  followedRecommendation: boolean,
): PreferenceProfile {
  return updateClassPrefs(profile, classType, (prefs) => {
    const lr = followedRecommendation ? LR_TUNING * 0.3 : LR_TUNING * 0.6;
    let next = { ...prefs };

    if (
      kept.armorSet &&
      junked.armorSet &&
      kept.armorSet.hash !== junked.armorSet.hash
    ) {
      next = recordPairwiseWin(next, 'setWeights', kept.armorSet.hash, junked.armorSet.hash);
    }

    if (kept.tertiaryStat !== junked.tertiaryStat) {
      next = recordTertiaryPreference(next, kept.archetype, kept.tertiaryStat, junked.tertiaryStat);
    }

    if (kept.tuningStat && junked.tuningStat && kept.tuningStat !== junked.tuningStat) {
      next = recordTuningPreference(next, kept.archetype, kept.tuningStat, junked.tuningStat, lr);
    } else if (kept.tuningStat && !junked.tuningStat) {
      next = recordTuningPreference(next, kept.archetype, kept.tuningStat, kept.tertiaryStat, lr * 0.5);
    }

    if (!followedRecommendation) {
      next.calibratedAt = Date.now();
    }

    return next;
  });
}

export type WantLabel =
  | 'keep-eye-on'
  | 'neutral'
  | 'low-priority'
  | 'safe-dismantle';

export function wantScoreLabel(
  item: ArmorPiece,
  classItems: ArmorPiece[],
): WantLabel {
  if ((item.wantScore ?? 0) < 0.35 && item.isDupe) return 'safe-dismantle';

  const scores = classItems
    .map((i) => i.wantScore ?? 0)
    .sort((a, b) => a - b);
  if (scores.length < 4) return 'neutral';

  const score = item.wantScore ?? 0;
  const p20 = scores[Math.floor(scores.length * 0.2)] ?? 0;
  const p80 = scores[Math.floor(scores.length * 0.8)] ?? 1;

  if (score >= p80) return 'keep-eye-on';
  if (score <= p20) return 'low-priority';
  return 'neutral';
}

export const WANT_LABEL_TEXT: Record<WantLabel, string> = {
  'keep-eye-on': 'Top pick',
  neutral: 'Average',
  'low-priority': 'Low priority',
  'safe-dismantle': 'Redundant roll',
};

export const WANT_LABEL_CLASS: Record<WantLabel, string> = {
  'keep-eye-on': 'bg-white text-surface border border-white',
  neutral: 'bg-surface-3 text-muted border border-border',
  'low-priority': 'bg-surface-3 text-muted border border-border',
  'safe-dismantle': 'bg-danger text-white border border-danger',
};
