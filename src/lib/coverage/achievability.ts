import {
  ARCHETYPE_STATS,
  ARMOR_SLOTS,
  ARCHETYPES,
  tertiaryStatsForArchetype,
} from '@/lib/constants';
import { MASTERWORK_STAT_BONUS } from '@/lib/armor/effectiveStats';
import type { Archetype, ArmorPiece, ArmorSlot, Stat, StatTarget } from '@/types';

/**
 * Canonical T5 intrinsic roll-line budgets (verified in armor fixtures: 30 / 25 / 20).
 * Re-exported for UI pattern labels via loadout.ts OPTIMAL_ROLL_* aliases — do not hardcode elsewhere.
 */
export const T5_CANONICAL_PRIMARY = 30;
export const T5_CANONICAL_SECONDARY = 25;
export const T5_CANONICAL_TERTIARY = 20;
/**
 * Worn-total bonus from a best altar tuning mod on a priority stat (MW-assumed scoring only).
 * Differs from {@link T5_TUNING_INTRINSIC_SHIFT}: scoring compares altar-mod worn totals (+8),
 * while pattern chips show the intrinsic socket shift (+5). UI must use loadout display aliases.
 */
export const T5_CANONICAL_TUNING_BONUS = 8;
/** Intrinsic socket shift on the tuning target stat (+5 target / −5 donor). Display + scoring identity. */
export const T5_TUNING_INTRINSIC_SHIFT = 5;

/** How well a piece's roll identity aligns with a priority stat. */
export type TuningFitLevel = 'ideal' | 'aligned' | 'intrinsic' | 'none';

export type StatAchievabilityStatus = 'achievable' | 'close' | 'not';

export type BuildVerdict = 'ready' | 'almost' | 'need_rolls';

export interface TuningFit {
  level: TuningFitLevel;
  tertiaryMatch: boolean;
  tuningMatch: boolean;
  intrinsicMatch: boolean;
}

export interface StatAchievability {
  stat: Stat;
  rank: number;
  status: StatAchievabilityStatus;
  /** Best tuning fit found vault-wide for this stat. */
  bestTuningFit: TuningFitLevel;
  /** Slots with at least intrinsic support for this stat. */
  slotsCovered: number;
  /** Slots with tertiary or tuning aligned to this stat. */
  slotsAligned: number;
  /** Slots missing any piece that rolls this stat. */
  slotGaps: ArmorSlot[];
  bestPiece: ArmorPiece | null;
  /** @deprecated Use bestPiece */
  bestPieces: ArmorPiece[];
}

const FIT_RANK: Record<TuningFitLevel, number> = {
  ideal: 4,
  aligned: 3,
  intrinsic: 1,
  none: 0,
};

/** Numeric score for browse sorting and piece comparison. */
export function tuningFitScore(level: TuningFitLevel): number {
  return FIT_RANK[level];
}

/**
 * Relevant tuning: a piece supports a priority stat when the stat appears in its
 * roll identity (archetype pair, tertiary, tuning). Alignment means tertiary
 * and/or tuning stat match the priority — ideal when both do.
 */
export function pieceTuningFit(item: ArmorPiece, stat: Stat): TuningFit {
  const [primary, secondary] = ARCHETYPE_STATS[item.archetype];
  const tertiaryMatch = item.tertiaryStat === stat;
  const tuningMatch = item.tuningStat === stat;
  const intrinsicMatch = primary === stat || secondary === stat;

  if (!tertiaryMatch && !tuningMatch && !intrinsicMatch) {
    return { level: 'none', tertiaryMatch: false, tuningMatch: false, intrinsicMatch: false };
  }
  if (tertiaryMatch && tuningMatch) {
    return { level: 'ideal', tertiaryMatch, tuningMatch, intrinsicMatch };
  }
  if (tertiaryMatch || tuningMatch) {
    return { level: 'aligned', tertiaryMatch, tuningMatch, intrinsicMatch };
  }
  return { level: 'intrinsic', tertiaryMatch, tuningMatch, intrinsicMatch };
}

export function isTuningAligned(level: TuningFitLevel): boolean {
  return level === 'ideal' || level === 'aligned';
}

/** Intrinsic value for one stat on a canonical T5 roll shape. */
export function canonicalIntrinsicStatValue(
  archetype: Archetype,
  stat: Stat,
  tertiaryStat: Stat,
): number {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  if (stat === primary) return T5_CANONICAL_PRIMARY;
  if (stat === secondary) return T5_CANONICAL_SECONDARY;
  if (stat === tertiaryStat) return T5_CANONICAL_TERTIARY;
  return 0;
}

/** MW-assumed worn value for one priority stat on a canonical roll shape. */
export function canonicalPriorityStatTotal(
  archetype: Archetype,
  stat: Stat,
  tertiaryStat: Stat,
  tuningStat: Stat | undefined,
): number {
  const intrinsic = canonicalIntrinsicStatValue(archetype, stat, tertiaryStat);
  if (intrinsic <= 0) return 0;
  let total = intrinsic + MASTERWORK_STAT_BONUS;
  if (tuningStat === stat) total += T5_CANONICAL_TUNING_BONUS;
  return total;
}

