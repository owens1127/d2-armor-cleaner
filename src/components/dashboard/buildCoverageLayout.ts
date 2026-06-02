import type { CSSProperties } from 'react';
import type { PatternLoadoutEntry } from '@/lib/coverage/loadout';

/** Fixed header row - keeps slot rows aligned across pattern columns. */
export const LOADOUT_HEADER_ROW_H = '4.5rem';

/** Slot row shell - fills subgrid track, clips overflow. */
export const LOADOUT_SLOT_ROW_SHELL =
  'box-border h-16 min-h-16 max-h-16 overflow-hidden';

/** Fixed slot row track - subgrid keeps every column row-aligned. */
export const LOADOUT_SLOT_ROW_H = '4rem';

/**
 * Three-column row: slot cluster | name (2 lines) | fixed-width 5-slot action rail.
 */
export const LOADOUT_ROW_INNER_CLASS =
  'grid h-16 w-full min-h-16 max-h-16 flex-1 items-center gap-x-2 overflow-hidden px-3 py-1';

export const LOADOUT_LEFT_CLUSTER_CLASS =
  'flex w-[var(--loadout-left-cluster)] min-w-[var(--loadout-left-cluster)] max-w-[var(--loadout-left-cluster)] shrink-0 items-center gap-1 overflow-hidden';

/** Name + meta - always two lines tall so rows do not shift when meta is empty. */
export const LOADOUT_TEXT_BLOCK_CLASS =
  'relative z-0 flex min-h-[2.375rem] min-w-0 flex-col justify-center overflow-hidden';

export const LOADOUT_NAME_CLASS =
  'block truncate text-sm font-medium leading-tight text-white';

/** Second line: tier/set meta or near-match hint; min-height holds space when empty. */
export const LOADOUT_META_LINE_CLASS = 'mt-0.5 flex min-h-[1.125rem] items-center gap-1.5';

/** [DIM][keep][favorite][junk][Choose N] - fixed tracks, never omit a cell. */
export const LOADOUT_ACTION_GRID_CLASS =
  'relative z-10 grid shrink-0 items-center justify-self-end gap-0.5';

export const LOADOUT_ACTION_CELL_CLASS =
  'flex size-[var(--spacing-touch-sm)] items-center justify-center';

export const LOADOUT_ACTION_CHOOSE_CELL_CLASS =
  'flex h-[var(--spacing-touch-sm)] w-full items-center justify-center';

/** Invisible placeholder occupying the same box as a real control. */
export const LOADOUT_ACTION_PLACEHOLDER_CLASS = 'pointer-events-none invisible';

/** Choose chip - fixed height; column 5 width comes from the action grid track. */
export function loadoutChooseBtnClass(options: { open: boolean }): string {
  const base =
    'inline-flex h-[var(--spacing-touch-sm)] w-full min-w-0 max-w-full cursor-pointer items-center justify-center gap-0.5 overflow-hidden whitespace-nowrap rounded border px-1 text-[10px] font-medium leading-none transition-colors';
  if (options.open) {
    return `${base} border-white/25 bg-white/12 text-white ring-1 ring-white/20`;
  }
  return `${base} border-border text-muted hover:bg-white/5 hover:text-white hover:border-white/15`;
}

/** Minimum pattern column width; must fit left cluster + text + action rail. */
export const LOADOUT_COLUMN_MIN_W = 'var(--loadout-column-min)';

export function rollPatternLoadoutColumnGridTemplateRows(): string {
  return `${LOADOUT_HEADER_ROW_H} repeat(5, ${LOADOUT_SLOT_ROW_H})`;
}

/** Set row: column tracks only; each pattern column owns matching fixed row tracks. */
export function rollPatternLoadoutSetRowStyle(columnCount: number): CSSProperties {
  return rollPatternLoadoutColumnsStyle(columnCount);
}

