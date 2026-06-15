import { describe, expect, it } from 'vitest';
import { planBulkDimTagApply } from '@/lib/dim/bulkTagPlan';
import {
  buildMergedGroupedSlotRows,
  collectRecommendedPatternGridPieces,
  countGroupPerfectSlots,
  countOverallPerfectSlotsInSetRow,
  groupPatternLoadoutColumnsIntoOne,
  mergeGroupedEligibleBySlot,
  patternSetRowColumnsAreCollapsible,
  resolveCollapsedSetRowHeaderPattern,
  resolveGroupedSlotSelectionColumn,
  type PatternColumnSlotRow,
} from '@/lib/coverage/patternLoadoutGrid';
import {
  deriveOptimalRollPatterns,
  type PatternLoadoutEntry,
  type PatternSlotLoadoutEntry,
} from '@/lib/coverage/loadout';
import type { EligibleLoadoutPiece } from '@/lib/coverage/analyze';
import type { ArmorPiece, ArmorSlot } from '@/types';

function slotEntry(slot: ArmorSlot): PatternSlotLoadoutEntry {
  return { slot, piece: null, matchTier: 'perfect', contributionScore: 0 };
}

function row(
  slot: ArmorSlot,
  displayPiece: ArmorPiece | null,
  matchTier: PatternColumnSlotRow['matchTier'] = 'perfect',
): PatternColumnSlotRow {
  return {
    slotEntry: slotEntry(slot),
    displayPiece,
    matchTier,
    selectionSource: 'auto',
    topGold: false,
    showComboBadge: false,
    comboBadgeCount: 0,
  };
}

function piece(instanceId: string, dimTag?: ArmorPiece['dimTag']): ArmorPiece {
  return {
    instanceId,
    name: instanceId,
    armorSlot: 'helmet',
    archetype: 'bulwark',
    tertiaryStat: 'health',
    tuningStat: 'health',
    baseStats: { health: 20, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 },
    isIgnored: false,
    dimTag,
  } as ArmorPiece;
}

describe('collectRecommendedPatternGridPieces', () => {
  const columns = [
    { columnKey: 'col-a', patternKey: 'p-a' },
    { columnKey: 'col-b', patternKey: 'p-b' },
  ] as PatternLoadoutEntry[];

  it('dedupes displayed pieces and skips near-match for tag bulk', () => {
    const shared = piece('shared-helmet');
    const nearOnly = piece('near-chest');
    const columnRowsByKey = {
      'col-a': [row('helmet', shared), row('chest', nearOnly, 'near')],
      'col-b': [row('helmet', shared), row('arms', piece('arms-only'))],
    };

    expect(
      collectRecommendedPatternGridPieces(columns, columnRowsByKey).map((p) => p.instanceId),
    ).toEqual(['shared-helmet', 'arms-only']);

    expect(
      collectRecommendedPatternGridPieces(columns, columnRowsByKey, {
        includeNearMatch: true,
      }).map((p) => p.instanceId),
    ).toEqual(['shared-helmet', 'near-chest', 'arms-only']);
  });

  it('bulk keep plan from collected grid pieces is a single untagged batch', () => {
    const shared = piece('shared-helmet', 'keep');
    const columnRowsByKey = {
      'col-a': [row('helmet', shared), row('chest', piece('chest-new'))],
      'col-b': [row('arms', piece('arms-only'))],
    };
    const taggable = collectRecommendedPatternGridPieces(columns, columnRowsByKey);
    const plan = planBulkDimTagApply(taggable, 'keep');
    expect(plan?.tag).toBe('keep');
    expect(plan?.pieces.map((p) => p.instanceId).sort()).toEqual(['arms-only', 'chest-new']);
  });
});

describe('countOverallPerfectSlotsInSetRow', () => {
  const columns = [
    { columnKey: 'col-weapons', patternKey: 'p-w' },
    { columnKey: 'col-super', patternKey: 'p-s' },
  ] as PatternLoadoutEntry[];

  it('counts union of perfect slots across columns', () => {
    const columnRowsByKey = {
      'col-weapons': [row('helmet', piece('helmet')), row('chest', piece('chest'))],
      'col-super': [
        row('helmet', piece('helmet-dup')),
        row('legs', piece('legs')),
        row('arms', piece('arms')),
        row('classItem', piece('cloak')),
      ],
    };
    expect(countOverallPerfectSlotsInSetRow(columns, columnRowsByKey)).toBe(5);
  });

  it('ignores near-match and empty slots', () => {
    const columnRowsByKey = {
      'col-weapons': [row('helmet', piece('helmet')), row('chest', null)],
      'col-super': [row('legs', piece('legs')), row('classItem', piece('cloak'), 'near')],
    };
    expect(countOverallPerfectSlotsInSetRow(columns, columnRowsByKey)).toBe(2);
  });
});

