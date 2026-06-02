import { describe, expect, it } from 'vitest';
import { allDismantleCandidates } from '@/lib/dupes/dismantle';
import {
  filterBrowseRedundantOnly,
  isBrowseRedundantActive,
  setBrowseRedundantInParams,
} from '@/lib/browse/redundantFilter';
import { BROWSE_REDUNDANT_QUERY } from '@/lib/nav';
import type { ArmorPiece } from '@/types';

function piece(
  id: string,
  stats: Partial<Record<'weapons' | 'grenade' | 'super' | 'melee' | 'health' | 'class', number>>,
): ArmorPiece {
  return {
    instanceId: id,
    itemHash: 1,
    name: `Piece ${id}`,
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'gunner',
    baseStats: stats,
    tertiaryStat: 'super',
    isMasterwork: false,
    dimTag: null,
    armorSet: { hash: 1, name: 'Ferropotent', perks: [] },
  };
}

describe('browse redundant filter', () => {
  it('detects redundant=1 in search params', () => {
    expect(isBrowseRedundantActive('?redundant=1')).toBe(true);
    expect(isBrowseRedundantActive(new URLSearchParams('redundant=1'))).toBe(true);
    expect(isBrowseRedundantActive('')).toBe(false);
    expect(isBrowseRedundantActive('redundant=true')).toBe(false);
  });

  it('sets and clears redundant query param', () => {
    const on = setBrowseRedundantInParams(new URLSearchParams('build=ws'), true);
    expect(on.get(BROWSE_REDUNDANT_QUERY)).toBe('1');
    expect(on.get('build')).toBe('ws');

    const off = setBrowseRedundantInParams(on, false);
    expect(off.has(BROWSE_REDUNDANT_QUERY)).toBe(false);
    expect(off.get('build')).toBe('ws');
  });

  it('keeps only dismantle candidates when redundant-only is active', () => {
    const keeper = piece('keep', { weapons: 35, grenade: 25, super: 23 });
    const junk = piece('junk', { weapons: 28, grenade: 25, super: 20 });
    const items = [keeper, junk];
    const redundantRollIds = new Set(
      allDismantleCandidates(items, 'hunter').map((c) => c.item.instanceId),
    );

    expect(filterBrowseRedundantOnly(items, false, redundantRollIds)).toHaveLength(2);
    const filtered = filterBrowseRedundantOnly(items, true, redundantRollIds);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.instanceId).toBe('junk');
  });
});