/** Combined MW-assumed priority stat total for a canonical roll shape. */
export function canonicalCombinedPriorityTotal(
  archetype: Archetype,
  tertiaryStat: Stat,
  tuningStat: Stat | undefined,
  priorities: Stat[],
): number {
  return priorities.reduce(
    (sum, stat) =>
      sum + canonicalPriorityStatTotal(archetype, stat, tertiaryStat, tuningStat),
    0,
  );
}

function multiPriorityShapeFits(
  archetype: Archetype,
  tertiaryStat: Stat,
  tuningStat: Stat | undefined,
  priorities: Stat[],
): boolean {
  const synthetic = {
    archetype,
    tertiaryStat,
    tuningStat,
  } as Pick<ArmorPiece, 'archetype' | 'tertiaryStat' | 'tuningStat'>;

  const fits = priorities.map((stat) =>
    pieceTuningFit(synthetic as ArmorPiece, stat),
  );
  if (fits.some((f) => f.level === 'none')) return false;

  const tertiaryPushes = fits.filter((f) => f.tertiaryMatch);
  if (tertiaryPushes.length !== 1) return false;

  for (const fit of fits) {
    if (fit.tertiaryMatch) continue;
    if (!fit.intrinsicMatch || fit.tertiaryMatch) return false;
  }

  return true;
}

/** Best combined priority total reachable on a valid multi-priority roll shape. */
export function maxCanonicalCombinedPriorityTotal(priorities: Stat[]): number {
  if (priorities.length < 2) return 0;

  let max = 0;
  for (const archetype of ARCHETYPES) {
    for (const tertiaryStat of tertiaryStatsForArchetype(archetype)) {
      for (const tuningStat of [...priorities, undefined] as (Stat | undefined)[]) {
        if (!multiPriorityShapeFits(archetype, tertiaryStat, tuningStat, priorities)) {
          continue;
        }
        max = Math.max(
          max,
          canonicalCombinedPriorityTotal(archetype, tertiaryStat, tuningStat, priorities),
        );
      }
    }
  }
  return max;
}

/** Archetypes that maximize combined priority stats when tertiary pushes `pushedStat`. */
export function optimalArchetypesForPush(
  pushedStat: Stat,
  priorities: Stat[],
): Archetype[] {
  if (priorities.length < 2) return [];

  const maxTotal = maxCanonicalCombinedPriorityTotal(priorities);
  const matches: Archetype[] = [];

  for (const archetype of ARCHETYPES) {
    if (!tertiaryStatsForArchetype(archetype).includes(pushedStat)) continue;

    let archetypeMax = 0;
    for (const tuningStat of [...priorities, undefined] as (Stat | undefined)[]) {
      if (!multiPriorityShapeFits(archetype, pushedStat, tuningStat, priorities)) continue;
      archetypeMax = Math.max(
        archetypeMax,
        canonicalCombinedPriorityTotal(archetype, pushedStat, tuningStat, priorities),
      );
    }

    if (archetypeMax === maxTotal && archetypeMax > 0) {
      matches.push(archetype);
    }
  }

  return matches;
}

/** Max-budget archetype + tertiary pairs for multi-priority builds. */
export interface OptimalRollShape {
  archetype: Archetype;
  /** Priority stat on tertiary for this shape. */
  tertiaryStat: Stat;
}

/**
 * All tied-max roll shapes: tertiary on one priority, others from archetype intrinsics.
 * Tuning on actual pieces must be one of the build priorities (when present).
 */
export function computeOptimalRollShapes(priorities: Stat[]): OptimalRollShape[] {
  if (priorities.length < 2) return [];

  const shapes: OptimalRollShape[] = [];
  for (const tertiaryStat of priorities) {
    for (const archetype of optimalArchetypesForPush(tertiaryStat, priorities)) {
      shapes.push({ archetype, tertiaryStat });
    }
  }
  return shapes;
}

/** When present, tuning must be one of the build's 2–4 priority stats. */
export function isTuningValidForBuildPriorities(
  tuningStat: Stat | undefined,
  priorities: Stat[],
): boolean {
  if (!tuningStat) return true;
  return priorities.includes(tuningStat);
}

/**
 * Whether a piece is an optimal roll shape for the build priorities.
 *
 * - **Single priority:** tertiary + tuning both match the stat.
 * - **Multi-priority:** roll identity matches a dynamically computed optimal shape
 *   (tertiary on one max-budget priority; others from archetype; tuning on any priority).
 */
export function isBestTierLoadoutPiece(item: ArmorPiece, priorities: Stat[]): boolean {
  if (priorities.length === 0) return false;

  if (priorities.length === 1) {
    return pieceTuningFit(item, priorities[0]).level === 'ideal';
  }

  if (!isTuningValidForBuildPriorities(item.tuningStat, priorities)) {
    return false;
  }

  return computeOptimalRollShapes(priorities).some(
    (shape) =>
      shape.archetype === item.archetype && shape.tertiaryStat === item.tertiaryStat,
  );
}

