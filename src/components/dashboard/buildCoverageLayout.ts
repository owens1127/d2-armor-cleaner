import type { CSSProperties } from 'react';
import type { PatternLoadoutEntry } from '@/lib/coverage/loadout';

/** Synchronized loadout grid: 1 header row + 5 armor slot rows per pattern column. */
export const LOADOUT_GRID_ROW_COUNT = 6;

/** Minimum header track height — title, set, and chips wrap naturally. */
export const LOADOUT_HEADER_ROW_MIN_H = '2rem';

/** Slot row height includes pb-2 so the Choose control clears the row border. */
export const LOADOUT_SLOT_MAIN_H = 'h-[5.5rem] pb-2';

/** Outer row track size for subgrid alignment (matches LOADOUT_SLOT_MAIN_H). */
export const LOADOUT_SLOT_ROW_H = '5.5rem';

/** Fits copy + 4×32px compact icon buttons with gap-0.5. */
export const LOADOUT_ACTION_COL_W = 'w-[8.5rem] min-w-[8.5rem]';
export const LOADOUT_CHOOSE_BTN_H = 'h-7 min-h-7';

/** Minimum pattern column width; columns grow with 1fr to fill the set row. */
export const LOADOUT_COLUMN_MIN_W = '20rem';

export function rollPatternLoadoutGridTemplateRows(): string {
  return `minmax(${LOADOUT_HEADER_ROW_MIN_H},auto) repeat(5,minmax(${LOADOUT_SLOT_ROW_H},auto))`;
}

/** Set row: shared row tracks so column headers and slots stay equal height (CSS subgrid). */
export function rollPatternLoadoutSetRowStyle(columnCount: number): CSSProperties {
  return {
    ...rollPatternLoadoutColumnsStyle(columnCount),
    gridTemplateRows: rollPatternLoadoutGridTemplateRows(),
  };
}

/** Pattern column spans the set row and inherits row tracks from the parent grid. */
export function rollPatternLoadoutColumnSubgridStyle(): CSSProperties {
  return {
    gridRow: `span ${LOADOUT_GRID_ROW_COUNT}`,
    gridTemplateRows: 'subgrid',
  };
}

function loadoutColumnTrack(): string {
  return `minmax(${LOADOUT_COLUMN_MIN_W}, 1fr)`;
}

/** Set-row grid shell — column tracks come from rollPatternLoadoutColumnsStyle (inline). */
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
