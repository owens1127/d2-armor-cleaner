import { describe, expect, it } from 'vitest';
import { ARMOR_SLOTS } from '@/lib/constants';
import type { ArmorPiece } from '@/types';
import {
  analyzeRecommendedLoadout,
  bestPiecesForPatternBySlot,
  deriveOptimalRollPatterns,
  isValidSlotRepresentative,
  loadoutVerdictFromLoadout,
  migrateRollPatternToSlotRepresentatives,
  orderEligiblePiecesForSlotPicker,
  pieceLoadoutContribution,
  rankEligiblePiecesForPatternInSlot,
  rankEligiblePiecesForSlot,
  resolveEffectiveRollPatternSlotRepresentatives,
  resolvePatternSlotLoadoutPiece,
  resolveSlotLoadoutPiece,
  selectRecommendedLoadout,
  selectRecommendedPatternLoadout,
} from './loadout';
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
    archetype: 'paragon',
    baseStats: { super: 30, melee: 25, grenade: 20 },
    tertiaryStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

/** Shared optimal roll for Weapons + Super combos (Powerhouse monument archetype). */
const weaponsSuperOptimalRoll = {
  archetype: 'powerhouse' as const,
  tertiaryStat: 'melee' as const,
  tuningStat: 'weapons' as const,
  baseStats: { weapons: 35, super: 30, melee: 20 },
};

const weaponsSuperTargets = [
  { stat: 'weapons' as const, target: 0 },
  { stat: 'super' as const, target: 0 },
];

function weaponsSuperPattern(tuningStat: 'weapons' | 'super') {
  return deriveOptimalRollPatterns(['weapons', 'super']).find(
    (pattern) => pattern.archetype === 'powerhouse' && pattern.tuningStat === tuningStat,
  )!;
}

describe('pieceLoadoutContribution', () => {
  it('prefers pieces that stack multiple priority stats (weapons + super)', () => {
    const gunnerShape = piece({
      instanceId: 'gunner',
      archetype: 'gunner',
      tertiaryStat: 'super',
      tuningStat: 'weapons',
      baseStats: { weapons: 30, grenade: 25, super: 20 },
    });
    const paragonShape = piece({
      instanceId: 'paragon',
      archetype: 'paragon',
      tertiaryStat: 'weapons',
      tuningStat: 'super',
      baseStats: { super: 30, melee: 25, weapons: 20 },
    });
    const grenadierShape = piece({
      instanceId: 'grenadier',
      archetype: 'grenadier',
      tertiaryStat: 'weapons',
      tuningStat: 'weapons',
      baseStats: { grenade: 25, super: 20, weapons: 3 },
    });
    expect(
      pieceLoadoutContribution(gunnerShape, ['weapons', 'super']),
    ).toBeGreaterThan(pieceLoadoutContribution(grenadierShape, ['weapons', 'super']));
    expect(
      pieceLoadoutContribution(paragonShape, ['weapons', 'super']),
    ).toBeGreaterThan(pieceLoadoutContribution(grenadierShape, ['weapons', 'super']));
  });
});

describe('rankEligiblePiecesForSlot', () => {
  it('returns only best-tier vault pieces ranked by loadout fit', () => {
    const items = [
      piece({
        instanceId: 'suboptimal',
        armorSlot: 'chest',
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
        baseStats: { super: 35, grenade: 20, weapons: 30 },
      }),
      piece({
        instanceId: 'powerhouse-shape',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
      }),
      piece({
        instanceId: 'powerhouse-alt',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
        tuningStat: 'super',
      }),
      piece({
        instanceId: 'wrong-slot',
        armorSlot: 'helmet',
        ...weaponsSuperOptimalRoll,
      }),
      piece({
        instanceId: 'no-fit',
        armorSlot: 'chest',
        archetype: 'bulwark',
        tertiaryStat: 'melee',
        baseStats: { health: 30, class: 25, melee: 20 },
      }),
    ];
    const ranked = rankEligiblePiecesForSlot(items, 'chest', ['weapons', 'super']);
    expect(ranked.map((r) => r.piece.instanceId)).toEqual(['powerhouse-shape', 'powerhouse-alt']);
    expect(ranked[0].fitLabel).toContain('Weapons');
  });
});