describe('groupPatternLoadoutColumnsIntoOne', () => {
  const tuningColumns = [
    {
      columnKey: 'powerhouse:class:weapons',
      patternKey: 'powerhouse:class:weapons',
      pattern: {
        archetype: 'powerhouse',
        tertiaryStat: 'class',
        tuningStat: 'weapons',
      },
    },
    {
      columnKey: 'powerhouse:class:super',
      patternKey: 'powerhouse:class:super',
      pattern: {
        archetype: 'powerhouse',
        tertiaryStat: 'class',
        tuningStat: 'super',
      },
    },
    {
      columnKey: 'powerhouse:grenade:weapons',
      patternKey: 'powerhouse:grenade:weapons',
      pattern: {
        archetype: 'powerhouse',
        tertiaryStat: 'grenade',
        tuningStat: 'weapons',
      },
    },
  ] as PatternLoadoutEntry[];

  it('collapses every pattern column in a set row into one group', () => {
    expect(patternSetRowColumnsAreCollapsible(tuningColumns)).toBe(true);
    const group = groupPatternLoadoutColumnsIntoOne(tuningColumns);
    expect(group.columns).toHaveLength(3);
    expect(resolveCollapsedSetRowHeaderPattern(tuningColumns)).toEqual({
      archetype: 'powerhouse',
      tertiaryStat: null,
    });
  });

  it('uses any archetype header when set row mixes archetypes', () => {
    const mixed = [
      ...tuningColumns,
      {
        columnKey: 'bulwark:class:weapons',
        patternKey: 'bulwark:class:weapons',
        pattern: {
          archetype: 'bulwark',
          tertiaryStat: 'class',
          tuningStat: 'weapons',
        },
      },
    ] as PatternLoadoutEntry[];

    expect(resolveCollapsedSetRowHeaderPattern(mixed)).toEqual({
      archetype: null,
      tertiaryStat: null,
    });
  });

  it('picks the best slot row across all collapsed columns', () => {
    const group = groupPatternLoadoutColumnsIntoOne(tuningColumns);
    const columnRowsByKey = {
      'powerhouse:class:weapons': [row('helmet', piece('weapons-helm'))],
      'powerhouse:class:super': [row('helmet', piece('super-helm'))],
      'powerhouse:grenade:weapons': [row('helmet', piece('grenade-helm'))],
    };

    const merged = buildMergedGroupedSlotRows(group, columnRowsByKey);
    expect(merged[0]?.displayPiece?.instanceId).toBe('super-helm');
    expect(merged[0]?.sourceColumnKey).toBe('powerhouse:class:super');
    expect(countGroupPerfectSlots(group, columnRowsByKey)).toBe(1);
  });

  it('routes collapsed picks to the column that owns the piece', () => {
    const group = groupPatternLoadoutColumnsIntoOne(tuningColumns);
    const patternEligibleBySlot = {
      'powerhouse:class:weapons': {
        helmet: [{ piece: piece('weapons-helm'), contributionScore: 1, fitLabel: 'fit' }],
      },
      'powerhouse:grenade:weapons': {
        helmet: [{ piece: piece('grenade-helm'), contributionScore: 1, fitLabel: 'fit' }],
      },
    };

    const weaponsTarget = resolveGroupedSlotSelectionColumn(
      group,
      'helmet',
      'weapons-helm',
      patternEligibleBySlot,
    );
    expect(weaponsTarget.columnKey).toBe('powerhouse:class:weapons');

    const grenadeTarget = resolveGroupedSlotSelectionColumn(
      group,
      'helmet',
      'grenade-helm',
      patternEligibleBySlot,
    );
    expect(grenadeTarget.columnKey).toBe('powerhouse:grenade:weapons');
  });
});

describe('mergeGroupedEligibleBySlot', () => {
  it('sorts union by picker rank instead of column iteration order', () => {
    const priorities = ['weapons', 'super'] as const;
    const superPattern = deriveOptimalRollPatterns([...priorities]).find(
      (pattern) => pattern.tuningStat === 'super',
    )!;
    const group = groupPatternLoadoutColumnsIntoOne([
      { columnKey: 'col-a', patternKey: 'p-a', pattern: superPattern },
      { columnKey: 'col-b', patternKey: 'p-b', pattern: superPattern },
    ] as PatternLoadoutEntry[]);

    const sharedShape = {
      name: 'Shared Helm',
      classType: 'hunter' as const,
      armorSlot: 'helmet' as const,
      archetype: 'powerhouse' as const,
      tertiaryStat: 'melee' as const,
      tuningStat: 'super' as const,
      tier: 5,
      power: 450,
      location: 'vault' as const,
      isMasterwork: false,
      dimTag: null,
      baseStats: { weapons: 35, super: 30, melee: 20 },
    };
    const lowerRanked = {
      piece: { itemHash: 1, instanceId: 'lower-ranked', ...sharedShape, wantScore: 0.1 },
      contributionScore: 1,
      fitLabel: '',
    } satisfies EligibleLoadoutPiece;
    const higherRanked = {
      piece: { itemHash: 2, instanceId: 'higher-ranked', ...sharedShape, wantScore: 0.95 },
      contributionScore: 1,
      fitLabel: '',
    } satisfies EligibleLoadoutPiece;

    const patternEligibleBySlot = {
      'col-a': { helmet: [lowerRanked] },
      'col-b': { helmet: [higherRanked] },
    };

    const merged = mergeGroupedEligibleBySlot(group, patternEligibleBySlot, [...priorities]);
    expect(merged.helmet?.map((entry) => entry.piece.instanceId)).toEqual([
      'higher-ranked',
      'lower-ranked',
    ]);
  });
});
