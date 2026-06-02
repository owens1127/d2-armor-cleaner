import { groupPatternLoadoutColumnsBySet } from '@/components/dashboard/buildCoverageLayout';
import {
  bestPiecesForPatternBySlot,
  columnSlotContextFromColumn,
  formatNearMatchTooltip,
  formatTopGoldColumnTooltip,
  isColumnSlotEligiblePiece,
  isTopGoldColumnPiece,
  rankEligiblePiecesForPatternInSlot,
  resolvePatternSlotLoadoutPiece,
  selectRecommendedPatternLoadout,
  type PatternLoadoutEntry,
  type PatternLoadoutSource,
  type PatternSlotLoadoutEntry,
  type PatternSlotMatchTier,
} from '@/lib/coverage/loadout';
import type { EligibleLoadoutPiece } from '@/lib/coverage/analyze';
import { parseSetBonusTargets } from '@/lib/coverage/setBonus';
import type { BuildProfile } from '@/lib/coverage/builds';
import { ARMOR_SLOTS, SLOT_LABELS } from '@/lib/constants';
import type { ArmorPiece, ArmorSlot, Stat } from '@/types';

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
  // Do not pin the global recommended loadout onto every column — that surfaces wrong
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
  return `Eligible ${setName ? `${setName} ` : ''}${SLOT_LABELS[slot].toLowerCase()} for this roll column`;
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
