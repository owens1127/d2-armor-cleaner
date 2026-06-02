import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoFilterRule, findAutoFilterMatches } from '@/lib/auto-filter/match';
import { buildFitTotal } from '@/lib/coverage/analyze';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import { armorPiece, weaponsSuperVault } from '@/test/armorFixtures';

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

const emptyExclusions = {
  bucketJunkedIds: [] as string[],
  bucketKeptBothIds: [] as string[],
  bucketKeptSideIds: [] as string[],
  pendingTags: [],
};

describe('auto-filter junk → browse build-fit subset', () => {
  let useSessionStore: typeof import('@/stores').useSessionStore;
  let applyAutoFilterRules: typeof import('@/lib/auto-filter/apply').applyAutoFilterRules;

  beforeAll(async () => {
    ({ useSessionStore } = await import('@/stores'));
    ({ applyAutoFilterRules } = await import('@/lib/auto-filter/apply'));
  });

  beforeEach(() => {
    local.clear();
    useSessionStore.setState({ pendingTags: [], bucketJunkedIds: [] });
  });

  it('queues junk for off-build rolls then browse shows only build-fit pieces', () => {
    const vault = weaponsSuperVault();
    const offBuild = armorPiece({
      instanceId: 'off-build',
      archetype: 'bulwark',
      tertiaryStat: 'melee',
      tuningStat: 'health',
      baseStats: { health: 30, class: 25, melee: 20 },
    });
    const items = [...vault, offBuild];
    const targets = [
      { stat: 'weapons' as const, target: 200 },
      { stat: 'super' as const, target: 150 },
    ];

    const junkRule = createAutoFilterRule({
      classType: 'hunter',
      archetype: 'bulwark',
      enabled: true,
    });
    const matches = findAutoFilterMatches(items, [junkRule], emptyExclusions);
    expect(matches.map((i) => i.instanceId)).toEqual(['off-build']);

    const queued = applyAutoFilterRules(items, [junkRule]);
    expect(queued).toBe(1);
    expect(useSessionStore.getState().pendingTags).toEqual([
      expect.objectContaining({ instanceId: 'off-build', tag: 'junk' }),
    ]);

    const junkIds = new Set(
      useSessionStore.getState().pendingTags.filter((t) => t.tag === 'junk').map((t) => t.instanceId),
    );
    const browseFit = items.filter(
      (item) => !junkIds.has(item.instanceId) && buildFitTotal(item, targets) > 0,
    );

    expect(browseFit).toHaveLength(5);
    expect(browseFit.map((i) => i.instanceId)).toEqual(vault.map((i) => i.instanceId));

    const prefs = defaultClassPreferenceProfile();
    prefs.desiredBuilds = [
      {
        id: 'ws',
        name: 'Weapons/Super',
        mode: 'priority',
        enabled: true,
        statTargets: targets,
      },
    ];
    expect(prefs.desiredBuilds).toHaveLength(1);
  });
});
