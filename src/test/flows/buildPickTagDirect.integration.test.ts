import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { optimalRollPatternKey, selectRecommendedPatternLoadout } from '@/lib/coverage/loadout';
import { normalizeDesiredBuilds } from '@/lib/coverage/builds';
import {
  defaultPreferenceProfile,
  getClassPrefs,
  updateClassPrefs,
} from '@/lib/prefs/profile';
import { filterDashboardItems } from '@/lib/dashboard/items';
import { loadReviewTags } from '@/lib/session/reviewTags';
import { weaponsSuperVault } from '@/test/armorFixtures';

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

describe('build loadout pick → direct keep tag in DIM', () => {
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
    useSessionStore.setState({ pendingTags: [], duelQueue: [] });
    useVaultStore.setState({ allItems: [], classStates: {} });
  });

  it('applies keep from build coverage flow directly without review queue', async () => {
    const vault = weaponsSuperVault();
    useVaultStore.setState({ allItems: vault });
    const targets = [
      { stat: 'weapons' as const, target: 200 },
      { stat: 'super' as const, target: 150 },
    ];
    const loadout = selectRecommendedPatternLoadout(vault, targets);
    const column = loadout.columns.find((c) => c.piece !== null);
    expect(column?.piece).toBeDefined();

    const picked = column!.piece!;
    await useSessionStore.getState().applyTagDirect([picked], 'keep');

    expect(loadReviewTags()).toEqual([]);
    expect(useVaultStore.getState().allItems.find((i) => i.instanceId === picked.instanceId)?.dimTag).toBe(
      'keep',
    );

    const profile = updateClassPrefs(defaultPreferenceProfile(), 'hunter', (classPrefs) => ({
      ...classPrefs,
      desiredBuilds: normalizeDesiredBuilds(
        [
          {
            id: 'ws',
            name: 'Weapons/Super',
            mode: 'priority',
            enabled: true,
            statTargets: targets,
            rollPatternSlotRepresentatives: {
              [column!.patternKey]: { [picked.armorSlot]: picked.instanceId },
            },
          },
        ],
        'hunter',
      ),
    }));
    expect(
      getClassPrefs(profile, 'hunter').desiredBuilds?.[0]?.rollPatternSlotRepresentatives?.[
        column!.patternKey
      ]?.[picked.armorSlot],
    ).toBe(picked.instanceId);

    await useSessionStore.getState().applyTagDirect([picked], null);
    expect(filterDashboardItems(vault, useSessionStore.getState().pendingTags, [])).toHaveLength(5);
  });

  it('direct favorite on one piece does not affect another tagged keep', async () => {
    const vault = weaponsSuperVault();
    useVaultStore.setState({ allItems: vault });
    const [a, b] = vault.slice(0, 2);
    await useSessionStore.getState().applyTagDirect([a], 'keep');
    await useSessionStore.getState().applyTagDirect([b], 'favorite');

    expect(loadReviewTags()).toEqual([]);
    expect(useVaultStore.getState().allItems.find((i) => i.instanceId === a.instanceId)?.dimTag).toBe(
      'keep',
    );
    expect(
      useVaultStore.getState().allItems.find((i) => i.instanceId === b.instanceId)?.dimFavorite,
    ).toBe(true);
    expect(
      optimalRollPatternKey({
        archetype: a.archetype,
        tertiaryStat: a.tertiaryStat,
        tuningStat: a.tuningStat ?? a.tertiaryStat,
      }),
    ).toContain(':');
  });
});
