import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeDesiredBuilds, formatSetBonusProgressLabel } from '@/lib/coverage/analyze';
import { createDesiredBuild, normalizeDesiredBuilds } from '@/lib/coverage/builds';
import { selectRecommendedLoadout, selectRecommendedPatternLoadout } from '@/lib/coverage/loadout';
import { groupIntoBuckets } from '@/lib/dupes/group';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { defaultClassPreferenceProfile, defaultPreferenceProfile, getClassPrefs, updateClassPrefs } from '@/lib/prefs/profile';
import { armorPiece, fullBrawlerVault, weaponsSuperVault } from '@/test/armorFixtures';
import { ARMOR_SLOTS } from '@/lib/constants';
import type { DesiredBuild } from '@/types';

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

function meleeBuild(overrides: Partial<DesiredBuild> = {}): DesiredBuild {
  return {
    id: 'melee',
    name: 'Melee stack',
    mode: 'priority',
    enabled: true,
    statTargets: [
      { stat: 'melee', target: 200 },
      { stat: 'super', target: 150 },
    ],
    ...overrides,
  };
}

describe('desired build edit → coverage refresh', () => {
  beforeEach(() => {
    local.clear();
  });

  it('transitions from no builds to gap coverage to build-ready as vault fills', () => {
    let prefs = defaultClassPreferenceProfile();
    const sparse = [armorPiece({ instanceId: '1', armorSlot: 'chest' })];
    let buckets = groupIntoBuckets(sparse, mergeDupeRules());

    let analyses = analyzeDesiredBuilds(sparse, buckets, prefs, 'hunter');
    expect(analyses).toHaveLength(0);

    prefs = {
      ...prefs,
      desiredBuilds: [meleeBuild()],
    };
    analyses = analyzeDesiredBuilds(sparse, buckets, prefs, 'hunter');
    expect(analyses[0]?.buildReady).toBe(false);
    expect(analyses[0]?.gaps.length).toBeGreaterThan(0);

    const fullVault = fullBrawlerVault();
    buckets = groupIntoBuckets(fullVault, mergeDupeRules());
    analyses = analyzeDesiredBuilds(fullVault, buckets, prefs, 'hunter');
    expect(analyses[0]?.buildReady).toBe(true);
  });

  it('updates loadout recommendations when stat priorities change', () => {
    const vault = weaponsSuperVault();
    const targets = [
      { stat: 'weapons' as const, target: 200 },
      { stat: 'super' as const, target: 150 },
    ];

    const loadout = selectRecommendedLoadout(vault, targets);
    expect(loadout.slots.filter((s) => s.piece).length).toBe(5);

    const wrongFitVault = [
      armorPiece({
        instanceId: 'bulwark-helm',
        armorSlot: 'helmet',
        archetype: 'bulwark',
        tertiaryStat: 'melee',
        baseStats: { health: 30, class: 25, melee: 20 },
      }),
    ];
    const wrongLoadout = selectRecommendedLoadout(wrongFitVault, targets);
    expect(wrongLoadout.slotsFilled).toBe(0);
  });

  it('persists representative picks through prefs normalize round-trip', () => {
    const build = createDesiredBuild(defaultClassPreferenceProfile(), 'hunter', 'Weapons/Super');
    build.statTargets = [
      { stat: 'weapons', target: 200 },
      { stat: 'super', target: 150 },
    ];
    const vault = weaponsSuperVault();
    const loadout = selectRecommendedLoadout(vault, build.statTargets);
    const chestPick = loadout.slots.find((s) => s.slot === 'chest')?.piece?.instanceId;
    expect(chestPick).toBeDefined();

    const profile = updateClassPrefs(defaultPreferenceProfile(), 'hunter', (classPrefs) => ({
      ...classPrefs,
      desiredBuilds: normalizeDesiredBuilds(
        [
          {
            ...build,
            slotRepresentatives: { chest: chestPick! },
          },
        ],
        'hunter',
      ),
    }));

    expect(getClassPrefs(profile, 'hunter').desiredBuilds?.[0]?.slotRepresentatives?.chest).toBe(
      chestPick,
    );
  });

  it('prefers a 2+2 set mix in loadout when combo targets two sets', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const shared = {
      classType: 'hunter' as const,
      archetype: 'powerhouse' as const,
      tertiaryStat: 'melee' as const,
      tuningStat: 'weapons' as const,
    };
    const vault = ARMOR_SLOTS.flatMap((armorSlot) => [
      armorPiece({
        instanceId: `ferro-${armorSlot}`,
        armorSlot,
        armorSet: ferro,
        ...shared,
        baseStats: { weapons: 35, super: 30, melee: 20 },
      }),
      armorPiece({
        instanceId: `smoke-${armorSlot}`,
        armorSlot,
        armorSet: smoke,
        ...shared,
        baseStats: { weapons: 34, super: 29, melee: 20 },
      }),
    ]);

    const targets = [
      { stat: 'weapons' as const, target: 200 },
      { stat: 'super' as const, target: 150 },
    ];
    const noSetLoadout = selectRecommendedLoadout(vault, targets);
    expect(noSetLoadout.pieces.every((p) => p.armorSet?.hash === ferro.hash)).toBe(true);

    const mixedLoadout = selectRecommendedLoadout(vault, targets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    expect(mixedLoadout.slotsFilled).toBe(4);
    expect(mixedLoadout.pieces.filter((p) => p.armorSet?.hash === ferro.hash).length).toBe(2);
    expect(mixedLoadout.pieces.filter((p) => p.armorSet?.hash === smoke.hash).length).toBe(2);

    const prefs = {
      ...defaultClassPreferenceProfile(),
      desiredBuilds: [
        meleeBuild({
          statTargets: targets,
          setBonus2pc: ferro.hash,
          setBonus4pc: smoke.hash,
        }),
      ],
    };
    const buckets = groupIntoBuckets(vault, mergeDupeRules());
    const analysis = analyzeDesiredBuilds(vault, buckets, prefs, 'hunter')[0]!;
    expect(analysis.setBonusReadiness.tiersMet).toBe(true);
    expect(analysis.setBonusReadiness.progress).toHaveLength(2);
    for (const entry of analysis.setBonusReadiness.progress) {
      expect(entry.name).not.toMatch(/^Set \d+$/);
      expect(formatSetBonusProgressLabel(entry)).toContain(entry.name);
    }
    expect(
      analysis.recommendedLoadout.pieces.filter((p) => p.armorSet?.hash === ferro.hash).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      analysis.recommendedLoadout.pieces.filter((p) => p.armorSet?.hash === smoke.hash).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('recommended pattern loadout expands to pattern × set columns for 2+2 mix', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const shared = {
      archetype: 'powerhouse' as const,
      tertiaryStat: 'melee' as const,
      tuningStat: 'weapons' as const,
    };
    const vault = ARMOR_SLOTS.flatMap((armorSlot) => [
      armorPiece({
        instanceId: `ferro-${armorSlot}`,
        armorSlot,
        armorSet: ferro,
        ...shared,
        baseStats: { weapons: 35, super: 30, melee: 20 },
      }),
      armorPiece({
        instanceId: `smoke-${armorSlot}`,
        armorSlot,
        armorSet: smoke,
        ...shared,
        baseStats: { weapons: 34, super: 29, melee: 20 },
      }),
    ]);
    const targets = [
      { stat: 'weapons' as const, target: 200 },
      { stat: 'super' as const, target: 150 },
    ];
    const patternLoadout = selectRecommendedPatternLoadout(vault, targets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    expect(patternLoadout.columnsTotal).toBe(4);
    expect(new Set(patternLoadout.columns.map((column) => column.columnKey)).size).toBe(4);
  });
});
