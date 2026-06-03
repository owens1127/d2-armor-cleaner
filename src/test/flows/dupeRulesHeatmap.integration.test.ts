import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dupeBucketCount } from '@/lib/dupes/group';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { buildClassVaultState } from '@/lib/dupes/suggest';
import {
  bucketsForHeatmapCell,
  mergeHeatmapCellItems,
  mergedHeatmapBucket,
} from '@/lib/heatmap/cell';
import { armorPiece, splitSetHelmVault } from '@/test/armorFixtures';
import type { ArmorPiece } from '@/types';

const { localStorageMock, local } = vi.hoisted(() => {
  const local = new Map<string, string>();
  return {
    local,
    localStorageMock: {
      getItem: (k: string) => local.get(k) ?? null,
      setItem: (k: string, v: string) => local.set(k, v),
      removeItem: (k: string) => local.delete(k),
      clear: () => local.clear(),
    },
  };
});

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
});

const cell = {
  archetype: 'gunner' as const,
  armorSlot: 'helmet' as const,
  tertiaryStat: 'super' as const,
};

function heatmapCellCount(items: ArmorPiece[], rules: ReturnType<typeof mergeDupeRules>) {
  const state = buildClassVaultState('hunter', items, rules);
  const cellBuckets = bucketsForHeatmapCell(
    state.buckets,
    cell.archetype,
    cell.armorSlot,
    cell.tertiaryStat,
  );
  return {
    itemCount: mergeHeatmapCellItems(cellBuckets, [], []).length,
    bucketCount: cellBuckets.length,
    mergedHasDupes: mergedHeatmapBucket(cellBuckets)?.hasDupes ?? false,
    dupeBuckets: dupeBucketCount(state.buckets),
  };
}

function seedVaultStore(items: ArmorPiece[], rules: ReturnType<typeof mergeDupeRules>) {
  useVaultStore.setState({
    allItems: items,
    classStates: {
      hunter: buildClassVaultState('hunter', items, rules),
    },
    globalDupeRules: rules,
    classRuleOverrides: {},
  });
}

let useVaultStore: typeof import('@/stores/vaultStore').useVaultStore;

describe('settings sameArmorSet toggle → heatmap counts', () => {
  beforeAll(async () => {
    ({ useVaultStore } = await import('@/stores/vaultStore'));
  });

  beforeEach(() => {
    local.clear();
  });

  it('merges heatmap cell items when sameArmorSet is off, splits buckets when on', () => {
    const items = splitSetHelmVault();
    const loose = heatmapCellCount(items, mergeDupeRules({ sameArmorSet: false }));
    const strict = heatmapCellCount(items, mergeDupeRules({ sameArmorSet: true }));

    expect(loose.itemCount).toBe(4);
    expect(loose.bucketCount).toBe(1);
    expect(loose.mergedHasDupes).toBe(true);

    expect(strict.itemCount).toBe(4);
    expect(strict.bucketCount).toBeGreaterThan(1);
    expect(strict.mergedHasDupes).toBe(true);
    expect(strict.dupeBuckets).toBeGreaterThanOrEqual(loose.dupeBuckets);
  });

  it('recomputes dashboard buckets after toggling sameArmorSet in the vault store', () => {
    const items = splitSetHelmVault();
    seedVaultStore(items, mergeDupeRules({ sameArmorSet: false }));

    const before = useVaultStore.getState().classStates.hunter!;
    const looseDupes = dupeBucketCount(before.buckets);

    useVaultStore.getState().setGlobalDupeRules({ sameArmorSet: true });

    const after = useVaultStore.getState().classStates.hunter!;
    expect(useVaultStore.getState().globalDupeRules.sameArmorSet).toBe(true);
    expect(dupeBucketCount(after.buckets)).toBeGreaterThanOrEqual(looseDupes);
    expect(after.buckets.length).toBeGreaterThan(before.buckets.length);
  });

  it('does not snap strictness when grouping rules change via checkboxes', () => {
    const items = splitSetHelmVault();
    seedVaultStore(items, mergeDupeRules({ sameArmorSet: false }));
    useVaultStore.setState({ strictness: 12 });

    useVaultStore.getState().setGlobalDupeRules({ sameArmorSet: true });

    expect(useVaultStore.getState().strictness).toBe(12);
  });

  it('excludes junk-tagged pieces from heatmap after duel junk + session tags', async () => {
    const { useSessionStore } = await import('@/stores');
    const items = splitSetHelmVault();
    seedVaultStore(items, mergeDupeRules({ sameArmorSet: false }));

    useSessionStore.setState({
      pendingTags: [],
      bucketJunkedIds: [],
      duelQueue: [],
      bucketEliminatedIds: [],
      bucketLossCounts: {},
      bucketKeptBothIds: [],
      bucketKeptSideIds: [],
      actedPairKeys: [],
    });

    const loser = items.find((i) => i.instanceId === 'helm-b1')!;
    useSessionStore.getState().recordPairJunk(loser);

    const state = useVaultStore.getState().classStates.hunter!;
    const cellBuckets = bucketsForHeatmapCell(
      state.buckets,
      cell.archetype,
      cell.armorSlot,
      cell.tertiaryStat,
    );
    const visible = mergeHeatmapCellItems(
      cellBuckets,
      useSessionStore.getState().pendingTags,
      useSessionStore.getState().bucketJunkedIds,
    );

    expect(visible).toHaveLength(3);
    expect(visible.map((i) => i.instanceId)).not.toContain('helm-b1');
  });

  it('changes heatmap counts when sameTuningStat splits buckets', () => {
    const items = [
      armorPiece({ instanceId: 'a', tuningStat: 'weapons' }),
      armorPiece({ instanceId: 'b', tuningStat: 'grenade' }),
    ];
    const mixed = heatmapCellCount(items, mergeDupeRules({ sameTuningStat: false }));
    const split = heatmapCellCount(items, mergeDupeRules({ sameTuningStat: true }));

    expect(mixed.itemCount).toBe(2);
    expect(mixed.bucketCount).toBe(1);
    expect(split.itemCount).toBe(2);
    expect(split.bucketCount).toBe(2);
  });
});
