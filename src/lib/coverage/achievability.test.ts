import { describe, expect, it } from 'vitest';
import { ARMOR_SLOTS } from '@/lib/constants';
import type { ArmorPiece, Stat } from '@/types';
import {
  buildVerdictFromRows,
  canonicalCombinedPriorityTotal,
  computeOptimalRollShapes,
  computeStatAchievability,
  formatBuildVerdict,
  isBestTierLoadoutPiece,
  maxCanonicalCombinedPriorityTotal,
  optimalArchetypesForPush,
} from './achievability';

function piece(overrides: Partial<ArmorPiece> & { instanceId: string }): ArmorPiece {
  return {
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'chest',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'paragon',
    baseStats: { super: 30, melee: 25, grenade: 20 },
    tertiaryStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}


describe('canonical optimal roll math', () => {
  it('Gunner and Paragon tie at 50 intrinsic toward Weapons+Super; Grenadier and Specialist do not', () => {
    const intrinsicOnly = (archetype: Parameters<typeof canonicalCombinedPriorityTotal>[0], tertiary: Stat) =>
      canonicalCombinedPriorityTotal(archetype, tertiary, undefined, ['weapons', 'super']) -
      2 * 2; // subtract MW (+2 per rolled line)

    expect(intrinsicOnly('gunner', 'super')).toBe(50);
    expect(intrinsicOnly('paragon', 'weapons')).toBe(50);
    expect(intrinsicOnly('grenadier', 'weapons')).toBeLessThan(50);
    expect(intrinsicOnly('specialist', 'super')).toBeLessThan(50);
    expect(intrinsicOnly('powerhouse', 'melee')).toBe(55);
  });

  it('Powerhouse maximizes Weapons+Super; legacy split-push archetypes do not', () => {
    const max = maxCanonicalCombinedPriorityTotal(['weapons', 'super']);
    expect(max).toBe(67);
    expect(
      canonicalCombinedPriorityTotal('powerhouse', 'melee', 'weapons', ['weapons', 'super']),
    ).toBe(67);
    expect(
      canonicalCombinedPriorityTotal('gunner', 'super', 'weapons', ['weapons', 'super']),
    ).toBeLessThan(max);
    expect(
      canonicalCombinedPriorityTotal('paragon', 'weapons', 'super', ['weapons', 'super']),
    ).toBeLessThan(max);
    expect(
      canonicalCombinedPriorityTotal('grenadier', 'weapons', 'weapons', ['weapons', 'super']),
    ).toBeLessThan(max);
    expect(
      canonicalCombinedPriorityTotal('specialist', 'super', 'super', ['weapons', 'super']),
    ).toBeLessThan(max);
  });

  it('lists only max-budget archetypes per push stat', () => {
    expect(optimalArchetypesForPush('super', ['weapons', 'super'])).toEqual([]);
    expect(optimalArchetypesForPush('weapons', ['weapons', 'super'])).toEqual([]);
  });

  it('includes dual-intrinsic monument shapes for matching two-stat builds', () => {
    const shapes = computeOptimalRollShapes(['weapons', 'super']);
    expect(shapes.some((shape) => shape.archetype === 'powerhouse')).toBe(true);
    expect(new Set(shapes.map((shape) => shape.archetype))).toEqual(new Set(['powerhouse']));
  });

  it('finds optimal shapes for a three-stat build (Weapons/Super/Grenade)', () => {
    const priorities = ['weapons', 'super', 'grenade'] as const;
    const max = maxCanonicalCombinedPriorityTotal([...priorities]);
    expect(max).toBeGreaterThan(0);
    expect(optimalArchetypesForPush('weapons', [...priorities])).toEqual(['grenadier']);
    expect(optimalArchetypesForPush('super', [...priorities])).toEqual(['gunner']);
    expect(optimalArchetypesForPush('grenade', [...priorities])).toEqual(['powerhouse']);
  });
});

describe('isBestTierLoadoutPiece', () => {
  it('accepts ideal single-priority rolls', () => {
    const item = piece({
      instanceId: 'a',
      archetype: 'gunner',
      tertiaryStat: 'weapons',
      tuningStat: 'weapons',
    });
    expect(isBestTierLoadoutPiece(item, ['weapons'])).toBe(true);
  });

  it('rejects aligned-only or archetype-only single-priority rolls', () => {
    const aligned = piece({
      instanceId: 'a',
      archetype: 'gunner',
      tertiaryStat: 'weapons',
      tuningStat: 'grenade',
    });
    const intrinsic = piece({
      instanceId: 'b',
      archetype: 'gunner',
      tertiaryStat: 'grenade',
    });
    expect(isBestTierLoadoutPiece(aligned, ['weapons'])).toBe(false);
    expect(isBestTierLoadoutPiece(intrinsic, ['weapons'])).toBe(false);
  });
});

describe('computeStatAchievability', () => {
  it('returns covered when all slots have tuned weapons pieces', () => {
    const items = ARMOR_SLOTS.map((slot, i) =>
      piece({
        instanceId: String(i),
        armorSlot: slot,
        archetype: 'gunner',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
      }),
    );
    const rows = computeStatAchievability(items, [{ stat: 'weapons', target: 200 }]);
    expect(rows[0].status).toBe('achievable');
    expect(rows[0].slotsAligned).toBe(5);
    expect(rows[0].slotGaps).toHaveLength(0);
  });

  it('returns close when vault has tuning but some slots only intrinsic', () => {
    const items = [
      ...ARMOR_SLOTS.slice(0, 4).map((slot, i) =>
        piece({
          instanceId: String(i),
          armorSlot: slot,
          archetype: 'paragon',
          tertiaryStat: 'weapons',
          tuningStat: 'super',
        }),
      ),
      piece({
        instanceId: '4',
        armorSlot: 'classItem',
        archetype: 'paragon',
        tertiaryStat: 'weapons',
      }),
    ];
    const rows = computeStatAchievability(items, [{ stat: 'super', target: 200 }]);
    expect(rows[0].status).toBe('close');
    expect(rows[0].slotsCovered).toBe(5);
    expect(rows[0].slotsAligned).toBe(4);
  });
});

describe('buildVerdictFromRows', () => {
  it('returns ready when every stat is covered with tuning', () => {
    const items = ARMOR_SLOTS.map((slot, i) =>
      piece({
        instanceId: String(i),
        armorSlot: slot,
        archetype: 'gunner',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
      }),
    );
    items.push(
      ...ARMOR_SLOTS.map((slot, i) =>
        piece({
          instanceId: `g-${i}`,
          armorSlot: slot,
          archetype: 'gunner',
          tertiaryStat: 'weapons',
          tuningStat: 'grenade',
        }),
      ),
    );
    const rows = computeStatAchievability(items, [
      { stat: 'weapons', target: 200 },
      { stat: 'grenade', target: 150 },
    ]);
    expect(buildVerdictFromRows(rows)).toBe('ready');
    expect(formatBuildVerdict('ready')).toBe('Ready');
  });

  it('returns almost when every stat is at least weak tuning', () => {
    const superPieces = [
      ...ARMOR_SLOTS.slice(0, 4).map((slot, i) =>
        piece({
          instanceId: String(i),
          armorSlot: slot,
          archetype: 'paragon',
          tertiaryStat: 'weapons',
          tuningStat: 'super',
        }),
      ),
      piece({
        instanceId: '4',
        armorSlot: 'classItem',
        archetype: 'paragon',
        tertiaryStat: 'weapons',
      }),
    ];
    const meleePieces = ARMOR_SLOTS.map((slot, i) =>
      piece({
        instanceId: `m-${i}`,
        armorSlot: slot,
        archetype: 'brawler',
        tertiaryStat: 'melee',
        tuningStat: 'melee',
      }),
    );
    const rows = computeStatAchievability([...superPieces, ...meleePieces], [
      { stat: 'super', target: 200 },
      { stat: 'melee', target: 150 },
    ]);
    expect(buildVerdictFromRows(rows)).toBe('almost');
  });

  it('returns need_rolls when any stat has a gap', () => {
    const items = [piece({ instanceId: 'a', armorSlot: 'chest' })];
    const rows = computeStatAchievability(items, [
      { stat: 'melee', target: 200 },
      { stat: 'super', target: 150 },
    ]);
    expect(buildVerdictFromRows(rows)).toBe('need_rolls');
  });
});
