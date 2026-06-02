import { describe, expect, it } from 'vitest';
import {
  buildArchetypeRanker,
  buildSetRanker,
  buildTertiaryRanker,
  calibrationSetPieces,
  calibrationTertiaryStats,
  calibrationTuningStats,
  defaultSetOrderHashes,
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
    ranker.recordChoice('gunner', 'grenadier');
    ranker.recordChoice('grenadier', 'paragon');
    ranker.recordChoice('paragon', 'brawler');
    ranker.recordChoice('brawler', 'bulwark');
    ranker.recordChoice('bulwark', 'specialist');
    expect(ranker.isConfident()).toBe(true);
  });
});

describe('buildTertiaryRanker', () => {
  it('does not repeat decided pairs', () => {
    const items = [piece('1', 'gunner', 'melee'), piece('2', 'gunner', 'super')];
    const statRank: Stat[] = ['melee', 'super', 'health', 'class', 'weapons', 'grenade'];
    const ranker = buildTertiaryRanker(items, statRank, [{ winner: 'melee', loser: 'super' }]);
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
    const statRank: Stat[] = ['super', 'melee', 'health', 'weapons', 'grenade', 'class'];
    const stats = calibrationTertiaryStats(items, statRank);
    expect(stats).toContain('melee');
    expect(stats).toContain('super');
    expect(calibrationTuningStats(items, statRank, 'gunner')).toEqual(
      expect.arrayContaining(['weapons', 'melee']),
    );
    expect(calibrationTuningStats(items, statRank, 'gunner')).toHaveLength(2);
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