function compareTuningFit(a: TuningFitLevel, b: TuningFitLevel): number {
  return tuningFitScore(b) - tuningFitScore(a);
}

function bestPieceForStat(items: ArmorPiece[], stat: Stat): ArmorPiece | null {
  const candidates = items.filter((item) => pieceTuningFit(item, stat).level !== 'none');
  if (candidates.length === 0) return null;
  return candidates.reduce((best, item) => {
    const fitDiff = compareTuningFit(
      pieceTuningFit(item, stat).level,
      pieceTuningFit(best, stat).level,
    );
    if (fitDiff !== 0) return fitDiff < 0 ? item : best;
    return item;
  });
}

function slotCoverageForStat(
  items: ArmorPiece[],
  slot: ArmorSlot,
  stat: Stat,
): { covered: boolean; aligned: boolean } {
  const slotItems = items.filter((i) => i.armorSlot === slot);
  let bestLevel: TuningFitLevel = 'none';
  for (const item of slotItems) {
    const level = pieceTuningFit(item, stat).level;
    if (compareTuningFit(level, bestLevel) < 0) bestLevel = level;
  }
  return {
    covered: bestLevel !== 'none',
    aligned: isTuningAligned(bestLevel),
  };
}

function evaluateStatCoverage(
  items: ArmorPiece[],
  stat: Stat,
): Pick<
  StatAchievability,
  'status' | 'bestTuningFit' | 'slotsCovered' | 'slotsAligned' | 'slotGaps' | 'bestPiece' | 'bestPieces'
> {
  const slotGaps: ArmorSlot[] = [];
  let slotsCovered = 0;
  let slotsAligned = 0;
  let vaultBestFit: TuningFitLevel = 'none';

  for (const slot of ARMOR_SLOTS) {
    const slotCov = slotCoverageForStat(items, slot, stat);
    if (!slotCov.covered) slotGaps.push(slot);
    else slotsCovered++;
    if (slotCov.aligned) slotsAligned++;
  }

  for (const item of items) {
    const level = pieceTuningFit(item, stat).level;
    if (compareTuningFit(level, vaultBestFit) < 0) vaultBestFit = level;
  }

  const bestPiece = bestPieceForStat(items, stat);
  let status: StatAchievabilityStatus;
  if (slotsCovered < ARMOR_SLOTS.length || !isTuningAligned(vaultBestFit)) {
    status = 'not';
  } else if (slotsAligned < ARMOR_SLOTS.length) {
    status = 'close';
  } else {
    status = 'achievable';
  }

  return {
    status,
    bestTuningFit: vaultBestFit,
    slotsCovered,
    slotsAligned,
    slotGaps,
    bestPiece,
    bestPieces: bestPiece ? [bestPiece] : [],
  };
}

export function priorityStatsFromTargets(targets: StatTarget[]): Stat[] {
  return targets.map((t) => t.stat);
}

export function computeStatAchievability(
  items: ArmorPiece[],
  targets: StatTarget[],
): StatAchievability[] {
  return targets.map(({ stat }, rank) => ({
    stat,
    rank,
    ...evaluateStatCoverage(items, stat),
  }));
}

export function buildVerdictFromRows(rows: StatAchievability[]): BuildVerdict {
  if (rows.length === 0) return 'need_rolls';
  if (rows.every((row) => row.status === 'achievable')) return 'ready';
  if (rows.every((row) => row.status !== 'not')) return 'almost';
  return 'need_rolls';
}

export function formatBuildVerdict(verdict: BuildVerdict): string {
  switch (verdict) {
    case 'ready':
      return 'Ready';
    case 'almost':
      return 'Almost';
    default:
      return 'Need better rolls';
  }
}

export function formatAchievabilityStatus(status: StatAchievabilityStatus): string {
  switch (status) {
    case 'achievable':
      return 'Covered';
    case 'close':
      return 'Weak tuning';
    default:
      return 'Gap';
  }
}

export function formatTuningFitLevel(level: TuningFitLevel): string {
  switch (level) {
    case 'ideal':
      return 'Ideal tuning';
    case 'aligned':
      return 'Tuned';
    case 'intrinsic':
      return 'Archetype only';
    default:
      return 'No fit';
  }
}

/** Weighted tuning-alignment score for browse sorting (higher = better fit). */
export function buildTuningFitScore(item: ArmorPiece, priorities: Stat[]): number {
  let score = 0;
  let anySupport = false;
  for (let i = 0; i < priorities.length; i++) {
    const fit = pieceTuningFit(item, priorities[i]);
    if (fit.level === 'none') continue;
    anySupport = true;
    const weight = priorities.length - i;
    score += tuningFitScore(fit.level) * weight * 25;
  }
  return anySupport ? score : 0;
}
