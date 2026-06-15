import { groupPatternLoadoutColumnsBySet } from '@/components/dashboard/buildCoverageLayout';
import { slotLabel } from '@/i18n/gameCopy';
import { ARMOR_SLOTS } from '@/lib/constants';
import {
  bestPiecesForPatternBySlot,
  columnSlotContextFromColumn,
  compareEligiblePickerPieces,
  formatNearMatchTooltip,
  formatTopGoldColumnTooltip,
  isColumnSlotEligiblePiece,
  isTopGoldColumnPiece,
  rankEligiblePiecesForPatternInSlot,
  resolvePatternSlotLoadoutPiece,
  rollPatternMatchScore,
  selectRecommendedPatternLoadout,
  type PatternLoadoutEntry,
  type PatternLoadoutSource,
  type PatternSlotLoadoutEntry,
  type PatternSlotMatchTier,
} from '@/lib/coverage/loadout';
import type { EligibleLoadoutPiece } from '@/lib/coverage/analyze';
import { parseSetBonusTargets } from '@/lib/coverage/setBonus';
import type { BuildProfile } from '@/lib/coverage/builds';
import type { OptimalRollPattern } from '@/lib/coverage/loadout';
import type { ArmorPiece, ArmorSlot, Stat } from '@/types';

export interface PatternColumnGroup {
  groupKey: string;
  headerPattern: Pick<OptimalRollPattern, 'archetype' | 'tertiaryStat'>;
  columns: PatternLoadoutEntry[];
}

/** True when a set row has multiple pattern columns worth collapsing into one card. */
export function patternSetRowColumnsAreCollapsible(
  columns: readonly PatternLoadoutEntry[],
): boolean {
  return columns.length > 1;
}

/** Shared archetype when every column matches; otherwise null (mixed archetypes). */
export function resolveCollapsedSetRowHeaderPattern(
  columns: readonly PatternLoadoutEntry[],
): Pick<OptimalRollPattern, 'archetype' | 'tertiaryStat'> {
  if (columns.length === 0) {
    return { archetype: null, tertiaryStat: null };
  }

  const firstArchetype = columns[0]!.pattern.archetype;
  const sameArchetype = columns.every(
    (column) => column.pattern.archetype === firstArchetype,
  );

  return {
    archetype: sameArchetype ? firstArchetype : null,
    tertiaryStat: null,
  };
}

/** Collapse every pattern column in one set row into a single grouped card. */
export function groupPatternLoadoutColumnsIntoOne(
  columns: readonly PatternLoadoutEntry[],
): PatternColumnGroup {
  return {
    groupKey: 'collapsed',
    headerPattern: resolveCollapsedSetRowHeaderPattern(columns),
    columns: [...columns],
  };
}

export interface MergedGroupedSlotRow extends PatternColumnSlotRow {
  sourceColumnKey: string;
  sourcePattern: OptimalRollPattern;
}

function mergedRowPriority(row: PatternColumnSlotRow): number {
  if (row.matchTier === 'perfect') return 2;
  if (row.matchTier === 'near') return 1;
  return 0;
}

function pickMergedSlotWinner(
  candidates: readonly {
    columnKey: string;
    pattern: OptimalRollPattern;
    row: PatternColumnSlotRow;
  }[],
): (typeof candidates)[number] | null {
  let best: (typeof candidates)[number] | null = null;

  for (const candidate of candidates) {
    if (candidate.row.displayPiece === null && candidate.row.matchTier === null) continue;

    if (!best) {
      best = candidate;
      continue;
    }

    const candidatePriority = mergedRowPriority(candidate.row);
    const bestPriority = mergedRowPriority(best.row);
    if (candidatePriority > bestPriority) {
      best = candidate;
      continue;
    }
    if (candidatePriority < bestPriority) continue;

    if (
      candidate.row.selectionSource === 'representative' &&
      best.row.selectionSource !== 'representative'
    ) {
      best = candidate;
      continue;
    }
    if (
      best.row.selectionSource === 'representative' &&
      candidate.row.selectionSource !== 'representative'
    ) {
      continue;
    }

    const tuningOrder =
      candidate.pattern.tuningStat.localeCompare(best.pattern.tuningStat);
    if (tuningOrder < 0) {
      best = candidate;
    }
  }

  return best;
}

