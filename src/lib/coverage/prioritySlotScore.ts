import { ARCHETYPE_STATS, ARCHETYPES, tertiaryStatsForArchetype } from '@/lib/constants';
import type { Archetype, ArmorPiece, Stat } from '@/types';

/** Weights for P1..P4. */
export const PRIORITY_SLOT_WEIGHTS = [4, 3, 2, 1] as const;

export type RollStatSlot = 'primary' | 'secondary' | 'tertiary' | 'tuning';

/** Affinity matrix A[slot][priorityIndex] for P1..P4. */
export const SLOT_AFFINITY: Record<RollStatSlot, readonly [number, number, number, number]> = {
  primary: [1.0, 1.0, 0, 0],
  secondary: [0.5, 1.0, 0, 0],
  tertiary: [0.25, 0.5, 1.0, 0],
  tuning: [0.125, 0.25, 0.5, 1.0],
};

/** Which roll line carries a stat on a given shape. */
export function statRollSlot(
  stat: Stat,
  archetype: Archetype,
  tertiaryStat: Stat,
  tuningStat?: Stat,
): RollStatSlot | null {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  if (stat === primary) return 'primary';
  if (stat === secondary) return 'secondary';
  if (stat === tertiaryStat) return 'tertiary';
  if (tuningStat !== undefined && stat === tuningStat) return 'tuning';
  return null;
}

/** Unified priority-slot affinity score for a roll shape. */
export function prioritySlotScore(
  archetype: Archetype,
  tertiaryStat: Stat,
  tuningStat: Stat | undefined,
  priorities: Stat[],
): number {
  let score = 0;
  for (let i = 0; i < priorities.length; i++) {
    const slot = statRollSlot(priorities[i]!, archetype, tertiaryStat, tuningStat);
    if (!slot) continue;
    score += PRIORITY_SLOT_WEIGHTS[i]! * SLOT_AFFINITY[slot][i]!;
  }
  return score;
}

/** Score for an actual vault piece (tuning must match build priorities when present). */
export function piecePrioritySlotScore(item: ArmorPiece, priorities: Stat[]): number {
  if (priorities.length === 0) return 0;
  if (item.tuningStat !== undefined && !priorities.includes(item.tuningStat)) return 0;
  return prioritySlotScore(item.archetype, item.tertiaryStat, item.tuningStat, priorities);
}

/** Every build priority appears on at least one roll line. */
export function rollShapeCoversAllPriorities(
  archetype: Archetype,
  tertiaryStat: Stat,
  tuningStat: Stat | undefined,
  priorities: Stat[],
): boolean {
  return priorities.every(
    (stat) => statRollSlot(stat, archetype, tertiaryStat, tuningStat) !== null,
  );
}

/** P3 for 3-stat builds; P3 and P4 for 4-stat (any priority below the top two). */
export function validTertiaryPriorities(priorities: Stat[]): Stat[] {
  if (priorities.length <= 2) return [];
  return priorities.slice(2);
}

export function isValidTertiaryStat(tertiaryStat: Stat, priorities: Stat[]): boolean {
  return validTertiaryPriorities(priorities).includes(tertiaryStat);
}

/** Top two build priorities must match the archetype intrinsic pair (order-independent). */
export function archetypeCoversTopPriorities(
  archetype: Archetype,
  priorities: Stat[],
): boolean {
  if (priorities.length < 2) return true;
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  const top = new Set<Stat>([priorities[0]!, priorities[1]!]);
  return top.has(primary) && top.has(secondary);
}

export interface EnumeratedRollShape {
  archetype: Archetype;
  /** Set when tertiary is pinned; omitted when flex tertiary applies. */
  tertiaryStat?: Stat;
  /** Both build priorities come from archetype intrinsics; any legal tertiary works. */
  flexTertiary?: boolean;
  tuningStat: Stat;
  score: number;
}

function shapeKey(
  archetype: Archetype,
  tertiaryStat: Stat | undefined,
  flexTertiary: boolean,
  tuningStat: Stat,
): string {
  if (flexTertiary) return `${archetype}:flex:${tuningStat}`;
  return `${archetype}:${tertiaryStat}:${tuningStat}`;
}

/**
 * Enumerate every valid roll shape for a priority list using unified slot scoring rules.
 *
 * - Tuning must be one of the build priorities.
 * - 2-stat builds allow flex tertiary (any legal tertiary for the archetype).
 * - 3-stat builds require tertiary on P3; 4-stat on P3 or P4 (not intrinsics).
 * - 3+ stat builds require the archetype intrinsic pair to cover P1 and P2.
 */
export function enumerateValidRollShapes(priorities: Stat[]): EnumeratedRollShape[] {
  if (priorities.length < 2) return [];

  const flexTertiaryCase = priorities.length === 2;
  const seen = new Map<string, EnumeratedRollShape>();

  for (const archetype of ARCHETYPES) {
    if (!flexTertiaryCase && !archetypeCoversTopPriorities(archetype, priorities)) {
      continue;
    }

    for (const tertiaryStat of tertiaryStatsForArchetype(archetype)) {
      if (!flexTertiaryCase && !isValidTertiaryStat(tertiaryStat, priorities)) {
        continue;
      }

      for (const tuningStat of priorities) {
        const score = prioritySlotScore(archetype, tertiaryStat, tuningStat, priorities);
        if (score <= 0) continue;

        if (flexTertiaryCase) {
          if (priorities.includes(tertiaryStat)) {
            const key = shapeKey(archetype, tertiaryStat, false, tuningStat);
            seen.set(key, { archetype, tertiaryStat, tuningStat, score });
          } else {
            const key = shapeKey(archetype, undefined, true, tuningStat);
            const existing = seen.get(key);
            if (!existing || score > existing.score) {
              seen.set(key, { archetype, flexTertiary: true, tuningStat, score });
            }
          }
        } else {
          const key = shapeKey(archetype, tertiaryStat, false, tuningStat);
          seen.set(key, { archetype, tertiaryStat, tuningStat, score });
        }
      }
    }
  }

  return [...seen.values()];
}

/** Max unified slot score across valid shapes for these priorities. */
export function maxPrioritySlotScore(priorities: Stat[]): number {
  const shapes = enumerateValidRollShapes(priorities);
  if (shapes.length === 0) return 0;
  return Math.max(...shapes.map((s) => s.score));
}

/** Shapes tied at the max unified slot score. */
export function optimalEnumeratedRollShapes(priorities: Stat[]): EnumeratedRollShape[] {
  const max = maxPrioritySlotScore(priorities);
  if (max <= 0) return [];
  return enumerateValidRollShapes(priorities).filter((s) => s.score === max);
}

/** Archetypes that reach max score with `pushedStat` on tertiary (non-flex shapes). */
export function optimalArchetypesForTertiaryPush(
  pushedStat: Stat,
  priorities: Stat[],
): Archetype[] {
  const max = maxPrioritySlotScore(priorities);
  if (max <= 0) return [];

  const matches = new Set<Archetype>();
  for (const shape of optimalEnumeratedRollShapes(priorities)) {
    if (shape.flexTertiary) continue;
    if (shape.tertiaryStat !== pushedStat) continue;
    matches.add(shape.archetype);
  }
  return [...matches];
}
