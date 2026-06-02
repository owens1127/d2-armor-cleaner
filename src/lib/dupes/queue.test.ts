import { describe, expect, it } from 'vitest';
import type { ArmorPiece, DupeBucket } from '@/types';
import {
  bucketKeyString,
  compareDupeBucketKeys,
  inferInProgressBucketKey,
  rebuildDuelQueueKeys,
  sortBucketsForPicker,
} from '@/lib/dupes/queue';

const hunterKey: DupeBucket['key'] = {
  classType: 'hunter',
  armorSlot: 'helmet',
  archetype: 'gunner',
  tertiaryStat: 'grenade',
};

const titanKey: DupeBucket['key'] = {
  classType: 'hunter',
  armorSlot: 'chest',
  archetype: 'gunner',
  tertiaryStat: 'grenade',
};

function bucket(key: DupeBucket['key'], ids: string[]): DupeBucket {
  const items = ids.map(
    (id) =>
      ({
        instanceId: id,
        name: id,
        classType: key.classType,
        isIgnored: false,
      }) as ArmorPiece,
  );
  return { key, items, hasDupes: items.length >= 2 };
}

describe('compareDupeBucketKeys', () => {
  it('orders by armor slot then archetype then tertiary', () => {
    expect(compareDupeBucketKeys(hunterKey, titanKey)).toBeLessThan(0);
    const armsKey: DupeBucket['key'] = { ...hunterKey, armorSlot: 'arms' };
    expect(compareDupeBucketKeys(hunterKey, armsKey)).toBeLessThan(0);
    const brawlerKey: DupeBucket['key'] = { ...hunterKey, archetype: 'brawler' };
    expect(compareDupeBucketKeys(hunterKey, brawlerKey)).toBeLessThan(0);
    const meleeKey: DupeBucket['key'] = { ...hunterKey, tertiaryStat: 'melee' };
    expect(compareDupeBucketKeys(hunterKey, meleeKey)).toBeLessThan(0);
  });
});

describe('sortBucketsForPicker', () => {
  it('sorts buckets by slot archetype tertiary regardless of queue order', () => {
    const buckets = [
      bucket(titanKey, ['c', 'd']),
      bucket(hunterKey, ['a', 'b']),
      bucket({ ...hunterKey, armorSlot: 'arms' }, ['e', 'f']),
    ];
    const sorted = sortBucketsForPicker(buckets);
    expect(sorted.map((b) => b.key.armorSlot)).toEqual(['helmet', 'arms', 'chest']);
  });
});

describe('inferInProgressBucketKey', () => {
  it('finds the bucket containing junk progress ids', () => {
    const buckets = [bucket(hunterKey, ['a', 'b']), bucket(titanKey, ['c', 'd'])];
    expect(inferInProgressBucketKey(buckets, ['b'], [])).toBe(bucketKeyString(hunterKey));
  });
});

describe('rebuildDuelQueueKeys', () => {
  it('preserves in-progress bucket at queue head when duelQueue was lost', () => {
    const buckets = [bucket(hunterKey, ['a', 'b', 'c']), bucket(titanKey, ['d', 'e'])];
    const queue = rebuildDuelQueueKeys(
      'hunter',
      buckets,
      [],
      [],
      ['b'],
      [],
    );
    expect(queue[0]).toBe(bucketKeyString(hunterKey));
    expect(queue).toContain(bucketKeyString(titanKey));
  });

  it('keeps existing queue head when still valid', () => {
    const buckets = [bucket(hunterKey, ['a', 'b']), bucket(titanKey, ['c', 'd'])];
    const head = bucketKeyString(titanKey);
    const queue = rebuildDuelQueueKeys(
      'hunter',
      buckets,
      [],
      [head],
      ['c'],
      [],
    );
    expect(queue[0]).toBe(head);
  });

  it('preserves manual queue order when there is no in-bucket progress', () => {
    const buckets = [bucket(hunterKey, ['a', 'b']), bucket(titanKey, ['c', 'd'])];
    const hunterStr = bucketKeyString(hunterKey);
    const titanStr = bucketKeyString(titanKey);
    const queue = rebuildDuelQueueKeys('hunter', buckets, [], [titanStr, hunterStr], [], []);
    expect(queue[0]).toBe(titanStr);
    expect(queue[1]).toBe(hunterStr);
  });
});
