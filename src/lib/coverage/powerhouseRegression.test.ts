import { describe, expect, it } from 'vitest';
import { buildPatternLoadoutGridData } from './patternLoadoutGrid';
import { computeOptimalRollShapes, computeViableRollShapes, isViableComboLoadoutPiece } from './achievability';
import {
  bestPiecesForPatternBySlot,
  deriveOptimalRollPatterns,
  pieceMatchesRollPattern,
} from './loadout';
import { parseSetBonusTargets } from './setBonus';
import type { ArmorPiece } from '@/types';

function piece(overrides: Partial<ArmorPiece> & { instanceId: string }): ArmorPiece {
  return {
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'arms',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'gunner',
    tertiaryStat: 'super',
    tuningStat: 'weapons',
    baseStats: { weapons: 35, grenade: 25, super: 20 },
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

const pantheos = { hash: 900, name: 'Pantheos Resplendent', perks: [] };
const techsec = { hash: 901, name: 'Techsec', perks: [] };
const priorities = ['weapons', 'super'] as const;

describe('weapons+super combo grid regression', () => {
  it('max-budget columns stay powerhouse-only', () => {
    const shapes = computeOptimalRollShapes([...priorities]);
    expect(shapes.some((s) => s.archetype === 'gunner')).toBe(false);
    expect(shapes.some((s) => s.archetype === 'powerhouse')).toBe(true);
  });

  it('viable shapes still include legacy split-push gunner rolls', () => {
    const shapes = computeViableRollShapes([...priorities]);
    expect(shapes.some((s) => s.archetype === 'gunner' && s.tertiaryStat === 'super')).toBe(true);
  });

  it('legacy gunner pantheos grasps match powerhouse weapons column in set grid', () => {
    const grasps = piece({
      instanceId: 'pantheos-grasps',
      name: 'Pantheos Resplendent Grasps',
      armorSet: pantheos,
    });
    expect(isViableComboLoadoutPiece(grasps, [...priorities])).toBe(true);

    const weaponsCol = deriveOptimalRollPatterns([...priorities]).find(
      (p) => p.tuningStat === 'weapons',
    )!;
    expect(pieceMatchesRollPattern(grasps, weaponsCol, [...priorities])).toBe(false);

    const slot = bestPiecesForPatternBySlot(
      [grasps],
      weaponsCol,
      [...priorities],
      [],
      undefined,
      pantheos.hash,
    ).find((e) => e.slot === 'arms');
    expect(slot?.piece?.instanceId).toBe('pantheos-grasps');
    expect(slot?.matchTier).toBe('perfect');
  });

  it('powerhouse techsec strides matches super column and near-matches weapons column', () => {
    const strides = piece({
      instanceId: 'techsec-strides',
      name: 'Techsec Strides',
      armorSlot: 'legs',
      armorSet: techsec,
      archetype: 'powerhouse',
      tertiaryStat: 'grenade',
      tuningStat: 'super',
      baseStats: { weapons: 35, super: 30, grenade: 20 },
    });
    const weaponsCol = deriveOptimalRollPatterns([...priorities]).find(
      (p) => p.tuningStat === 'weapons',
    )!;
    const superCol = deriveOptimalRollPatterns([...priorities]).find(
      (p) => p.tuningStat === 'super',
    )!;

    const weaponsSlot = bestPiecesForPatternBySlot(
      [strides],
      weaponsCol,
      [...priorities],
      [],
      undefined,
      techsec.hash,
    ).find((e) => e.slot === 'legs');
    expect(weaponsSlot?.matchTier).toBe('near');

    const superSlot = bestPiecesForPatternBySlot(
      [strides],
      superCol,
      [...priorities],
      [],
      undefined,
      techsec.hash,
    ).find((e) => e.slot === 'legs');
    expect(superSlot?.piece?.instanceId).toBe('techsec-strides');
    expect(superSlot?.matchTier).toBe('perfect');
  });

  it('mixed pantheos gunner + techsec powerhouse fill set-scoped grid slots', () => {
    const items = [
      piece({
        instanceId: 'pantheos-grasps',
        name: 'Pantheos Resplendent Grasps',
        armorSet: pantheos,
      }),
      piece({
        instanceId: 'pantheos-mask',
        name: 'Pantheos Resplendent Mask',
        armorSlot: 'helmet',
        armorSet: pantheos,
        tuningStat: 'super',
      }),
      piece({
        instanceId: 'techsec-strides',
        name: 'Techsec Strides',
        armorSlot: 'legs',
        armorSet: techsec,
        archetype: 'powerhouse',
        tertiaryStat: 'grenade',
        tuningStat: 'super',
        baseStats: { weapons: 35, super: 30, grenade: 20 },
      }),
    ];
    const setTargets = parseSetBonusTargets(pantheos.hash, techsec.hash);
    const grid = buildPatternLoadoutGridData(
      items,
      {
        id: 'ws-mix',
        label: 'Weapons Super',
        statTargets: [
          { stat: 'weapons', target: 0 },
          { stat: 'super', target: 0 },
        ],
        setBonus2pc: pantheos.hash,
        setBonus4pc: techsec.hash,
      },
      [...priorities],
      setTargets,
      {},
      new Map(),
    );

    const pantheosWeaponsCol = grid.recommendedPatternLoadout.columns.find(
      (col) => col.setHash === pantheos.hash && col.pattern.tuningStat === 'weapons',
    );
    expect(
      grid.columnRowsByKey[pantheosWeaponsCol!.columnKey]?.find(
        (row) => row.slotEntry.slot === 'arms',
      )?.displayPiece?.instanceId,
    ).toBe('pantheos-grasps');

    const pantheosSuperCol = grid.recommendedPatternLoadout.columns.find(
      (col) => col.setHash === pantheos.hash && col.pattern.tuningStat === 'super',
    );
    expect(
      grid.columnRowsByKey[pantheosSuperCol!.columnKey]?.find(
        (row) => row.slotEntry.slot === 'helmet',
      )?.displayPiece?.instanceId,
    ).toBe('pantheos-mask');
  });

  it('wrong archetype stays out of gunner flex column', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const prioritiesWg = ['weapons', 'grenade'] as const;
    const weaponsPattern = deriveOptimalRollPatterns([...prioritiesWg]).find(
      (pattern) => pattern.archetype === 'gunner' && pattern.tuningStat === 'weapons',
    )!;
    const wrongArchetype = piece({
      instanceId: 'smoke-grenadier-arms',
      armorSlot: 'arms',
      armorSet: smoke,
      archetype: 'grenadier',
      tertiaryStat: 'weapons',
      tuningStat: 'weapons',
      baseStats: { weapons: 30, grenade: 25, super: 10 },
    });
    const entry = bestPiecesForPatternBySlot(
      [wrongArchetype],
      weaponsPattern,
      [...prioritiesWg],
      parseSetBonusTargets(ferro.hash, smoke.hash),
      undefined,
      smoke.hash,
    ).find((e) => e.slot === 'arms');
    expect(entry?.piece).toBeNull();
    expect(entry?.matchTier).toBeNull();
  });
});