describe('selectRecommendedLoadout', () => {
  it('picks best-tier contributor per slot independently', () => {
    const items = [
      piece({
        instanceId: 'weak',
        armorSlot: 'chest',
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
        baseStats: { super: 20, grenade: 20 },
      }),
      piece({
        instanceId: 'strong',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
      }),
    ];
    const loadout = selectRecommendedLoadout(items, weaponsSuperTargets);
    const chest = loadout.slots.find((s) => s.slot === 'chest');
    expect(chest?.piece?.instanceId).toBe('strong');
  });

  it('leaves slot empty when only suboptimal pieces exist', () => {
    const items = [
      piece({
        instanceId: 'weak',
        armorSlot: 'chest',
        archetype: 'grenadier',
        tertiaryStat: 'weapons',
        tuningStat: 'weapons',
        baseStats: { super: 20, grenade: 20 },
      }),
    ];
    const loadout = selectRecommendedLoadout(items, weaponsSuperTargets);
    const chest = loadout.slots.find((s) => s.slot === 'chest');
    expect(chest?.piece).toBeNull();
  });

  it('returns five slot entries even when vault is sparse', () => {
    const items = [piece({ instanceId: 'a', armorSlot: 'helmet' })];
    const loadout = selectRecommendedLoadout(items, weaponsSuperTargets);
    expect(loadout.slots).toHaveLength(5);
    expect(loadout.slotsFilled).toBeLessThan(5);
  });

  it('mixes two 2pc set targets when vault has options', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const shared = weaponsSuperOptimalRoll;
    const items = ARMOR_SLOTS.flatMap((armorSlot) => [
      piece({
        instanceId: `ferro-${armorSlot}`,
        armorSlot,
        armorSet: ferro,
        ...shared,
        baseStats: { weapons: 35, grenade: 20, super: 30 },
      }),
      piece({
        instanceId: `smoke-${armorSlot}`,
        armorSlot,
        armorSet: smoke,
        ...shared,
        baseStats: { weapons: 34, grenade: 20, super: 30 },
      }),
    ]);
    const loadout = selectRecommendedLoadout(items, weaponsSuperTargets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    expect(loadout.slotsFilled).toBe(4);
    expect(loadout.pieces.filter((p) => p.armorSet?.hash === ferro.hash).length).toBe(2);
    expect(loadout.pieces.filter((p) => p.armorSet?.hash === smoke.hash).length).toBe(2);
  });

  it('does not place more than the 2pc quota from one set in the loadout', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const roll = weaponsSuperOptimalRoll;
    const items = ARMOR_SLOTS.flatMap((armorSlot) => [
      piece({
        instanceId: `smoke-a-${armorSlot}`,
        armorSlot,
        armorSet: smoke,
        ...roll,
      }),
      piece({
        instanceId: `smoke-b-${armorSlot}`,
        armorSlot,
        armorSet: smoke,
        ...roll,
        baseStats: { weapons: 39, grenade: 20, super: 30 },
      }),
      piece({
        instanceId: `ferro-${armorSlot}`,
        armorSlot,
        armorSet: ferro,
        ...roll,
        baseStats: { weapons: 35, grenade: 20, super: 30 },
      }),
    ]);
    const loadout = selectRecommendedLoadout(items, weaponsSuperTargets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    expect(loadout.pieces.filter((p) => p.armorSet?.hash === smoke.hash).length).toBeLessThanOrEqual(2);
    expect(loadout.pieces.filter((p) => p.armorSet?.hash === ferro.hash).length).toBeLessThanOrEqual(2);
  });
});

