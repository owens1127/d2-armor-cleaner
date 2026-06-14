import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '@/lib/constants';
import {
  buildArchetypeRanker,
  buildSetRanker,
  buildTertiaryRanker,
  calibrationSetPieces,
  calibrationTertiaryStats,
  calibrationTuningStats,
  defaultArchetypeOrder,
  defaultSetOrderHashes,
  normalizeArchetypeOrder,
} from './calibrate';
import type { ArmorPiece, Archetype, Stat } from '@/types';

function piece(
  id: string,
  archetype: Archetype,
  tertiary: Stat,
  opts: Partial<ArmorPiece> = {},
): ArmorPiece {
  return {
    instanceId: id,
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype,
    baseStats: {},
    tertiaryStat: tertiary,
    isMasterwork: false,
    dimTag: null,
    ...opts,
  };
}

describe('default order helpers', () => {
  it('normalizeArchetypeOrder dedupes and fills missing archetypes', () => {
    const base = defaultArchetypeOrder();
    expect(
      normalizeArchetypeOrder([
        base[0],
        base[0],
        ...base.slice(1, -1),
        base[base.length - 2],
      ]),
    ).toEqual(base);
    expect(normalizeArchetypeOrder(base)).toEqual(base);
    expect(normalizeArchetypeOrder(['gunner'])).toEqual(base);
  });

  it('defaultSetOrderHashes follows vault frequency ordering', () => {
    const items = [
      piece('a', 'gunner', 'melee', {
        armorSet: { hash: 1, name: 'Rare', perks: [] },
      }),
      piece('b', 'gunner', 'melee', {
        armorSet: { hash: 2, name: 'Common', perks: [] },
      }),
      piece('c', 'gunner', 'melee', {
        armorSet: { hash: 2, name: 'Common', perks: [] },
      }),
    ];
    expect(defaultSetOrderHashes(items)).toEqual([2, 1]);
    expect(calibrationSetPieces(items).map((p) => p.armorSet!.hash)).toEqual([2, 1]);
  });
});

describe('buildArchetypeRanker', () => {
  it('picks adjacent prior pairs first and stops when order is clear', () => {
    const ranker = buildArchetypeRanker([]);
    expect(ranker.nextPair()?.[0]).toBe('gunner');
    for (let i = 0; i < ARCHETYPES.length - 1; i++) {
      ranker.recordChoice(ARCHETYPES[i], ARCHETYPES[i + 1]);
    }
    expect(ranker.isConfident()).toBe(true);
  });
});

describe('buildTertiaryRanker', () => {
  it('does not repeat decided pairs', () => {
    const items = [piece('1', 'gunner', 'melee'), piece('2', 'gunner', 'super')];
    const ranker = buildTertiaryRanker(items, [{ winner: 'melee', loser: 'super' }], 'gunner');
    expect(ranker.nextPair()).toBeNull();
  });
});

describe('calibration vault helpers', () => {
  it('uses vault tertiaries and tuning stats for the focus archetype', () => {
    const items = [
      piece('1', 'gunner', 'melee'),
      piece('2', 'gunner', 'super'),
      piece('3', 'gunner', 'super', { tuningStat: 'weapons' }),
      piece('4', 'gunner', 'super', { tuningStat: 'melee' }),
    ];
    const stats = calibrationTertiaryStats(items);
    expect(stats).toContain('melee');
    expect(stats).toContain('super');
    expect(calibrationTuningStats(items, 'gunner')).toEqual(
      expect.arrayContaining(['weapons', 'melee']),
    );
    expect(calibrationTuningStats(items, 'gunner')).toHaveLength(2);
  });
});

describe('buildSetRanker', () => {
  it('orders sets by vault frequency prior', () => {
    const items = [
      setPiece('iron-1', 1, 'Iron Panoply'),
      setPiece('iron-2', 1, 'Iron Panoply'),
      setPiece('disaster-1', 2, 'Disaster Corps'),
    ];
    const ranker = buildSetRanker(items, []);
    expect(ranker.nextPair()).toEqual([1, 2]);
  });
});

describe('calibrationSetPieces', () => {
  it('orders representatives by vault piece count', () => {
    const items = [
      setPiece('rare', 3, 'Renegade'),
      setPiece('iron-1', 1, 'Iron Panoply'),
      setPiece('iron-2', 1, 'Iron Panoply'),
      setPiece('iron-3', 1, 'Iron Panoply'),
      setPiece('disaster-1', 2, 'Disaster Corps'),
      setPiece('disaster-2', 2, 'Disaster Corps'),
    ];
    expect(calibrationSetPieces(items).map((p) => p.armorSet!.hash)).toEqual([1, 2, 3]);
  });
});

function setPiece(
  id: string,
  setHash: number,
  setName: string,
  opts: Partial<ArmorPiece> = {},
): ArmorPiece {
  return piece(id, 'gunner', 'super', {
    armorSet: {
      hash: setHash,
      name: setName,
      perks: [{ name: '2pc', description: 'Bonus' }],
    },
    ...opts,
  });
}