/** Best displayed piece per slot across all columns in one collapsed group. */
export function buildMergedGroupedSlotRows(
  group: PatternColumnGroup,
  columnRowsByKey: PatternLoadoutGridData['columnRowsByKey'],
): MergedGroupedSlotRow[] {
  const slotEntries =
    columnRowsByKey[group.columns[0]?.columnKey ?? '']?.map((row) => row.slotEntry) ?? [];

  return slotEntries.map((slotEntry) => {
    const candidates = group.columns
      .map((column) => ({
        columnKey: column.columnKey,
        pattern: column.pattern,
        row: (columnRowsByKey[column.columnKey] ?? []).find(
          (entry) => entry.slotEntry.slot === slotEntry.slot,
        ),
      }))
      .filter(
        (
          entry,
        ): entry is {
          columnKey: string;
          pattern: OptimalRollPattern;
          row: PatternColumnSlotRow;
        } => entry.row !== undefined,
      );

    const winner = pickMergedSlotWinner(candidates);
    if (!winner) {
      return {
        slotEntry,
        displayPiece: null,
        matchTier: null,
        selectionSource: 'auto',
        topGold: false,
        showComboBadge: false,
        comboBadgeCount: 0,
        sourceColumnKey: group.columns[0]!.columnKey,
        sourcePattern: group.columns[0]!.pattern,
      };
    }

    return {
      ...winner.row,
      sourceColumnKey: winner.columnKey,
      sourcePattern: winner.pattern,
    };
  });
}

/** Union of eligible pieces for one slot across all columns in a collapsed group. */
export function mergeGroupedEligibleBySlot(
  group: PatternColumnGroup,
  patternEligibleBySlot: PatternLoadoutGridData['patternEligibleBySlot'],
  priorities: Stat[],
  setTargets: ReturnType<typeof parseSetBonusTargets> = [],
): Partial<Record<ArmorSlot, EligibleLoadoutPiece[]>> {
  const merged: Partial<Record<ArmorSlot, EligibleLoadoutPiece[]>> = {};

  for (const slot of ARMOR_SLOTS) {
    const seen = new Set<string>();
    const pieces: EligibleLoadoutPiece[] = [];

    for (const column of group.columns) {
      for (const entry of patternEligibleBySlot[column.columnKey]?.[slot] ?? []) {
        if (seen.has(entry.piece.instanceId)) continue;
        seen.add(entry.piece.instanceId);
        pieces.push(entry);
      }
    }

    if (pieces.length > 0) {
      merged[slot] = [...pieces].sort((a, b) =>
        compareEligiblePickerPieces(a.piece, b.piece, priorities, setTargets),
      );
    }
  }

  return merged;
}

/** Resolve which pattern column owns a user pick inside a collapsed card. */
export function resolveGroupedSlotSelectionColumn(
  group: PatternColumnGroup,
  slot: ArmorSlot,
  instanceId: string,
  patternEligibleBySlot: PatternLoadoutGridData['patternEligibleBySlot'],
): PatternLoadoutEntry {
  const matching = group.columns.filter((column) =>
    (patternEligibleBySlot[column.columnKey]?.[slot] ?? []).some(
      (entry) => entry.piece.instanceId === instanceId,
    ),
  );
  if (matching.length === 0) return group.columns[0]!;
  if (matching.length === 1) return matching[0]!;

  const piece =
    (patternEligibleBySlot[matching[0]!.columnKey]?.[slot] ?? []).find(
      (entry) => entry.piece.instanceId === instanceId,
    )?.piece ?? null;
  if (!piece) return matching[0]!;

  return matching.reduce((best, column) => {
    const bestScore = rollPatternMatchScore(piece, best.pattern);
    const columnScore = rollPatternMatchScore(piece, column.pattern);
    if (columnScore !== bestScore) {
      return columnScore > bestScore ? column : best;
    }
    if (best.pattern.tertiaryStat === null && column.pattern.tertiaryStat !== null) {
      return column;
    }
    if (column.pattern.tertiaryStat === null && best.pattern.tertiaryStat !== null) {
      return best;
    }
    return best;
  });
}

