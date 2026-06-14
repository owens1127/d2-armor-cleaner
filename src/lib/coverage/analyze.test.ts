import { describe, expect, it } from 'vitest';
import { ARMOR_SLOTS } from '@/lib/constants';
import type { ArmorPiece } from '@/types';
import {
  analyzeBuildBalance,
  analyzeCoverage,
  analyzeDesiredBuilds,
  buildReadinessForSlot,
  computeSetBonusReadiness,
  countSetSlotsWithPieces,
  findBuildOverlapClusters,
  findCoverageGaps,
  findOverlapClusters,
  formatSetBonusProgressLabel,
} from './analyze';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import { groupIntoBuckets } from '@/lib/dupes/group';
import { mergeDupeRules } from '@/lib/dupes/rules';

function piece(overrides: Partial<ArmorPiece> & { instanceId: string }): ArmorPiece {
  return {
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'chest',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'paragon',
    baseStats: { super: 30, melee: 25, grenade: 20 },
    tertiaryStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

const meleeSuperTargets = [
  { stat: 'melee' as const, target: 200 },
  { stat: 'super' as const, target: 150 },
];

const meleeSuperOptimalRoll = {
  archetype: 'paragon' as const,
  tertiaryStat: 'weapons' as const,
  tuningStat: 'melee' as const,
  baseStats: { super: 30, melee: 25, weapons: 20 },
};

describe('buildReadinessForSlot', () => {
  it('picks best-tier piece per slot', () => {
    const items = [
      piece({
        instanceId: 'weak',
        armorSlot: 'chest',
        archetype: 'grenadier',
        tertiaryStat: 'melee',
        tuningStat: 'melee',
        baseStats: { super: 20, grenade: 20 },
      }),
      piece({
        instanceId: 'strong',
        armorSlot: 'chest',
        ...meleeSuperOptimalRoll,
      }),
      piece({
        instanceId: 'other-slot',
        armorSlot: 'legs',
        ...meleeSuperOptimalRoll,
      }),
    ];
    const result = buildReadinessForSlot(items, 'chest', meleeSuperTargets);
    expect(result.covered).toBe(true);
    expect(result.bestPiece?.instanceId).toBe('strong');
  });

  it('marks slot uncovered when no piece supports the build', () => {
    const items = [
      piece({
        instanceId: 'a',
        archetype: 'gunner',
        tertiaryStat: 'weapons',
        armorSlot: 'helmet',
      }),
    ];
    const result = buildReadinessForSlot(items, 'helmet', meleeSuperTargets);
    expect(result.covered).toBe(false);
    expect(result.bestPiece).toBeNull();
  });
});

describe('findCoverageGaps', () => {
  it('lists empty build-relevant profiles', () => {
    const rules = mergeDupeRules();
    const items = [
      piece({ instanceId: 'a', armorSlot: 'chest', archetype: 'bulwark', tertiaryStat: 'melee' }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const gaps = findCoverageGaps(buckets, ['melee', 'super']);
    const labels = gaps.map((g) => g.label);
    expect(labels.some((l) => l.includes('Bulwark') && l.includes('Melee'))).toBe(false);
    expect(labels.some((l) => l.includes('Paragon'))).toBe(true);
  });
});

describe('findOverlapClusters', () => {
  it('flags buckets with many pieces in the same profile', () => {
    const rules = mergeDupeRules();
    const items = [
      piece({ instanceId: '1', armorSlot: 'legs', archetype: 'gunner', tertiaryStat: 'grenade' }),
      piece({ instanceId: '2', armorSlot: 'legs', archetype: 'gunner', tertiaryStat: 'grenade' }),
      piece({ instanceId: '3', armorSlot: 'legs', archetype: 'gunner', tertiaryStat: 'grenade' }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const overlaps = findOverlapClusters(buckets, 3);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].count).toBe(3);
    expect(overlaps[0].label).toContain('Gunner');
  });
});

describe('analyzeCoverage', () => {
  it('reports slot coverage for a melee/super build with optimal rolls', () => {
    const rules = mergeDupeRules();
    const items = ARMOR_SLOTS.map((slot, i) =>
      piece({
        instanceId: String(i),
        armorSlot: slot,
        ...meleeSuperOptimalRoll,
      }),
    );
    const buckets = groupIntoBuckets(items, rules);
    const analysis = analyzeCoverage(items, buckets, {
      id: 'melee-build',
      label: 'Melee + Super',
      statTargets: meleeSuperTargets,
    });
    expect(analysis.slotsCovered).toBe(5);
    expect(analysis.loadoutComplete).toBe(true);
    expect(analysis.buildReady).toBe(true);
    expect(analysis.filledProfiles).toBe(5);
  });

  it('marks loadout incomplete when slots are missing', () => {
    const rules = mergeDupeRules();
    const items = [
      piece({
        instanceId: '1',
        armorSlot: 'chest',
        ...meleeSuperOptimalRoll,
      }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const analysis = analyzeCoverage(items, buckets, {
      id: 'melee-build',
      label: 'Melee + Super',
      statTargets: meleeSuperTargets,
    });
    expect(analysis.slotsCovered).toBe(1);
    expect(analysis.loadoutComplete).toBe(false);
    expect(analysis.buildReady).toBe(false);
  });
});

describe('analyzeDesiredBuilds', () => {
  it('returns empty when no desired builds configured', () => {
    const prefs = defaultClassPreferenceProfile();
    const analyses = analyzeDesiredBuilds([], [], prefs, 'hunter');
    expect(analyses).toEqual([]);
  });

  it('analyzes each enabled desired build', () => {
    const prefs = defaultClassPreferenceProfile();
    prefs.desiredBuilds = [
      {
        id: 'a',
        name: 'Melee',
        mode: 'priority',
        statTargets: [
          { stat: 'melee', target: 200 },
          { stat: 'super', target: 150 },
        ],
      },
      {
        id: 'b',
        name: 'Grenade',
        mode: 'priority',
        statTargets: [
          { stat: 'grenade', target: 200 },
          { stat: 'super', target: 150 },
        ],
      },
    ];
    const rules = mergeDupeRules();
    const items = [
      piece({ instanceId: '1', archetype: 'paragon', tertiaryStat: 'weapons', armorSlot: 'chest' }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const analyses = analyzeDesiredBuilds(items, buckets, prefs, 'hunter');
    expect(analyses).toHaveLength(2);
    expect(analyses[0].build.label).toBe('Melee');
  });
});

describe('findBuildOverlapClusters', () => {
  it('only includes buckets whose identity supports the build', () => {
    const rules = mergeDupeRules();
    const items = [
      piece({ instanceId: '1', armorSlot: 'legs', archetype: 'gunner', tertiaryStat: 'grenade' }),
      piece({ instanceId: '2', armorSlot: 'legs', archetype: 'gunner', tertiaryStat: 'grenade' }),
      piece({ instanceId: '3', armorSlot: 'legs', archetype: 'gunner', tertiaryStat: 'grenade' }),
      piece({ instanceId: '4', armorSlot: 'chest', archetype: 'paragon', tertiaryStat: 'weapons' }),
      piece({ instanceId: '5', armorSlot: 'chest', archetype: 'paragon', tertiaryStat: 'weapons' }),
      piece({ instanceId: '6', armorSlot: 'chest', archetype: 'paragon', tertiaryStat: 'weapons' }),
    ];
    const buckets = groupIntoBuckets(items, rules);
    const meleeOverlaps = findBuildOverlapClusters(buckets, ['melee', 'super'], 3);
    expect(meleeOverlaps).toHaveLength(1);
    expect(meleeOverlaps[0].label).toContain('Paragon');
  });
});

describe('set bonus readiness', () => {
  it('counts slots with at least one matching set piece', () => {
    const items = [
      piece({
        instanceId: '1',
        armorSlot: 'helmet',
        armorSet: { hash: 99, name: 'Ferropotent', perks: [] },
      }),
      piece({
        instanceId: '2',
        armorSlot: 'chest',
        armorSet: { hash: 99, name: 'Ferropotent', perks: [] },
      }),
      piece({
        instanceId: '3',
        armorSlot: 'legs',
        armorSet: { hash: 99, name: 'Ferropotent', perks: [] },
      }),
    ];
    expect(countSetSlotsWithPieces(items, 99)).toBe(3);
  });

  it('tracks 4pc set progress separately from stat buildReady', () => {
    const items = ARMOR_SLOTS.map((armorSlot, i) =>
      piece({
        instanceId: String(i),
        armorSlot,
        archetype: 'paragon',
        tertiaryStat: 'weapons',
        baseStats: { melee: 40, super: 30 },
        armorSet: { hash: 42, name: 'Ferropotent', perks: [] },
      }),
    );
    const rules = mergeDupeRules();
    const buckets = groupIntoBuckets(items, rules);
    const analysis = analyzeCoverage(items, buckets, {
      id: 'ferro',
      label: 'Ferro melee',
      statTargets: meleeSuperTargets,
      setBonus4pc: 42,
    });
    expect(analysis.setBonusReadiness.progress).toHaveLength(1);
    expect(analysis.setBonusReadiness.progress[0].slotsFilled).toBe(4);
    expect(analysis.setBonusReadiness.progress[0].met).toBe(true);
    expect(analysis.statAchievability).toHaveLength(2);
    expect(formatSetBonusProgressLabel(analysis.setBonusReadiness.progress[0])).toBe(
      '4/4 pieces for 4pc Ferropotent',
    );
  });

  it('marks buildReady false when 4pc set short', () => {
    const items = ARMOR_SLOTS.slice(0, 3).map((armorSlot, i) =>
      piece({
        instanceId: String(i),
        armorSlot,
        armorSet: { hash: 42, name: 'Ferropotent', perks: [] },
        baseStats: { melee: 40, super: 30 },
      }),
    );
    const readiness = computeSetBonusReadiness(items, { setBonus4pc: 42 });
    expect(readiness.tiersMet).toBe(false);
    expect(readiness.progress[0].slotsFilled).toBe(3);
  });

  it('treats different first and second sets as a 2+2 mix', () => {
    const readiness = computeSetBonusReadiness(
      [],
      { setBonus2pc: 1, setBonus4pc: 2 },
    );
    expect(readiness.conflictingSets).toBe(false);
    expect(readiness.progress).toHaveLength(2);
    expect(readiness.progress.every((p) => p.tier === 2)).toBe(true);
    expect(readiness.progress[0].required).toBe(2);
    expect(readiness.progress[1].required).toBe(2);
  });

  it('shows only 4pc row when 2pc and 4pc share the same set', () => {
    const readiness = computeSetBonusReadiness([], { setBonus2pc: 5, setBonus4pc: 5 });
    expect(readiness.progress).toHaveLength(1);
    expect(readiness.progress[0].tier).toBe(4);
  });

  it('resolves set names from vault when absent from loadout progress items', () => {
    const smoke = { hash: 2751989785, name: 'Smoke Jumper Set', perks: [] };
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const vault = [
      piece({
        instanceId: 'smoke-cloak',
        armorSlot: 'classItem',
        armorSet: smoke,
        baseStats: { weapons: 30, super: 25 },
      }),
      piece({
        instanceId: 'ferro-helm',
        armorSlot: 'helmet',
        armorSet: ferro,
        baseStats: { weapons: 35, super: 30 },
      }),
    ];
    const loadoutPieces = vault.filter((p) => p.instanceId === 'ferro-helm');
    const readiness = computeSetBonusReadiness(
      loadoutPieces,
      { setBonus2pc: ferro.hash, setBonus4pc: smoke.hash },
      'loadout-pieces',
      vault,
      vault,
    );
    const smokeProgress = readiness.progress.find((p) => p.hash === smoke.hash);
    expect(smokeProgress?.name).toBe('Smoke Jumper Set');
    expect(formatSetBonusProgressLabel(smokeProgress!)).toBe(
      '0/2 pieces for 2pc Smoke Jumper Set',
    );
    expect(readiness.vaultProgress.find((p) => p.hash === smoke.hash)?.slotsFilled).toBe(1);
    expect(readiness.vaultTiersMet).toBe(false);
  });
});

describe('statAchievability', () => {
  it('populates per-stat status on coverage analysis', () => {
    const items = ARMOR_SLOTS.map((slot, i) =>
      piece({
        instanceId: String(i),
        armorSlot: slot,
        baseStats: { melee: 40, super: 30 },
      }),
    );
    const buckets = groupIntoBuckets(items, mergeDupeRules());
    const analysis = analyzeCoverage(items, buckets, {
      id: 'x',
      label: 'Test',
      statTargets: meleeSuperTargets,
    });
    expect(analysis.statAchievability).toHaveLength(2);
    expect(analysis.statAchievability[0].stat).toBe('melee');
    expect(['achievable', 'close', 'not']).toContain(analysis.statAchievability[0].status);
  });
});

describe('analyzeBuildBalance', () => {
  it('flags overlap risk and coverage gaps', () => {
    const rules = mergeDupeRules();
    const items = Array.from({ length: 10 }, (_, i) =>
      piece({
        instanceId: String(i),
        armorSlot: 'chest',
        archetype: 'paragon',
        tertiaryStat: 'weapons',
      }),
    );
    const buckets = groupIntoBuckets(items, rules);
    const analysis = analyzeCoverage(items, buckets, {
      id: 'melee-build',
      label: 'Melee + Super',
      statTargets: meleeSuperTargets,
    });
    const balance = analyzeBuildBalance([analysis]);
    expect(balance[0].overlapRisk).toBe(true);
    expect(balance[0].supportingPieces).toBeGreaterThanOrEqual(8);
  });
});
