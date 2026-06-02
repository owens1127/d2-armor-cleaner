import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterDashboardItems } from '@/lib/dashboard/items';
import { LS_REVIEW_TAGS } from '@/lib/storage/keys';
import { hydrateReviewTags, loadReviewTags } from '@/lib/session/reviewTags';
import { armorPiece } from '@/test/armorFixtures';
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

describe('review tag queue → persist → reload → apply', () => {
  let useSessionStore: typeof import('@/stores').useSessionStore;
  let useVaultStore: typeof import('@/stores').useVaultStore;
  let useAuthStore: typeof import('@/stores').useAuthStore;

  beforeAll(async () => {
    ({ useSessionStore, useVaultStore, useAuthStore } = await import('@/stores'));
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
      bucketEliminatedIds: [],
      bucketLossCounts: {},
      bucketKeptBothIds: [],
      bucketKeptSideIds: [],
      actedPairKeys: [],
    });
    useVaultStore.setState({ allItems: [], classStates: {} });
  });

  it('direct dashboard junk patches dimTag and hides item without review queue', async () => {
    const junkTarget = armorPiece({
      instanceId: 'junk-helm',
      name: 'Scrap Helm',
      classType: 'titan',
    });
    const keeper = armorPiece({
      instanceId: 'keep-helm',
      name: 'Keeper Helm',
      classType: 'titan',
    });
    const vault: ArmorPiece[] = [keeper, junkTarget];
    useVaultStore.setState({ allItems: vault });

    await useSessionStore.getState().applyTagDirect([junkTarget], 'junk');
    expect(loadReviewTags()).toEqual([]);
    expect(useVaultStore.getState().allItems.find((i) => i.instanceId === 'junk-helm')?.dimTag).toBe(
      'junk',
    );
    expect(
      filterDashboardItems(useVaultStore.getState().allItems, [], []).map((i) => i.instanceId),
    ).toEqual(['keep-helm']);
  });

  it('duel junk tag → reload hides item → clear restores visibility', () => {
    const junkTarget = armorPiece({
      instanceId: 'junk-helm',
      name: 'Scrap Helm',
      classType: 'titan',
    });
    const keeper = armorPiece({
      instanceId: 'keep-helm',
      name: 'Keeper Helm',
      classType: 'titan',
    });
    const vault: ArmorPiece[] = [keeper, junkTarget];

    useSessionStore.getState().recordPairJunk(junkTarget);
    expect(loadReviewTags()).toEqual([
      expect.objectContaining({ instanceId: 'junk-helm', tag: 'junk' }),
    ]);
    expect(useSessionStore.getState().pendingTags).toHaveLength(1);

    const afterReload = hydrateReviewTags();
    expect(
      filterDashboardItems(vault, afterReload, []).map((i) => i.instanceId),
    ).toEqual(['keep-helm']);

    useSessionStore.getState().clearPendingTags();
    expect(local.has(LS_REVIEW_TAGS)).toBe(false);
    expect(
      filterDashboardItems(vault, useSessionStore.getState().pendingTags, []).map(
        (i) => i.instanceId,
      ),
    ).toEqual(['keep-helm', 'junk-helm']);
  });

  it('queues multiple tags across duel without losing clean-session progress', () => {
    const a = armorPiece({ instanceId: 'a', name: 'Helm A', classType: 'hunter' });
    const b = armorPiece({ instanceId: 'b', name: 'Helm B', classType: 'hunter' });

    useSessionStore.setState({
      duelQueue: ['hunter|helmet|gunner|super|101|weapons'],
    });

    useSessionStore.getState().queueForReview([a], 'junk');
    useSessionStore.getState().recordPairJunk(b);

    expect(loadReviewTags()).toHaveLength(2);
    expect(useSessionStore.getState().duelQueue).toHaveLength(1);
    expect(useSessionStore.getState().bucketJunkedIds).toContain('b');

    useSessionStore.getState().clearPendingTags();
    expect(useSessionStore.getState().duelQueue).toHaveLength(1);
    expect(useSessionStore.getState().bucketJunkedIds).toContain('b');
  });
});