/** Union of perfect slots across all columns in one collapsed card. */
export function countGroupPerfectSlots(
  group: PatternColumnGroup,
  columnRowsByKey: PatternLoadoutGridData['columnRowsByKey'],
): number {
  const coveredSlots = new Set<ArmorSlot>();
  for (const column of group.columns) {
    for (const row of columnRowsByKey[column.columnKey] ?? []) {
      if (row.matchTier === 'perfect' && row.displayPiece !== null) {
        coveredSlots.add(row.slotEntry.slot);
      }
    }
  }
  return coveredSlots.size;
}

function comboScopeSlotKey(setHash: number | undefined, slot: ArmorSlot): string {
  return setHash === undefined ? `no-set:${slot}` : `${setHash}:${slot}`;
}

export interface PatternColumnSlotRow {
  slotEntry: PatternSlotLoadoutEntry;
  displayPiece: ArmorPiece | null;
  matchTier: PatternSlotMatchTier | null;
  selectionSource: PatternLoadoutSource;
  topGold: boolean;
  showComboBadge: boolean;
  comboBadgeCount: number;
  columnGoldTitle?: string;
  columnComboTitle?: string;
  nearMatchTitle?: string;
}

/** Unique target-set instance ids shown in the recommended pattern grid for one set. */
export function countUniqueSetPiecesInPatternGrid(
  columns: readonly PatternLoadoutEntry[],
  columnRowsByKey: PatternLoadoutGridData['columnRowsByKey'],
  setHash: number,
): number {
  const ids = new Set<string>();
  for (const column of columns) {
    if (column.setHash !== setHash) continue;
    for (const row of columnRowsByKey[column.columnKey] ?? []) {
      if (row.matchTier === 'near') continue;
      const piece = row.displayPiece;
      if (piece?.armorSet?.hash === setHash) ids.add(piece.instanceId);
    }
  }
  return ids.size;
}

/** Union of slots with a perfect match across pattern columns in one set row. */
export function countOverallPerfectSlotsInSetRow(
  columns: readonly PatternLoadoutEntry[],
  columnRowsByKey: PatternLoadoutGridData['columnRowsByKey'],
): number {
  const coveredSlots = new Set<ArmorSlot>();
  for (const column of columns) {
    for (const row of columnRowsByKey[column.columnKey] ?? []) {
      if (row.matchTier === 'perfect' && row.displayPiece !== null) {
        coveredSlots.add(row.slotEntry.slot);
      }
    }
  }
  return coveredSlots.size;
}

export interface PatternLoadoutGridData {
  recommendedPatternLoadout: ReturnType<typeof selectRecommendedPatternLoadout>;
  loadoutSetRows: ReturnType<typeof groupPatternLoadoutColumnsBySet>;
  patternEligibleBySlot: Partial<
    Record<string, Partial<Record<ArmorSlot, EligibleLoadoutPiece[]>>>
  >;
  patternSlotEntries: Partial<Record<string, PatternSlotLoadoutEntry[]>>;
  globalGoldPlacements: ReadonlySet<string>;
  columnRowsByKey: Partial<Record<string, PatternColumnSlotRow[]>>;
}

/**
 * Precomputes pattern loadout grid maps once per vault + build + representatives change.
 * Avoids repeated O(columns × slots × items) work during React render.
 */
