import { describe, expect, it } from 'vitest';
import { bucketKeyForItem, groupIntoBuckets } from './group';
import { mergeDupeRules } from './rules';
import type { ArmorPiece } from '@/types';

function piece(overrides: Partial<ArmorPiece> & { instanceId: string }): ArmorPiece {
  return {
    itemHash: 1,
    name: 'Test Helm',
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'gunner',
    baseStats: { weapons: 30, grenade: 25, super: 20 },
    tertiaryStat: 'super',
    tuningStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

describe('bucketKeyForItem', () => {
  it('groups matching archetype + tertiary into the same key', () => {
    const rules = mergeDupeRules();
    const a = piece({ instanceId: 'a' });
    const b = piece({ instanceId: 'b' });
    expect(bucketKeyForItem(a, rules)).toBe(bucketKeyForItem(b, rules));
  });

  it('splits buckets when tertiary differs', () => {
    const rules = mergeDupeRules();
    const a = piece({ instanceId: 'a', tertiaryStat: 'super' });
    const b = piece({ instanceId: 'b', tertiaryStat: 'melee' });
    expect(bucketKeyForItem(a, rules)).not.toBe(bucketKeyForItem(b, rules));
  });
});

describe('groupIntoBuckets', () => {
  it('creates a dupe bucket with two matching pieces', () => {
    const rules = mergeDupeRules();
    const items = [
      piece({ instanceId: 'a' }),
      piece({ instanceId: 'b' }),
      piece({ instanceId: 'c', archetype: 'brawler', tertiaryStat: 'health' }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const dupeBuckets = buckets.filter((b) => b.items.length >= 2);
    expect(dupeBuckets).toHaveLength(1);
    expect(dupeBuckets[0].items).toHaveLength(2);
  });

  it('excludes items below minTier from dupe grouping', () => {
    const rules = mergeDupeRules({ minTier: 5 });
    const items = [
      piece({ instanceId: 'a', tier: 5 }),
      piece({ instanceId: 'b', tier: 5 }),
      piece({ instanceId: 'c', tier: 4 }),
      piece({ instanceId: 'd', tier: 4 }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const dupeBuckets = buckets.filter((b) => b.hasDupes);
    expect(dupeBuckets).toHaveLength(1);
    expect(dupeBuckets[0].items.map((i) => i.instanceId)).toEqual(['a', 'b']);
  });

  it('includes tier 1-4 pieces when minTier is lowered', () => {
    const rules = mergeDupeRules({ minTier: 2 });
    const items = [
      piece({ instanceId: 'a', tier: 2 }),
      piece({ instanceId: 'b', tier: 2 }),
      piece({ instanceId: 'c', tier: 1 }),
      piece({ instanceId: 'd', tier: 1 }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const dupeBuckets = buckets.filter((b) => b.hasDupes);
    expect(dupeBuckets).toHaveLength(1);
    expect(dupeBuckets[0].items.map((i) => i.instanceId)).toEqual(['a', 'b']);
  });

  it('groups all tiered armor when minTier is 1', () => {
    const rules = mergeDupeRules({ minTier: 1 });
    const items = [
      piece({ instanceId: 'a', tier: 1 }),
      piece({ instanceId: 'b', tier: 1 }),
      piece({ instanceId: 'c', tier: 3, tertiaryStat: 'melee' }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const dupeBuckets = buckets.filter((b) => b.hasDupes);
    expect(dupeBuckets).toHaveLength(1);
    expect(dupeBuckets[0].items.map((i) => i.instanceId)).toEqual(['a', 'b']);
  });
});