describe('resolveSlotLoadoutPiece', () => {
  const priorities = ['weapons', 'super'] as const;

  it('uses a valid saved representative instead of the auto pick', () => {
    const auto = piece({
      instanceId: 'auto',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
    });
    const alt = piece({
      instanceId: 'alt',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
      tuningStat: 'super',
    });
    const resolved = resolveSlotLoadoutPiece(
      [auto, alt],
      'chest',
      [...priorities],
      auto,
      'alt',
    );
    expect(resolved.piece?.instanceId).toBe('alt');
    expect(resolved.source).toBe('representative');
  });

  it('falls back to auto when representative is missing or ineligible', () => {
    const auto = piece({
      instanceId: 'auto',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
    });
    const wrongSlot = piece({
      instanceId: 'wrong-slot',
      armorSlot: 'helmet',
      ...weaponsSuperOptimalRoll,
    });
    expect(
      resolveSlotLoadoutPiece([auto, wrongSlot], 'chest', [...priorities], auto, 'wrong-slot')
        .piece?.instanceId,
    ).toBe('auto');
    expect(
      resolveSlotLoadoutPiece([auto], 'chest', [...priorities], auto, 'gone').source,
    ).toBe('auto');
  });
});

describe('isValidSlotRepresentative', () => {
  it('accepts best-tier pieces in the correct slot only', () => {
    const eligible = piece({
      instanceId: 'ok',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
    });
    const ineligible = piece({
      instanceId: 'bad',
      armorSlot: 'chest',
      archetype: 'bulwark',
      tertiaryStat: 'melee',
      baseStats: { health: 30, class: 25, melee: 20 },
    });
    expect(isValidSlotRepresentative([eligible], 'chest', 'ok', ['weapons', 'super'])).toBe(true);
    expect(isValidSlotRepresentative([eligible], 'helmet', 'ok', ['weapons', 'super'])).toBe(
      false,
    );
    expect(isValidSlotRepresentative([ineligible], 'chest', 'bad', ['weapons', 'super'])).toBe(
      false,
    );
  });
});

describe('loadoutVerdictFromLoadout', () => {
  it('returns ready when all five slots filled with best-tier pieces', () => {
    const items = ARMOR_SLOTS.map((slot, i) =>
      piece({
        instanceId: String(i),
        armorSlot: slot,
        ...weaponsSuperOptimalRoll,
        tuningStat: i % 2 === 0 ? 'weapons' : 'super',
      }),
    );
    const { loadout, loadoutVerdict } = analyzeRecommendedLoadout(items, weaponsSuperTargets);
    expect(loadoutVerdict.verdict).toBe('ready');
    expect(loadoutVerdict.slotsFilled).toBe(5);
    expect(loadoutVerdict.slotsTotal).toBe(5);
    expect(loadout.slotsFilled).toBe(5);
  });

  it('returns almost when some slots are filled', () => {
    const items = [
      piece({
        instanceId: 'a',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
      }),
    ];
    const loadout = selectRecommendedLoadout(items, weaponsSuperTargets);
    const verdict = loadoutVerdictFromLoadout(loadout);
    expect(verdict.verdict).toBe('almost');
    expect(verdict.slotsFilled).toBe(1);
  });

  it('returns need_rolls when vault has no fitting pieces', () => {
    const items = [
      piece({
        instanceId: 'a',
        archetype: 'bulwark',
        tertiaryStat: 'melee',
        baseStats: { health: 30, class: 25, melee: 20 },
      }),
    ];
    const { loadoutVerdict } = analyzeRecommendedLoadout(items, weaponsSuperTargets);
    expect(loadoutVerdict.verdict).toBe('need_rolls');
  });
});

