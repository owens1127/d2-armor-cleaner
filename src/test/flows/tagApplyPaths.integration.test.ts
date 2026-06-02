import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoFilterRule } from '@/lib/auto-filter/match';
import { filterDashboardItems } from '@/lib/dashboard/items';
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
