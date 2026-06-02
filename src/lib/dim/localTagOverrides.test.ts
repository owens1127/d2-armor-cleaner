import { describe, expect, it } from 'vitest';
import {
  applyLocalOverridesToArmorPieces,
  dimStateMatchesTag,
  mergeDimTagMapWithLocalOverrides,
  pruneSyncedLocalOverrides,
} from '@/lib/dim/localTagOverrides';
import type { DimItemTagState } from '@/lib/dim/parseTags';
import { armorPiece } from '@/test/armorFixtures';
import type { TagValue } from '@/types';

describe('local DIM tag overrides', () => {
  it('mergeDimTagMapWithLocalOverrides prefers local over stale DIM', () => {
    const dimTags: Record<string, DimItemTagState> = {
      'item-1': { dimTag: null, dimFavorite: false },
      'item-2': { dimTag: 'junk', dimFavorite: false },
    };
    const overrides: Record<string, { tag: TagValue; changedAt: number }> = {
      'item-1': { tag: 'keep', changedAt: 100 },
      'item-2': { tag: 'keep', changedAt: 200 },
    };
    const merged = mergeDimTagMapWithLocalOverrides(dimTags, overrides);
    expect(merged['item-1']).toEqual({ dimTag: 'keep', dimFavorite: false });
    expect(merged['item-2']).toEqual({ dimTag: 'keep', dimFavorite: false });
  });

  it('pruneSyncedLocalOverrides removes rows when DIM matches override', () => {
    const dimTags: Record<string, DimItemTagState> = {
      synced: { dimTag: 'keep', dimFavorite: false },
      stale: { dimTag: null, dimFavorite: false },
    };
    const overrides: Record<string, { tag: TagValue; changedAt: number }> = {
      synced: { tag: 'keep', changedAt: 1 },
      stale: { tag: 'keep', changedAt: 2 },
    };
    expect(pruneSyncedLocalOverrides(dimTags, overrides)).toEqual({
      stale: overrides.stale,
    });
  });

  it('applyLocalOverridesToArmorPieces patches item dimTag fields', () => {
    const items = [
      armorPiece({ instanceId: 'a', dimTag: null }),
      armorPiece({ instanceId: 'b', dimTag: 'junk' }),
    ];
    const next = applyLocalOverridesToArmorPieces(items, {
      a: { tag: 'keep', changedAt: 1 },
      b: { tag: null, changedAt: 2 },
    });
    expect(next[0]?.dimTag).toBe('keep');
    expect(next[1]?.dimTag).toBeNull();
    expect(next[1]?.dimFavorite).toBe(false);
  });

  it('dimStateMatchesTag treats favorite overlay consistently', () => {
    expect(dimStateMatchesTag({ dimTag: null, dimFavorite: true }, 'favorite')).toBe(true);
    expect(dimStateMatchesTag({ dimTag: 'keep', dimFavorite: false }, 'keep')).toBe(true);
    expect(dimStateMatchesTag({ dimTag: null, dimFavorite: false }, 'keep')).toBe(false);
  });
});
