import { describe, expect, it } from 'vitest';
import { planBulkDimTagApply } from '@/lib/dim/bulkTagPlan';
import {
  collectRecommendedPatternGridPieces,
  type PatternColumnSlotRow,
} from '@/lib/coverage/patternLoadoutGrid';
import type { PatternLoadoutEntry, PatternSlotLoadoutEntry } from '@/lib/coverage/loadout';
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