describe('selectRecommendedPatternLoadout', () => {
  it('expands to pattern × set columns for a 2+2 set bonus combo', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const shared = weaponsSuperOptimalRoll;
    const items = ARMOR_SLOTS.flatMap((armorSlot) => [
      piece({
        instanceId: `ferro-${armorSlot}`,
        armorSlot,
        armorSet: ferro,
        ...shared,
      }),
      piece({
        instanceId: `smoke-${armorSlot}`,
        armorSlot,
        armorSet: smoke,
        ...shared,
        baseStats: { weapons: 34, super: 29, melee: 20 },
      }),
    ]);
    const loadout = selectRecommendedPatternLoadout(items, weaponsSuperTargets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: smoke.hash,
    });
    expect(loadout.columnsTotal).toBe(4);
    expect(loadout.columns.filter((column) => column.setHash === ferro.hash)).toHaveLength(2);
    expect(loadout.columns.filter((column) => column.setHash === smoke.hash)).toHaveLength(2);
    for (const column of loadout.columns) {
      expect(column.columnKey).toContain(String(column.setHash));
      const slotEntries = bestPiecesForPatternBySlot(
        items,
        column.pattern,
        ['weapons', 'super'],
        parseSetBonusTargets(ferro.hash, smoke.hash),
        undefined,
        column.setHash,
      );
      for (const entry of slotEntries) {
        if (entry.piece) {
          expect(entry.piece.armorSet?.hash).toBe(column.setHash);
        }
      }
    }
  });

  it('keeps two columns for a single 4pc set target', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const items = [
      piece({
        instanceId: 'ferro-chest',
        armorSlot: 'chest',
        armorSet: ferro,
        ...weaponsSuperOptimalRoll,
      }),
    ];
    const loadout = selectRecommendedPatternLoadout(items, weaponsSuperTargets, {
      setBonus2pc: ferro.hash,
      setBonus4pc: ferro.hash,
    });
    expect(loadout.columnsTotal).toBe(2);
    expect(loadout.columns.every((column) => column.setHash === ferro.hash)).toBe(true);
  });
});

describe('rankEligiblePiecesForPatternInSlot', () => {
  it('returns only eligible pieces for the given slot and pattern', () => {
    const pattern = weaponsSuperPattern('super');
    const items = [
      piece({
        instanceId: 'chest-w',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
        tuningStat: 'super',
      }),
      piece({
        instanceId: 'helm-w',
        armorSlot: 'helmet',
        ...weaponsSuperOptimalRoll,
        tuningStat: 'super',
      }),
      piece({
        instanceId: 'chest-s',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
      }),
    ];
    const ranked = rankEligiblePiecesForPatternInSlot(
      items,
      'chest',
      pattern,
      ['weapons', 'super'],
    );
    expect(ranked.map((r) => r.piece.instanceId)).toEqual(['chest-w']);
  });

  it('breaks ties by wantScore, tier, then set name', () => {
    const pattern = weaponsSuperPattern('super');
    const sharedStats = {
      armorSlot: 'chest' as const,
      ...weaponsSuperOptimalRoll,
      tuningStat: 'super' as const,
    };
    const items = [
      piece({
        instanceId: 'lower-want',
        ...sharedStats,
        wantScore: 0.2,
        tier: 5,
      }),
      piece({
        instanceId: 'higher-want',
        ...sharedStats,
        wantScore: 0.8,
        tier: 4,
      }),
      piece({
        instanceId: 'higher-tier',
        ...sharedStats,
        wantScore: 0.8,
        tier: 5,
        armorSet: { hash: 2, name: 'Zeta Set', perks: [] },
      }),
      piece({
        instanceId: 'alpha-set',
        ...sharedStats,
        wantScore: 0.8,
        tier: 5,
        armorSet: { hash: 1, name: 'Alpha Set', perks: [] },
      }),
    ];
    const ranked = rankEligiblePiecesForPatternInSlot(
      items,
      'chest',
      pattern,
      ['weapons', 'super'],
    );
    expect(ranked.map((r) => r.piece.instanceId)).toEqual([
      'alpha-set',
      'higher-tier',
      'higher-want',
      'lower-want',
    ]);
  });
});

