import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoFilterRule } from '@/lib/auto-filter/match';
import { planBulkDimTagApply } from '@/lib/dim/bulkTagPlan';
import { filterDashboardItems } from '@/lib/dashboard/items';
import {
  applyLocalOverridesToArmorPieces,
  loadLocalDimTagOverrides,
  mergeDimTagMapWithLocalOverrides,
} from '@/lib/dim/localTagOverrides';
import { loadReviewTags } from '@/lib/session/reviewTags';
import { armorPiece, weaponsSuperVault } from '@/test/armorFixtures';
import type { ArmorPiece } from '@/types';

const applyDimTagsMock = vi.fn();

vi.mock('@/lib/dim/tags', () => ({
  applyDimTags: (...args: unknown[]) => applyDimTagsMock(...args),
  isDimConfigured: () => true,
}));

vi.mock('@/lib/dim/resolveToken', () => ({
  resolveDimToken: vi.fn(async () => 'mock-dim-token'),
}));

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

describe('tag apply paths: review queue vs direct DIM', () => {
  let useSessionStore: typeof import('@/stores').useSessionStore;
  let useVaultStore: typeof import('@/stores').useVaultStore;
  let useAuthStore: typeof import('@/stores').useAuthStore;
  let applyAutoFilterRules: typeof import('@/lib/auto-filter/apply').applyAutoFilterRules;

  beforeAll(async () => {
    ({ useSessionStore, useVaultStore, useAuthStore } = await import('@/stores'));
    ({ applyAutoFilterRules } = await import('@/lib/auto-filter/apply'));
  });

  beforeEach(() => {
    local.clear();
    applyDimTagsMock.mockReset();
    applyDimTagsMock.mockImplementation(async (_membershipId, _token, tags) => ({
      applied: tags.map((t: { instanceId: string }) => ({ instanceId: t.instanceId, ok: true })),
      allOk: true,
    }));
    useAuthStore.setState({
      membership: {
        bungieMembershipId: 'bungie-1',
        destinyMembershipId: 'destiny-1',
        membershipType: 3,
        displayName: 'Test',
      },
    });
    useSessionStore.setState({
      pendingTags: [],
      duelQueue: [],
      bucketJunkedIds: [],
    });
    useVaultStore.setState({ allItems: [], classStates: {} });
  });

  function seedVault(items: ArmorPiece[]) {
    useVaultStore.setState({ allItems: items });
  }

  it('duel recordPairJunk queues for review without calling DIM', async () => {
    const loser = armorPiece({ instanceId: 'duel-loser', name: 'Duel Loser' });
    useSessionStore.getState().recordPairJunk(loser);

    expect(loadReviewTags()).toEqual([
      expect.objectContaining({ instanceId: 'duel-loser', tag: 'junk' }),
    ]);
    expect(applyDimTagsMock).not.toHaveBeenCalled();
  });

  it('auto triage queues junk for review without calling DIM', async () => {
    const vault = weaponsSuperVault();
    const offBuild = armorPiece({
      instanceId: 'auto-junk',
      archetype: 'bulwark',
      tertiaryStat: 'melee',
      tuningStat: 'health',
      baseStats: { health: 30, class: 25, melee: 20 },
    });
    const items = [...vault, offBuild];
    seedVault(items);

    const rule = createAutoFilterRule({
      classType: 'hunter',
      archetype: 'bulwark',
      enabled: true,
    });
    const queued = applyAutoFilterRules(items, [rule]);

    expect(queued).toBe(1);
    expect(useSessionStore.getState().pendingTags).toEqual([
      expect.objectContaining({ instanceId: 'auto-junk', tag: 'junk' }),
    ]);
    expect(applyDimTagsMock).not.toHaveBeenCalled();
  });

  it('applyTagDirect writes to DIM and patches vault dimTag without review queue', async () => {
    const target = armorPiece({ instanceId: 'browse-keep', name: 'Browse Keep' });
    seedVault([target]);

    await useSessionStore.getState().applyTagDirect([target], 'keep');

    expect(applyDimTagsMock).toHaveBeenCalledWith(
      'destiny-1',
      'mock-dim-token',
      [{ instanceId: 'browse-keep', tag: 'keep' }],
    );
    expect(useSessionStore.getState().pendingTags).toEqual([]);
    expect(useVaultStore.getState().allItems[0]?.dimTag).toBe('keep');
    expect(filterDashboardItems([target], [], [])).toHaveLength(1);
  });

  it('applyTagDirect keep then junk replaces pending and dimTag shows junk only', async () => {
    const target = armorPiece({ instanceId: 'flip-tag', name: 'Flip' });
    seedVault([target]);
    useSessionStore.getState().queueForReview([target], 'keep');

    await useSessionStore.getState().applyTagDirect([target], 'keep');
    await useSessionStore.getState().applyTagDirect([target], 'junk');

    expect(useSessionStore.getState().pendingTags).toEqual([]);
    expect(useVaultStore.getState().allItems[0]?.dimTag).toBe('junk');
    expect(applyDimTagsMock).toHaveBeenLastCalledWith('destiny-1', 'mock-dim-token', [
      { instanceId: 'flip-tag', tag: 'junk' },
    ]);
  });

  it('queue keep then junk leaves single junk pending row', () => {
    const target = armorPiece({ instanceId: 'queue-flip', name: 'Queue Flip' });
    useSessionStore.getState().queueForReview([target], 'keep');
    useSessionStore.getState().queueForReview([target], 'junk');

    expect(useSessionStore.getState().pendingTags).toEqual([
      expect.objectContaining({ instanceId: 'queue-flip', tag: 'junk' }),
    ]);
    expect(useSessionStore.getState().pendingTags).toHaveLength(1);
  });

  it('bulk keep on mixed dimTags uses one DIM batch and does not clear already-kept pieces', async () => {
    const alreadyKeep = armorPiece({ instanceId: 'already-keep', name: 'Kept', dimTag: 'keep' });
    const needsKeep = armorPiece({ instanceId: 'needs-keep', name: 'Needs' });
    seedVault([alreadyKeep, needsKeep]);

    const plan = planBulkDimTagApply([alreadyKeep, needsKeep], 'keep');
    expect(plan?.tag).toBe('keep');
    expect(plan?.pieces.map((p) => p.instanceId)).toEqual(['needs-keep']);

    await useSessionStore.getState().applyTagDirect(plan!.pieces, plan!.tag);

    expect(applyDimTagsMock).toHaveBeenCalledTimes(1);
    expect(applyDimTagsMock).toHaveBeenCalledWith('destiny-1', 'mock-dim-token', [
      { instanceId: 'needs-keep', tag: 'keep' },
    ]);
    expect(useVaultStore.getState().allItems.find((i) => i.instanceId === 'already-keep')?.dimTag).toBe(
      'keep',
    );
    expect(useVaultStore.getState().allItems.find((i) => i.instanceId === 'needs-keep')?.dimTag).toBe(
      'keep',
    );
  });

  it('applyTagDirect falls back to local tag when DIM token resolution fails', async () => {
    const { resolveDimToken } = await import('@/lib/dim/resolveToken');
    vi.mocked(resolveDimToken).mockRejectedValueOnce(new Error('DIM sync unavailable'));
    const target = armorPiece({ instanceId: 'token-fail', name: 'Token Fail' });
    seedVault([target]);

    await useSessionStore.getState().applyTagDirect([target], 'keep');

    expect(applyDimTagsMock).not.toHaveBeenCalled();
    expect(useVaultStore.getState().allItems[0]?.dimTag).toBe('keep');
    expect(loadLocalDimTagOverrides('destiny-1')['token-fail']).toEqual(
      expect.objectContaining({ tag: 'keep' }),
    );
  });

  it('applyTagDirect falls back to local tag when DIM API fails', async () => {
    applyDimTagsMock.mockRejectedValueOnce(new Error('DIM API error: 500'));
    const target = armorPiece({ instanceId: 'dim-fail', name: 'DIM Fail' });
    seedVault([target]);

    await useSessionStore.getState().applyTagDirect([target], 'keep');

    expect(applyDimTagsMock).toHaveBeenCalled();
    expect(useVaultStore.getState().allItems[0]?.dimTag).toBe('keep');
    expect(loadLocalDimTagOverrides('destiny-1')['dim-fail']).toEqual(
      expect.objectContaining({ tag: 'keep' }),
    );
  });

  it('applyTagDirect falls back locally for DIM per-item failures', async () => {
    applyDimTagsMock.mockResolvedValueOnce({
      applied: [{ instanceId: 'partial-fail', ok: false, error: 'Rejected' }],
      allOk: false,
    });
    const target = armorPiece({ instanceId: 'partial-fail', name: 'Partial' });
    seedVault([target]);

    await useSessionStore.getState().applyTagDirect([target], 'junk');

    expect(useVaultStore.getState().allItems[0]?.dimTag).toBe('junk');
    expect(loadLocalDimTagOverrides('destiny-1')['partial-fail']).toEqual(
      expect.objectContaining({ tag: 'junk' }),
    );
  });

  it('applyTagDirect records local override so stale DIM reload keeps tag', async () => {
    const target = armorPiece({ instanceId: 'stale-dim', name: 'Stale DIM' });
    seedVault([target]);

    await useSessionStore.getState().applyTagDirect([target], 'keep');

    const overrides = loadLocalDimTagOverrides('destiny-1');
    expect(overrides['stale-dim']).toEqual(expect.objectContaining({ tag: 'keep' }));

    const staleDimFetch = { 'stale-dim': { dimTag: null, dimFavorite: false } };
    const merged = mergeDimTagMapWithLocalOverrides(staleDimFetch, overrides);
    const reloaded = applyLocalOverridesToArmorPieces(
      [armorPiece({ instanceId: 'stale-dim', dimTag: null })],
      overrides,
    );
    expect(merged['stale-dim']).toEqual({ dimTag: 'keep', dimFavorite: false });
    expect(reloaded[0]?.dimTag).toBe('keep');
  });

  it('direct junk hides item on dashboard via dimTag, not pendingTags', async () => {
    const keeper = armorPiece({ instanceId: 'keeper', name: 'Keeper' });
    const junkTarget = armorPiece({ instanceId: 'direct-junk', name: 'Direct Junk' });
    const vault = [keeper, junkTarget];
    seedVault(vault);

    await useSessionStore.getState().applyTagDirect([junkTarget], 'junk');

    expect(useSessionStore.getState().pendingTags).toEqual([]);
    expect(useVaultStore.getState().allItems.find((i) => i.instanceId === 'direct-junk')?.dimTag).toBe(
      'junk',
    );
    expect(filterDashboardItems(useVaultStore.getState().allItems, [], []).map((i) => i.instanceId)).toEqual([
      'keeper',
    ]);
  });
});