export function buildPatternLoadoutGridData(
  items: readonly ArmorPiece[],
  build: BuildProfile,
  focusStats: Stat[],
  setTargets: ReturnType<typeof parseSetBonusTargets>,
  patternSlotRepresentatives: Partial<Record<string, Partial<Record<ArmorSlot, string>>>>,
  comboBadgeCountByInstance: ReadonlyMap<string, number>,
): PatternLoadoutGridData {
  const setBonuses = {
    setBonus2pc: build.setBonus2pc,
    setBonus4pc: build.setBonus4pc,
  };
  const recommendedPatternLoadout = selectRecommendedPatternLoadout(
    items as ArmorPiece[],
    build.statTargets,
    setBonuses,
  );
  // Per-set pattern columns pick independently (see selectRecommendedPatternLoadout).
  // Do not pin the global recommended loadout onto every column - that surfaces wrong
  // archetype/set pieces and inflates slotEntry counts vs what we display.
  const slotAssignment = undefined;
  const loadoutSetRows = groupPatternLoadoutColumnsBySet(recommendedPatternLoadout.columns);

  const patternEligibleBySlot: PatternLoadoutGridData['patternEligibleBySlot'] = {};
  const patternSlotEntries: PatternLoadoutGridData['patternSlotEntries'] = {};
  const columnRowsByKey: PatternLoadoutGridData['columnRowsByKey'] = {};

  const displayedByScopeSlot = new Map<string, Set<string>>();
  const displayedByColumnSlot = new Map<string, string>();

  for (const column of recommendedPatternLoadout.columns) {
    const bySlot: Partial<Record<ArmorSlot, EligibleLoadoutPiece[]>> = {};
    for (const slot of ARMOR_SLOTS) {
      bySlot[slot] = rankEligiblePiecesForPatternInSlot(
        items as ArmorPiece[],
        slot,
        column.pattern,
        focusStats,
        setTargets,
        column.setHash,
      );
    }
    patternEligibleBySlot[column.columnKey] = bySlot;

    const slotEntries = bestPiecesForPatternBySlot(
      items as ArmorPiece[],
      column.pattern,
      focusStats,
      setTargets,
      slotAssignment,
      column.setHash,
    );
    patternSlotEntries[column.columnKey] = slotEntries;

    const slotReps = patternSlotRepresentatives[column.columnKey] ?? {};
    const slotCtx = columnSlotContextFromColumn(
      column.pattern,
      focusStats,
      column.setHash,
      column.setName,
      setTargets,
    );

    const rows: PatternColumnSlotRow[] = [];
    for (const slotEntry of slotEntries) {
      let displayPiece: ArmorPiece | null;
      let selectionSource: PatternLoadoutSource;
      let resolvedTier: PatternSlotMatchTier | null;

      if (slotEntry.matchTier === 'near') {
        displayPiece = slotEntry.piece;
        selectionSource = 'auto';
        resolvedTier = 'near';
      } else {
        const resolved = resolvePatternSlotLoadoutPiece(
          items as ArmorPiece[],
          slotEntry.slot,
          column.pattern,
          focusStats,
          slotEntry.piece,
          slotReps[slotEntry.slot],
          column.setHash,
        );
        displayPiece = resolved.piece;
        selectionSource = resolved.source;
        resolvedTier = displayPiece ? 'perfect' : null;
      }

      if (displayPiece && resolvedTier === 'perfect') {
        const scopeSlotKey = comboScopeSlotKey(column.setHash, slotEntry.slot);
        const scopeIds = displayedByScopeSlot.get(scopeSlotKey) ?? new Set<string>();
        scopeIds.add(displayPiece.instanceId);
        displayedByScopeSlot.set(scopeSlotKey, scopeIds);
        displayedByColumnSlot.set(
          `${column.columnKey}|${slotEntry.slot}`,
          displayPiece.instanceId,
        );
      }

      const topGold =
        resolvedTier === 'perfect' &&
        displayPiece !== null &&
        isTopGoldColumnPiece(displayPiece, slotCtx, items);
      const showComboBadge =
        resolvedTier === 'perfect' &&
        displayPiece !== null &&
        isColumnSlotEligiblePiece(displayPiece, slotCtx);
      const comboBadgeCount =
        displayPiece === null || resolvedTier === 'near'
          ? 0
          : (comboBadgeCountByInstance.get(displayPiece.instanceId) ?? 0);

      rows.push({
        slotEntry,
        displayPiece,
        matchTier: resolvedTier,
        selectionSource,
        topGold,
        showComboBadge,
        comboBadgeCount,
        columnGoldTitle: topGold
          ? formatTopGoldColumnTooltip(slotCtx, slotEntry.slot)
          : undefined,
        columnComboTitle: formatPatternColumnComboTooltip(
          slotEntry.slot,
          column.setName,
        ),
        nearMatchTitle:
          displayPiece && resolvedTier === 'near'
            ? formatNearMatchTooltip(displayPiece, column.pattern)
            : undefined,
      });
    }
    columnRowsByKey[column.columnKey] = rows;
  }

  const uniqueByScopeSlot = new Map<string, string>();
  for (const [scopeSlotKey, pieceIds] of displayedByScopeSlot) {
    if (pieceIds.size !== 1) continue;
    uniqueByScopeSlot.set(scopeSlotKey, [...pieceIds][0]!);
  }

  const globalGoldPlacements = new Set<string>();
  const claimedScopeSlots = new Set<string>();
  for (const column of recommendedPatternLoadout.columns) {
    for (const slot of ARMOR_SLOTS) {
      const scopeSlotKey = comboScopeSlotKey(column.setHash, slot);
      if (claimedScopeSlots.has(scopeSlotKey)) continue;
      const winnerId = uniqueByScopeSlot.get(scopeSlotKey);
      if (!winnerId) continue;
      const columnSlotKey = `${column.columnKey}|${slot}`;
      if (displayedByColumnSlot.get(columnSlotKey) !== winnerId) continue;
      globalGoldPlacements.add(columnSlotKey);
      claimedScopeSlots.add(scopeSlotKey);
    }
  }

  return {
    recommendedPatternLoadout,
    loadoutSetRows,
    patternEligibleBySlot,
    patternSlotEntries,
    globalGoldPlacements,
    columnRowsByKey,
  };
}

