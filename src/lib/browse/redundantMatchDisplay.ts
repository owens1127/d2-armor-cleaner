import {
  cardStatsForPiece,
  type CardStatEntry,
  type StatPillRole,
} from '@/components/duel/ArmorCard';
import { ARCHETYPE_STATS, STAT_LABELS, STATS } from '@/lib/constants';
import {
  budgetRelevantIntrinsicStats,
  intrinsicStatValue,
  intrinsicStatsEqual,
} from '@/lib/armor/intrinsicCompare';
import type { DismantleDisplayGroup, DismantleReason } from '@/lib/dupes/dismantle';
import { comparableStatDeltas } from '@/lib/scoring/dominance';
import type { ArmorPiece, Stat } from '@/types';

export interface RedundantGroupMatch {
  keeper: ArmorPiece | null;
  sharedTertiary: Stat | null;
  sharedTuning: Stat | null;
  /** Intrinsic lines with the same value on every piece in the group. */
  sharedStatEntries: CardStatEntry[];
  /** Stats redundant pieces lose on vs the keeper (stat-lower groups). */
  lowerStatLabels: string[];
  allSameIntrinsicRoll: boolean;
}

function statRole(piece: ArmorPiece, stat: Stat): StatPillRole | undefined {
  const [primary, secondary] = ARCHETYPE_STATS[piece.archetype];
  if (stat === piece.tertiaryStat) return 'tertiary';
  if (stat === primary) return 'primary';
  if (stat === secondary) return 'secondary';
  return undefined;
}

function sharedBudgetStatEntries(pieces: ArmorPiece[]): CardStatEntry[] {
  if (pieces.length === 0) return [];

  const statsToCheck = new Set<Stat>();
  for (let i = 0; i < pieces.length; i++) {
    for (const stat of budgetRelevantIntrinsicStats(
      pieces[i],
      pieces[(i + 1) % pieces.length],
    )) {
      statsToCheck.add(stat);
    }
  }

  const reference = pieces[0];
  const entries: CardStatEntry[] = [];
  for (const stat of STATS) {
    if (!statsToCheck.has(stat)) continue;
    const value = intrinsicStatValue(reference, stat);
    if (value <= 0) continue;
    if (!pieces.every((piece) => intrinsicStatValue(piece, stat) === value)) continue;
    const role = statRole(reference, stat);
    if (!role) continue;
    entries.push({ stat, value, role });
  }
  return entries;
}

function sharedSingleValue<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

/** Summarize what is duplicated across a redundant browse group. */
export function analyzeRedundantGroupMatch(group: DismantleDisplayGroup): RedundantGroupMatch {
  const pieces = group.members.map((member) => member.piece);
  const keeper = group.members.find((member) => member.role === 'keeper')?.piece ?? null;
  const sharedTertiary = sharedSingleValue(pieces.map((piece) => piece.tertiaryStat));
  const sharedTuning = sharedSingleValue(
    pieces.map((piece) => piece.tuningStat ?? null),
  );
  const sharedStatEntries = sharedBudgetStatEntries(pieces);
  const allSameIntrinsicRoll =
    pieces.length >= 2 && pieces.every((piece) => intrinsicStatsEqual(piece, pieces[0]));

  const lowerStatLabels: string[] = [];
  if (group.reason === 'stat-lower' && keeper) {
    const redundantMember = group.members.find(
      (member) => member.role === 'redundant' && member.candidate,
    );
    const candidate = redundantMember?.candidate;
    if (candidate) {
      const beats =
        candidate.dominatorResult?.beatsOn ??
        comparableStatDeltas(keeper, candidate.item);
      for (const beat of beats) {
        if (beat.delta > 0) {
          lowerStatLabels.push(`${STAT_LABELS[beat.stat]} −${beat.delta}`);
        }
      }
    }
  }

  return {
    keeper,
    sharedTertiary,
    sharedTuning,
    sharedStatEntries,
    lowerStatLabels,
    allSameIntrinsicRoll,
  };
}

/** Header meta line: shared tertiary/tuning/stat fingerprint. */
export function formatRedundantGroupMatchingLine(
  match: RedundantGroupMatch,
  reason: DismantleReason,
): string {
  const parts: string[] = [];
  if (match.sharedTertiary) {
    parts.push(`${STAT_LABELS[match.sharedTertiary]} tertiary`);
  }
  if (match.sharedTuning) {
    parts.push(`${STAT_LABELS[match.sharedTuning]} tuning`);
  }

  if (parts.length === 0) {
    return reason === 'tuning-duplicate'
      ? 'Matching: same tuning layouts'
      : 'Matching: same roll layout';
  }
  return `Matching: ${parts.join(' · ')}`;
}

export function formatRedundantGroupLowerLine(match: RedundantGroupMatch): string | null {
  if (match.lowerStatLabels.length === 0) return null;
  return `Lower on: ${match.lowerStatLabels.join(' · ')}`;
}

/** Stat lines to render for a group member tile. */
export function redundantMemberStatEntries(
  piece: ArmorPiece,
  match: RedundantGroupMatch,
  reason: DismantleReason,
): CardStatEntry[] {
  if (reason === 'tuning-duplicate' && match.sharedStatEntries.length > 0) {
    return match.sharedStatEntries;
  }
  return cardStatsForPiece(piece);
}
