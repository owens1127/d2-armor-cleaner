import type {
  ArmorPiece,
  ClassPreferenceProfile,
  PreferenceProfile,
  ScoreBreakdown,
  Stat,
  Archetype,
} from '@/types';
import { ARCHETYPE_STATS, STATS } from '@/lib/constants';
import { getCalibrationConfidence } from '@/lib/prefs/calibrationChoices';
import { getClassPrefs } from '@/lib/prefs/profile';

export {
  defaultClassPreferenceProfile,
  defaultPreferenceProfile,
  getClassPrefs,
  updateClassPrefs,
} from '@/lib/prefs/profile';

/** Base learning rate for set/stat pairwise wins (before gap scaling). */
export const LR_PAIRWISE = 0.08;
/** Base learning rate for tertiary stat preferences. */
export const LR_TERTIARY = 0.1;
/** Base learning rate for archetype preferences. */
export const LR_ARCHETYPE = 0.1;
/** Default base learning rate for tuning stat preferences. */
export const LR_TUNING = 0.1;

function countSetPieces(items: ArmorPiece[], setHash: number): number {
  return items.filter((i) => i.armorSet?.hash === setHash).length;
}

export interface ScoreItemOptions {
  /** Head-to-head identical roll: use set preference only, not completion bonus. */
  peerDuel?: boolean;
  /** Skip vault-wide dominance when the opponent is the same intrinsic roll. */
  ignoreDominance?: boolean;
}

export function scoreItem(
  item: ArmorPiece,
  prefs: ClassPreferenceProfile,
  allClassItems: ArmorPiece[],
  options?: ScoreItemOptions,
): ScoreBreakdown {
  const statTotal = STATS.reduce(
    (sum, s) => sum + (item.baseStats[s] ?? 0) * prefs.statWeights[s],
    0,
  );
  const statMax = STATS.reduce((sum, s) => sum + 30 * prefs.statWeights[s], 0);
  const statFit = statMax > 0 ? statTotal / statMax : 0;

  const archetypeFit = prefs.archetypeWeights[item.archetype] ?? 0.5;
  const tertiaryFit =
    prefs.tertiaryWeights[item.archetype]?.[item.tertiaryStat] ?? 0.5;
  const tuningFit = item.tuningStat
    ? (prefs.tuningWeights[item.archetype]?.[item.tuningStat] ?? 0.5)
    : 0.3;

  let setFit = 0;
  const explanations: string[] = [];
  if (item.armorSet) {
    setFit = prefs.setWeights[item.armorSet.hash] ?? 0.4;
    if (!options?.peerDuel) {
      const owned = countSetPieces(allClassItems, item.armorSet.hash);
      const bonus = prefs.setCompletionBonus * (1 - owned / 5);
      setFit += bonus;
      if (owned >= 2) explanations.push(`Part of ${item.armorSet.name} (${owned}/5)`);
    }
  }

  const [p, s] = ARCHETYPE_STATS[item.archetype];
  if (item.tuningStat && [p, s, item.tertiaryStat].includes(item.tuningStat)) {
    explanations.push('Tuning stat matches build focus');
    setFit += 0.1;
  }

  let dominance = 0;
  if (!options?.ignoreDominance) {
    const sameSlot = allClassItems.filter(
      (i) => i.armorSlot === item.armorSlot && i.instanceId !== item.instanceId,
    );
    const itemStatSum = STATS.reduce((n, st) => n + (item.baseStats[st] ?? 0), 0);
    const dominated = sameSlot.some((other) => {
      const otherSum = STATS.reduce((n, st) => n + (other.baseStats[st] ?? 0), 0);
      return otherSum > itemStatSum && STATS.every(
        (st) => (other.baseStats[st] ?? 0) >= (item.baseStats[st] ?? 0),
      );
    });
    if (dominated) {
      dominance = -0.3;
      explanations.push('Strictly lower stats than another piece');
    }
  }

  let tierBonus = 0;
  if ((item.tier ?? 0) >= 5) {
    tierBonus = 0.05;
    explanations.push('Tier 5 gear');
  } else if ((item.tier ?? 0) >= 4) {
    tierBonus = 0.02;
  }

  const mwBonus = item.isMasterwork ? 0.03 : 0;
  if (item.isMasterwork) explanations.push('Masterworked');

  const total =
    statFit * 0.35 +
    archetypeFit * 0.15 +
    tertiaryFit * 0.15 +
    tuningFit * 0.1 +
    setFit * 0.2 +
    dominance +
    tierBonus +
    mwBonus;

  const confidence = getCalibrationConfidence(prefs);

  if (confidence === 'low') explanations.unshift('Calibrate preferences for better accuracy');

  return {
    total,
    statFit,
    archetypeFit,
    tertiaryFit,
    tuningFit,
    setFit,
    dominance,
    explanations,
    confidence,
  };
}

export function scoreAllItems(
  items: ArmorPiece[],
  profile: PreferenceProfile,
): ArmorPiece[] {
  return items.map((item) => {
    const classItems = items.filter((i) => i.classType === item.classType);
    const classPrefs = getClassPrefs(profile, item.classType);
    const breakdown = scoreItem(item, classPrefs, classItems);
    return {
      ...item,
      wantScore: breakdown.total,
      wantConfidence: breakdown.confidence,
    };
  });
}

export function recordArchetypePreference(
  prefs: ClassPreferenceProfile,
  winner: Archetype,
  loser: Archetype,
  scale = 1,
): ClassPreferenceProfile {
  const lr = LR_ARCHETYPE * scale;
  const aw = { ...prefs.archetypeWeights };
  aw[winner] = Math.min(1, (aw[winner] ?? 0.5) + lr);
  aw[loser] = Math.max(0, (aw[loser] ?? 0.5) - lr * 0.5);
  return {
    ...prefs,
    archetypeWeights: aw,
    calibratedAt: Date.now(),
  };
}

