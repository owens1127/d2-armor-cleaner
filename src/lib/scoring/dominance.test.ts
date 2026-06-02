import { describe, expect, it } from 'vitest';
import {
  autoJunkCandidates,
  dominatorBeatStats,
  findDominator,
  findDominatorsMap,
  formatBeatsOn,
  isSingleStatSidegrade,
  qualifiesAsStatLowerDominator,
} from './dominance';
import type { ArmorPiece } from '@/types';

function piece(
  id: string,
  stats: Partial<Record<'weapons' | 'grenade' | 'super' | 'melee' | 'health' | 'class', number>>,
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
    archetype: 'gunner',
    baseStats: stats,
    tertiaryStat: 'super',
    isMasterwork: false,
    dimTag: null,
    armorSet: { hash: 1, name: 'Ferropotent', perks: [] },
    ...opts,
  };
}

describe('autoJunkCandidates', () => {
  it('returns dominated items in a bucket', () => {
    const items = [
      piece('keep', { weapons: 35, grenade: 25, super: 23 }),
      piece('junk', { weapons: 28, grenade: 25, super: 20 }),
    ];
    expect(autoJunkCandidates(items).map((i) => i.instanceId)).toEqual(['junk']);
  });
});

describe('findDominator', () => {
  it('returns the beating piece and stat deltas', () => {
    const keeper = piece('keep', { weapons: 35, grenade: 25, super: 23 }, { name: 'Better Mask' });
    const junk = piece('junk', { weapons: 30, grenade: 25, super: 20 }, { name: 'Ferropotent Mask' });
    const result = findDominator(junk, [keeper, junk]);
    expect(result?.dominator.instanceId).toBe('keep');
    expect(formatBeatsOn(result!.beatsOn)).toBe('Weapons +5 · Super +3');
  });

  it('ignores dominators from a different archetype, set, or tertiary', () => {
    const keeper = piece(
      'keep',
      { weapons: 35, grenade: 25, super: 20 },
      { archetype: 'grenadier', name: 'Disaster Corps Mask' },
    );
    const junk = piece('junk', { weapons: 30, grenade: 25, super: 20 }, { archetype: 'gunner' });
    expect(findDominator(junk, [keeper, junk])).toBeNull();

    const classMask = piece(
      'class',
      { melee: 0, health: 25, class: 30 },
      { archetype: 'brawler', tertiaryStat: 'class' },
    );
    const weaponsMask = piece(
      'weapons',
      { melee: 0, health: 25, weapons: 20 },
      { archetype: 'brawler', tertiaryStat: 'weapons' },
    );
    expect(findDominator(classMask, [classMask, weaponsMask])).toBeNull();
  });
});

describe('findDominatorsMap', () => {
  it('points to maximal dominator in a C > A > B chain regardless of order', () => {
    const c = piece('c', { weapons: 40, grenade: 30, super: 25 });
    const a = piece('a', { weapons: 35, grenade: 25, super: 23 });
    const b = piece('b', { weapons: 30, grenade: 25, super: 20 });

    for (const items of [[c, a, b], [a, b, c], [b, a, c]]) {
      const map = findDominatorsMap(items);
      expect(map.get('b')?.dominator.instanceId).toBe('c');
      expect(map.get('a')?.dominator.instanceId).toBe('c');
    }
  });
});

describe('findDominator Ferropotent regression', () => {
  it('does not flag 25/25/20 vs 35/25/20 same tertiary as stat-lower (sidegrade)', () => {
    const keeper = piece('keep', { weapons: 35, grenade: 25, super: 20 });
    const junk = piece('junk', { weapons: 25, grenade: 25, super: 20 });
    expect(isSingleStatSidegrade(keeper, junk)).toBe(true);
    expect(qualifiesAsStatLowerDominator(keeper, junk)).toBe(false);
    expect(findDominator(junk, [keeper, junk])).toBeNull();
  });

  it('does not flag MW+mod worn total alone as stat-lower redundant', () => {
    const keeper = piece(
      'keep',
      { weapons: 25, grenade: 23, super: 18 },
      { isMasterwork: true, modStats: { weapons: 8 }, modStatsAdditive: true },
    );
    const junk = piece('junk', { weapons: 25, grenade: 25, super: 20 });
    expect(findDominator(junk, [keeper, junk])).toBeNull();
  });
});

describe('masterwork and mod dominance', () => {
  it('does not dominate when worn stat totals match (MW/mod only difference)', () => {
    const plain = piece('plain', { weapons: 14, grenade: 24, super: 19 }, {
      armorSlot: 'arms',
      archetype: 'grenadier',
      tertiaryStat: 'weapons',
      modStats: { weapons: 6, grenade: 6, super: 6 },
      modStatsAdditive: true,
    });
    const upgraded = piece(
      'mw',
      { weapons: 14, grenade: 24, super: 19 },
      {
        armorSlot: 'arms',
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        isMasterwork: true,
        modStats: { weapons: 4, grenade: 4, super: 4 },
        modStatsAdditive: true,
      },
    );
    expect(findDominator(plain, [plain, upgraded])).toBeNull();
  });

  it('uses intrinsic deltas when MW+mods inflate worn totals', () => {
    const dominator = piece(
      'd',
      { weapons: 25, grenade: 23, super: 18 },
      { isMasterwork: true, modStats: { weapons: 8 }, modStatsAdditive: true },
    );
    const candidate = piece('c', { weapons: 25, grenade: 25, super: 20 });
    expect(formatBeatsOn(dominatorBeatStats(dominator, candidate))).toBe('Grenade -2 · Super -2');
  });
});