describe('orderEligiblePiecesForSlotPicker', () => {
  it('sorts by instance id ascending regardless of algorithm rank', () => {
    const ranked = [
      { piece: piece({ instanceId: '300' }), contributionScore: 10, fitLabel: '' },
      { piece: piece({ instanceId: '20' }), contributionScore: 1, fitLabel: '' },
      { piece: piece({ instanceId: '100' }), contributionScore: 5, fitLabel: '' },
    ];
    expect(orderEligiblePiecesForSlotPicker(ranked).map((r) => r.piece.instanceId)).toEqual([
      '20',
      '100',
      '300',
    ]);
  });
});

describe('resolvePatternSlotLoadoutPiece', () => {
  const priorities = ['weapons', 'super'] as const;
  const pattern = weaponsSuperPattern('super');

  it('uses a valid saved representative for the slot', () => {
    const auto = piece({
      instanceId: 'auto',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
      tuningStat: 'super',
    });
    const alt = piece({
      instanceId: 'alt',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
      tuningStat: 'super',
      baseStats: { weapons: 30, super: 30, melee: 20 },
    });
    const resolved = resolvePatternSlotLoadoutPiece(
      [auto, alt],
      'chest',
      pattern,
      [...priorities],
      auto,
      'alt',
    );
    expect(resolved.piece?.instanceId).toBe('alt');
    expect(resolved.source).toBe('representative');
  });

  it('falls back to auto when representative is wrong slot or ineligible', () => {
    const auto = piece({
      instanceId: 'auto',
      armorSlot: 'chest',
      ...weaponsSuperOptimalRoll,
      tuningStat: 'super',
    });
    const wrongSlot = piece({
      instanceId: 'wrong-slot',
      armorSlot: 'helmet',
      ...weaponsSuperOptimalRoll,
      tuningStat: 'super',
    });
    expect(
      resolvePatternSlotLoadoutPiece(
        [auto, wrongSlot],
        'chest',
        pattern,
        [...priorities],
        auto,
        'wrong-slot',
      ).piece?.instanceId,
    ).toBe('auto');
  });
});

describe('migrateRollPatternToSlotRepresentatives', () => {
  it('maps legacy column picks to the piece armor slot', () => {
    const items = [
      piece({
        instanceId: 'chest-w',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
        tuningStat: 'super',
      }),
    ];
    expect(
      migrateRollPatternToSlotRepresentatives(items, ['weapons', 'super'], {
        'powerhouse:grenade:super': 'chest-w',
      }),
    ).toEqual({
      'powerhouse:grenade:super': { chest: 'chest-w' },
    });
  });
});

describe('resolveEffectiveRollPatternSlotRepresentatives', () => {
  it('prefers saved slot reps over migrated column picks', () => {
    const items = [
      piece({
        instanceId: 'saved',
        armorSlot: 'chest',
        ...weaponsSuperOptimalRoll,
        tuningStat: 'super',
      }),
      piece({
        instanceId: 'legacy',
        armorSlot: 'helmet',
        ...weaponsSuperOptimalRoll,
        tuningStat: 'super',
      }),
    ];
    expect(
      resolveEffectiveRollPatternSlotRepresentatives(
        items,
        ['weapons', 'super'],
        { 'powerhouse:grenade:super': { chest: 'saved' } },
        { 'powerhouse:grenade:super': 'legacy' },
      ),
    ).toEqual({ 'powerhouse:grenade:super': { chest: 'saved' } });
  });

  it('expands legacy pattern keys to per-set column keys when set targets configured', () => {
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const reps = resolveEffectiveRollPatternSlotRepresentatives(
      [],
      ['weapons', 'super'],
      { 'powerhouse:grenade:weapons': { helmet: 'saved-helm' } },
      undefined,
      undefined,
      undefined,
      parseSetBonusTargets(ferro.hash, smoke.hash),
    );
    expect(reps).toEqual({
      [`powerhouse:grenade:weapons:${ferro.hash}`]: { helmet: 'saved-helm' },
      [`powerhouse:grenade:weapons:${smoke.hash}`]: { helmet: 'saved-helm' },
    });
  });
});