export function recordPairwiseWin(
  prefs: ClassPreferenceProfile,
  weightMap: 'statWeights' | 'setWeights',
  key: string | number,
  loserMapKey: string | number,
  scale = 1,
): ClassPreferenceProfile {
  const lr = LR_PAIRWISE * scale;
  const next = { ...prefs };
  if (weightMap === 'statWeights') {
    const w = { ...next.statWeights };
    const stat = key as Stat;
    const loserStat = loserMapKey as Stat;
    w[stat] = Math.min(1, (w[stat] ?? 0.5) + lr);
    w[loserStat] = Math.max(0, (w[loserStat] ?? 0.5) - lr * 0.5);
    next.statWeights = w;
  } else {
    const w = { ...next.setWeights };
    w[key as number] = Math.min(1, (w[key as number] ?? 0.4) + lr);
    w[loserMapKey as number] = Math.max(0, (w[loserMapKey as number] ?? 0.4) - lr * 0.5);
    next.setWeights = w;
  }
  next.calibratedAt = Date.now();
  return next;
}

export function recordTertiaryPreference(
  prefs: ClassPreferenceProfile,
  archetype: Archetype,
  winner: Stat,
  loser: Stat,
  scale = 1,
): ClassPreferenceProfile {
  const lr = LR_TERTIARY * scale;
  const tw = { ...prefs.tertiaryWeights };
  const arch = { ...(tw[archetype] ?? {}) };
  arch[winner] = Math.min(1, (arch[winner] ?? 0.5) + lr);
  arch[loser] = Math.max(0, (arch[loser] ?? 0.5) - lr * 0.5);
  tw[archetype] = arch;
  return {
    ...prefs,
    tertiaryWeights: tw,
    calibratedAt: Date.now(),
  };
}

export function recordTuningPreference(
  prefs: ClassPreferenceProfile,
  archetype: Archetype,
  winner: Stat,
  loser: Stat,
  lr = LR_TUNING,
  scale = 1,
): ClassPreferenceProfile {
  const effectiveLr = lr * scale;
  const tw = { ...prefs.tuningWeights };
  const arch = { ...(tw[archetype] ?? {}) };
  arch[winner] = Math.min(1, (arch[winner] ?? 0.5) + effectiveLr);
  arch[loser] = Math.max(0, (arch[loser] ?? 0.5) - effectiveLr * 0.5);
  tw[archetype] = arch;
  return {
    ...prefs,
    tuningWeights: tw,
    calibratedAt: Date.now(),
  };
}

export function updateStatRank(
  prefs: ClassPreferenceProfile,
  orderedStats: Stat[],
): ClassPreferenceProfile {
  const max = orderedStats.length;
  const statWeights = { ...prefs.statWeights };
  orderedStats.forEach((stat, i) => {
    statWeights[stat] = (max - i) / max;
  });
  return {
    ...prefs,
    statWeights,
    calibratedAt: Date.now(),
  };
}

/** Apply a full pairwise ranking to archetype weights (top = highest). */
export function applyArchetypeOrder(
  prefs: ClassPreferenceProfile,
  ordered: Archetype[],
): ClassPreferenceProfile {
  const max = ordered.length;
  const archetypeWeights = { ...prefs.archetypeWeights };
  ordered.forEach((arch, i) => {
    archetypeWeights[arch] = max <= 1 ? 1 : (max - i) / max;
  });
  return { ...prefs, archetypeWeights, calibratedAt: Date.now() };
}

/** Apply tertiary stat order to every archetype that can roll that stat. */
export function applyTertiaryStatOrder(
  prefs: ClassPreferenceProfile,
  ordered: Stat[],
  archetypes: Archetype[],
): ClassPreferenceProfile {
  const max = ordered.length;
  const tw = { ...prefs.tertiaryWeights };
  for (const arch of archetypes) {
    const archWeights = { ...(tw[arch] ?? {}) };
    for (const stat of ordered) {
      const idx = ordered.indexOf(stat);
      archWeights[stat] = max <= 1 ? 1 : (max - idx) / max;
    }
    tw[arch] = archWeights;
  }
  return { ...prefs, tertiaryWeights: tw, calibratedAt: Date.now() };
}

/** Apply tuning stat order to every archetype in scope. */
export function applyTuningStatOrder(
  prefs: ClassPreferenceProfile,
  ordered: Stat[],
  archetypes: Archetype[],
): ClassPreferenceProfile {
  const max = ordered.length;
  const tw = { ...prefs.tuningWeights };
  for (const arch of archetypes) {
    const archWeights = { ...(tw[arch] ?? {}) };
    for (const stat of ordered) {
      const idx = ordered.indexOf(stat);
      archWeights[stat] = max <= 1 ? 1 : (max - idx) / max;
    }
    tw[arch] = archWeights;
  }
  return { ...prefs, tuningWeights: tw, calibratedAt: Date.now() };
}

/** Apply armor set order from pairwise ranking (top = highest weight). */
export function applySetOrder(
  prefs: ClassPreferenceProfile,
  orderedSetHashes: number[],
): ClassPreferenceProfile {
  const max = orderedSetHashes.length;
  const setWeights = { ...prefs.setWeights };
  orderedSetHashes.forEach((hash, i) => {
    setWeights[hash] = max <= 1 ? 1 : (max - i) / max;
  });
  return { ...prefs, setWeights, calibratedAt: Date.now() };
}
