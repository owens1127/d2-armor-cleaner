import { describe, expect, it } from 'vitest';
import type { ArmorPiece } from '@/types';
import {
  bestPiecesForPatternBySlot,
  columnSlotContextFromColumn,
  countEligibleBuildBadgesByInstance,
  deriveOptimalRollPatterns,
  globalGoldBadgePlacementKeys,
  isColumnSlotEligiblePiece,
  isBestSetPieceInSlotForCombo,
  isTopGoldColumnPiece,
  optimalRollPatternKey,
  patternSetColumnKey,
  resolveEffectiveRollPatternSlotRepresentatives,
  resolvePatternSlotLoadoutPiece,
  selectRecommendedLoadout,
  selectRecommendedPatternLoadout,
} from './loadout';
import {
  buildPatternLoadoutGridData,
  countUniqueSetPiecesInPatternGrid,
} from './patternLoadoutGrid';
import { parseSetBonusTargets } from './setBonus';

function piece(overrides: Partial<ArmorPiece> & { instanceId: string }): ArmorPiece {
  return {
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'chest',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'grenadier',
    baseStats: { weapons: 30, grenade: 25, super: 10 },
    tertiaryStat: 'weapons',
    tuningStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
const priorities = ['weapons', 'grenade'] as const;
const targets = [
  { stat: 'weapons' as const, target: 0 },
  { stat: 'grenade' as const, target: 0 },
];
const setTargets = parseSetBonusTargets(ferro.hash, smoke.hash);

describe('combo grid integration', () => {
  const weaponsPattern = deriveOptimalRollPatterns([...priorities]).find(
    (p) =>
      p.archetype === 'grenadier' &&
      p.tertiaryStat === 'weapons' &&
      p.tuningStat === 'weapons',
  )!;
  const grenadePattern = deriveOptimalRollPatterns([...priorities]).find(
    (p) =>
      p.archetype === 'grenadier' &&
      p.tertiaryStat === 'weapons' &&
      p.tuningStat === 'grenade',
  )!;

  it('weapons vs grenade columns pick different pieces per slot', () => {
    const items = [
      piece({
        instanceId: 'ferro-legs-weapons',
        armorSlot: 'legs',
        armorSet: ferro,
        tuningStat: 'weapons',
        baseStats: { weapons: 35, grenade: 20, super: 10 },
      }),
      piece({
        instanceId: 'ferro-legs-grenade',
        armorSlot: 'legs',
        armorSet: ferro,
        tuningStat: 'grenade',
        baseStats: { weapons: 28, grenade: 35, super: 10 },
      }),
    ];
    const weaponsLegs = bestPiecesForPatternBySlot(
      items,
      weaponsPattern,
      [...priorities],
      setTargets,
      undefined,
      ferro.hash,
    ).find((e) => e.slot === 'legs')?.piece?.instanceId;
    const grenadeLegs = bestPiecesForPatternBySlot(
      items,
      grenadePattern,
      [...priorities],
      setTargets,
      undefined,
      ferro.hash,
    ).find((e) => e.slot === 'legs')?.piece?.instanceId;
    expect(weaponsLegs).toBe('ferro-legs-weapons');
    expect(grenadeLegs).toBe('ferro-legs-grenade');
  });

  it('same instance never appears in both tuning columns', () => {
    const items = [
      piece({ instanceId: 'ferro-legs-weapons', armorSlot: 'legs', armorSet: ferro, tuningStat: 'weapons' }),
      piece({ instanceId: 'ferro-legs-grenade', armorSlot: 'legs', armorSet: ferro, tuningStat: 'grenade' }),
      piece({ instanceId: 'ferro-cloak-weapons', armorSlot: 'classItem', armorSet: ferro, tuningStat: 'weapons' }),
      piece({ instanceId: 'ferro-cloak-grenade', armorSlot: 'classItem', armorSet: ferro, tuningStat: 'grenade' }),
    ];
    const loadout = selectRecommendedPatternLoadout(items, targets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    const ferroCols = loadout.columns.filter((c) => c.setHash === ferro.hash);
    for (const col of ferroCols) {
      for (const entry of bestPiecesForPatternBySlot(
        items,
        col.pattern,
        [...priorities],
        setTargets,
        undefined,
        ferro.hash,
      )) {
        if (!entry.piece) continue;
        for (const other of ferroCols) {
          if (other.columnKey === col.columnKey) continue;
          const otherEntry = bestPiecesForPatternBySlot(
            items,
            other.pattern,
            [...priorities],
            setTargets,
            undefined,
            ferro.hash,
          ).find((e) => e.slot === entry.slot);
          if (
            otherEntry?.piece &&
            other.pattern.tuningStat !== col.pattern.tuningStat &&
            otherEntry.piece.instanceId === entry.piece.instanceId
          ) {
            throw new Error(`Duplicate instance across tuning columns`);
          }
        }
      }
    }
    expect(ferroCols.length).toBeGreaterThan(0);
  });

  it('set-enabled single candidate gets red exclusive badge', () => {
    const items = [
      piece({
        instanceId: 'ferro-helm',
        armorSlot: 'helmet',
        armorSet: ferro,
        archetype: 'gunner',
        tertiaryStat: 'super',
        tuningStat: 'weapons',
        baseStats: { weapons: 35, grenade: 20, super: 30 },
      }),
    ];
    const pattern = deriveOptimalRollPatterns(['weapons', 'super']).find(
      (p) => p.archetype === 'gunner' && p.tuningStat === 'weapons',
    )!;
    const ctx = columnSlotContextFromColumn(pattern, ['weapons', 'super'], ferro.hash, ferro.name, setTargets);
    expect(isColumnSlotEligiblePiece(items[0]!, ctx)).toBe(true);
    const placements = globalGoldBadgePlacementKeys(
      items,
      [{ columnKey: `weapons:${ferro.hash}`, pattern, setHash: ferro.hash, setName: ferro.name }],
      ['weapons', 'super'],
      setTargets,
    );
    expect(placements.has(`weapons:${ferro.hash}|helmet`)).toBe(true);
  });

  it('user rep override wins over auto best in set column', () => {
    const chestBest = piece({
      instanceId: 'ferro-chest-grenade-best',
      armorSlot: 'chest',
      armorSet: ferro,
      tuningStat: 'grenade',
      baseStats: { weapons: 28, grenade: 38, super: 10 },
    });
    const chestWeaker = piece({
      instanceId: 'ferro-chest-grenade-weaker',
      armorSlot: 'chest',
      armorSet: ferro,
      tuningStat: 'grenade',
      baseStats: { weapons: 25, grenade: 32, super: 10 },
    });
    const items = [chestBest, chestWeaker];
    const patternKey = optimalRollPatternKey(grenadePattern);
    const columnKey = patternSetColumnKey(patternKey, ferro.hash);
    const autoChest = bestPiecesForPatternBySlot(
      items,
      grenadePattern,
      [...priorities],
      setTargets,
      undefined,
      ferro.hash,
    ).find((entry) => entry.slot === 'chest')?.piece;
    const reps = resolveEffectiveRollPatternSlotRepresentatives(
      items,
      [...priorities],
      { [columnKey]: { chest: 'ferro-chest-grenade-weaker' } },
      undefined,
      undefined,
      undefined,
      setTargets,
    );
    const resolved = resolvePatternSlotLoadoutPiece(
      items,
      'chest',
      grenadePattern,
      [...priorities],
      autoChest ?? null,
      reps[columnKey]?.chest,
      ferro.hash,
    );
    expect(resolved.piece?.instanceId).toBe('ferro-chest-grenade-weaker');
    expect(resolved.source).toBe('representative');
  });

  it('red exclusive badge only on rank-1 set piece in slot', () => {
    const chestBest = piece({
      instanceId: 'ferro-chest-grenade-best',
      armorSlot: 'chest',
      armorSet: ferro,
      tuningStat: 'grenade',
      baseStats: { weapons: 28, grenade: 38, super: 10 },
    });
    const chestWeaker = piece({
      instanceId: 'ferro-chest-grenade-weaker',
      armorSlot: 'chest',
      armorSet: ferro,
      tuningStat: 'grenade',
      baseStats: { weapons: 25, grenade: 32, super: 10 },
    });
    const items = [chestBest, chestWeaker];
    const ctx = columnSlotContextFromColumn(grenadePattern, [...priorities], ferro.hash, ferro.name, setTargets);
    expect(isTopGoldColumnPiece(chestBest, ctx, items)).toBe(true);
    expect(isTopGoldColumnPiece(chestWeaker, ctx, items)).toBe(false);
    expect(
      isBestSetPieceInSlotForCombo(
        chestWeaker,
        ferro.hash,
        [...priorities],
        items,
        setTargets,
        grenadePattern,
        ferro.name,
      ),
    ).toBe(false);
  });

  it('counts badge eligibility across multiple builds', () => {
    const sharedPiece = piece({
      instanceId: 'shared-weapons',
      armorSlot: 'chest',
      archetype: 'gunner',
      tertiaryStat: 'super',
      tuningStat: 'weapons',
      baseStats: { weapons: 38, grenade: 20, super: 30 },
    });
    const counts = countEligibleBuildBadgesByInstance(
      [sharedPiece],
      [
        { statTargets: [{ stat: 'weapons', target: 0 }, { stat: 'super', target: 0 }] },
        { statTargets: [{ stat: 'weapons', target: 0 }, { stat: 'super', target: 0 }] },
      ],
    );
    expect(counts.get('shared-weapons')).toBe(2);
  });

  it('2+2 mix shows both Ferropotent pieces in set-scoped grid columns', () => {
    const items = [
      piece({
        instanceId: 'ferro-cloak-weapons',
        armorSlot: 'classItem',
        armorSet: ferro,
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
        baseStats: { weapons: 35, grenade: 30, super: 10 },
      }),
      piece({
        instanceId: 'ferro-chest-grenade',
        armorSlot: 'chest',
        armorSet: ferro,
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'grenade',
        baseStats: { weapons: 28, grenade: 38, super: 10 },
      }),
    ];
    const build = {
      id: 'test-ferro-smoke',
      label: 'Ferro + Smoke',
      statTargets: [
        { stat: 'weapons' as const, target: 0 },
        { stat: 'grenade' as const, target: 0 },
      ],
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    };
    const grid = buildPatternLoadoutGridData(items, build, [...priorities], setTargets, {}, new Map());
    const ferroDisplayIds = new Set<string>();
    for (const column of grid.recommendedPatternLoadout.columns.filter((col) => col.setHash === ferro.hash)) {
      for (const row of grid.columnRowsByKey[column.columnKey] ?? []) {
        if (row.displayPiece) ferroDisplayIds.add(row.displayPiece.instanceId);
      }
    }
    expect(ferroDisplayIds).toContain('ferro-cloak-weapons');
    expect(ferroDisplayIds).toContain('ferro-chest-grenade');
  });

  it('pattern grid set progress counts unique displayed pieces', () => {
    const items = [
      piece({
        instanceId: 'ferro-cloak-weapons',
        armorSlot: 'classItem',
        armorSet: ferro,
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
        baseStats: { weapons: 35, grenade: 30, super: 10 },
      }),
      piece({
        instanceId: 'ferro-chest-grenade',
        armorSlot: 'chest',
        armorSet: ferro,
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'grenade',
        baseStats: { weapons: 28, grenade: 38, super: 10 },
      }),
    ];
    const build = {
      id: 'test-ferro-smoke-progress',
      label: 'Ferro + Smoke progress',
      statTargets: [
        { stat: 'weapons' as const, target: 0 },
        { stat: 'grenade' as const, target: 0 },
      ],
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    };
    const grid = buildPatternLoadoutGridData(items, build, [...priorities], setTargets, {}, new Map());
    expect(
      countUniqueSetPiecesInPatternGrid(
        grid.recommendedPatternLoadout.columns,
        grid.columnRowsByKey,
        ferro.hash,
      ),
    ).toBe(2);
    const loadout = selectRecommendedLoadout(items, build.statTargets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    expect(loadout.pieces.filter((p) => p.armorSet?.hash === ferro.hash).length).toBeGreaterThanOrEqual(2);
  });

  it('near match shown dimmed when tuning wrong but rest matches', () => {
    const nearCloak = piece({
      instanceId: 'smoke-cloak-near',
      name: 'Smoke Jumper Cloak',
      armorSlot: 'classItem',
      armorSet: smoke,
      archetype: 'gunner',
      tertiaryStat: 'super',
      tuningStat: 'weapons',
      baseStats: { grenade: 25, super: 20, weapons: 30 },
    });
    const gunnerSuperSuper = deriveOptimalRollPatterns(['weapons', 'super']).find(
      (p) =>
        p.archetype === 'gunner' &&
        p.tertiaryStat === 'super' &&
        p.tuningStat === 'super',
    )!;
    const grid = buildPatternLoadoutGridData(
      [nearCloak],
      {
        id: 'near-match-test',
        label: 'Near match',
        statTargets: [
          { stat: 'weapons', target: 0 },
          { stat: 'super', target: 0 },
        ],
        setBonus2pc: ferro.hash,
        setBonus4pc: smoke.hash,
      },
      ['weapons', 'super'],
      setTargets,
      {},
      new Map(),
    );
    const smokeColumn = grid.recommendedPatternLoadout.columns.find(
      (col) =>
        col.setHash === smoke.hash &&
        optimalRollPatternKey(col.pattern) === optimalRollPatternKey(gunnerSuperSuper),
    );
    expect(smokeColumn).toBeDefined();
    const classRow = grid.columnRowsByKey[smokeColumn!.columnKey]?.find(
      (row) => row.slotEntry.slot === 'classItem',
    );
    expect(classRow?.displayPiece?.instanceId).toBe('smoke-cloak-near');
    expect(classRow?.matchTier).toBe('near');
    expect(classRow?.showComboBadge).toBe(false);
    expect(classRow?.nearMatchTitle).toContain('Wrong tuning');
  });

  it('perfect match takes precedence over near match in same slot', () => {
    const perfectCloak = piece({
      instanceId: 'smoke-cloak-perfect',
      armorSlot: 'classItem',
      armorSet: smoke,
      archetype: 'gunner',
      tertiaryStat: 'super',
      tuningStat: 'super',
      baseStats: { grenade: 25, super: 30, weapons: 25 },
    });
    const nearCloak = piece({
      instanceId: 'smoke-cloak-near',
      armorSlot: 'classItem',
      armorSet: smoke,
      archetype: 'gunner',
      tertiaryStat: 'super',
      tuningStat: 'weapons',
      baseStats: { grenade: 25, super: 20, weapons: 30 },
    });
    const gunnerSuperSuper = deriveOptimalRollPatterns(['weapons', 'super']).find(
      (p) =>
        p.archetype === 'gunner' &&
        p.tertiaryStat === 'super' &&
        p.tuningStat === 'super',
    )!;
    const entry = bestPiecesForPatternBySlot(
      [perfectCloak, nearCloak],
      gunnerSuperSuper,
      ['weapons', 'super'],
      setTargets,
      undefined,
      smoke.hash,
    ).find((e) => e.slot === 'classItem');
    expect(entry?.piece?.instanceId).toBe('smoke-cloak-perfect');
    expect(entry?.matchTier).toBe('perfect');
  });

  it('wrong archetype stays empty not dimmed near match', () => {
    const wrongArchetype = piece({
      instanceId: 'smoke-gunner-arms',
      armorSlot: 'arms',
      armorSet: smoke,
      archetype: 'gunner',
      tertiaryStat: 'class',
      tuningStat: 'weapons',
      baseStats: { class: 20, grenade: 25, weapons: 30 },
    });
    const entry = bestPiecesForPatternBySlot(
      [wrongArchetype],
      weaponsPattern,
      [...priorities],
      setTargets,
      undefined,
      smoke.hash,
    ).find((e) => e.slot === 'arms');
    expect(entry?.piece).toBeNull();
    expect(entry?.matchTier).toBeNull();
  });
});