export function formatPatternColumnComboTooltip(
  slot: ArmorSlot,
  setName: string | undefined,
): string {
  return `Eligible ${setName ? `${setName} ` : ''}${slotLabel(slot).toLowerCase()} for this roll column`;
}

export interface CollectRecommendedGridPiecesOptions {
  /** Include near-match rows (DIM copy only; tag buttons are hidden on those rows). */
  includeNearMatch?: boolean;
}

/**
 * Unique displayed pieces across the recommended pattern grid.
 * Uses each row's `displayPiece` (user representative or algorithm pick).
 */
export function collectRecommendedPatternGridPieces(
  columns: readonly PatternLoadoutEntry[],
  columnRowsByKey: PatternLoadoutGridData['columnRowsByKey'],
  options?: CollectRecommendedGridPiecesOptions,
): ArmorPiece[] {
  const includeNearMatch = options?.includeNearMatch ?? false;
  const seen = new Set<string>();
  const pieces: ArmorPiece[] = [];

  for (const column of columns) {
    for (const row of columnRowsByKey[column.columnKey] ?? []) {
      const piece = row.displayPiece;
      if (!piece) continue;
      if (!includeNearMatch && row.matchTier === 'near') continue;
      if (seen.has(piece.instanceId)) continue;
      seen.add(piece.instanceId);
      pieces.push(piece);
    }
  }

  return pieces;
}