/** Pattern column - fixed header + five slot rows (same template in every column). */
export function rollPatternLoadoutColumnGridStyle(): CSSProperties {
  return {
    gridTemplateRows: rollPatternLoadoutColumnGridTemplateRows(),
  };
}

export function rollPatternSlotRowInnerStyle(): CSSProperties {
  return {
    gridTemplateColumns:
      'var(--loadout-left-cluster) minmax(0, 1fr) var(--loadout-action-rail)',
  };
}

/** Picker list row - middle column grows; rail is 4 compact buttons only. */
export function rollPatternPickerSlotRowInnerStyle(): CSSProperties {
  return {
    gridTemplateColumns:
      'var(--loadout-left-cluster) minmax(0, 1fr) var(--loadout-picker-action-rail)',
  };
}

export function rollPatternActionRailStyle(): CSSProperties {
  return {
    width: 'var(--loadout-action-rail)',
    minWidth: 'var(--loadout-action-rail)',
    maxWidth: 'var(--loadout-action-rail)',
    gridTemplateColumns: 'repeat(4, var(--spacing-touch-sm)) 5.5rem',
  };
}

export function rollPatternPickerActionRailStyle(): CSSProperties {
  return {
    width: 'var(--loadout-picker-action-rail)',
    minWidth: 'var(--loadout-picker-action-rail)',
    maxWidth: 'var(--loadout-picker-action-rail)',
    gridTemplateColumns: 'repeat(4, var(--spacing-touch-sm))',
  };
}

/** Measured pattern column width capped to viewport (picker menu inline width). */
export function measureLoadoutPickerMenuWidthPx(columnWidthPx: number, viewportWidthPx: number): number {
  const max = Math.max(0, viewportWidthPx - 16);
  if (columnWidthPx <= 0) return max;
  return Math.min(columnWidthPx, max);
}

function loadoutColumnTrack(): string {
  return `minmax(${LOADOUT_COLUMN_MIN_W}, 1fr)`;
}

/** Set-row grid shell - column tracks come from rollPatternLoadoutColumnsStyle (inline). */
export function rollPatternColumnsGridClass(): string {
  return 'w-full min-w-0';
}

/**
 * Equal-width columns within a set row; auto-fit grows columns to fill the row (no empty tracks).
 * Wraps to 2×2 / 1 col when the viewport cannot fit another min-width column.
 */
export function rollPatternLoadoutColumnsStyle(columnCount: number): CSSProperties {
  const track = loadoutColumnTrack();
  return {
    gridTemplateColumns:
      columnCount <= 1 ? track : `repeat(auto-fit, ${track})`,
  };
}

export interface PatternLoadoutSetRow {
  setKey: string;
  setHash?: number;
  setName?: string;
  columns: PatternLoadoutEntry[];
}

/** When any column splits tertiary/tuning, every column in the row shows split chips. */
export function shouldSplitRollChipsInSetRow(columns: PatternLoadoutEntry[]): boolean {
  return columns.some(
    (column) => column.pattern.tertiaryStat !== column.pattern.tuningStat,
  );
}

/** One grid row per armor set; pattern columns stay together within each set row. */
export function groupPatternLoadoutColumnsBySet(
  columns: PatternLoadoutEntry[],
): PatternLoadoutSetRow[] {
  if (columns.length === 0) return [];

  const hasSetGroups = columns.some((column) => column.setHash !== undefined);
  if (!hasSetGroups) {
    return [{ setKey: 'patterns', columns }];
  }

  const bySet = new Map<number, PatternLoadoutEntry[]>();
  const setOrder: number[] = [];

  for (const column of columns) {
    const hash = column.setHash!;
    if (!bySet.has(hash)) {
      bySet.set(hash, []);
      setOrder.push(hash);
    }
    bySet.get(hash)!.push(column);
  }

  return setOrder.map((hash) => {
    const setColumns = bySet.get(hash)!;
    return {
      setKey: String(hash),
      setHash: hash,
      setName: setColumns[0]?.setName,
      columns: setColumns,
    };
  });
}
