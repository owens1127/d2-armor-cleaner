import { describe, expect, it } from 'vitest';
import { effectiveStats, MASTERWORK_STAT_BONUS } from './effectiveStats';
import type { ArmorPiece } from '@/types';

function piece(overrides: Partial<ArmorPiece>): ArmorPiece {
  return {
    instanceId: 'x',
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'gunner',
    baseStats: { weapons: 30, grenade: 25, super: 20 },
    tertiaryStat: 'super',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

describe('effectiveStats', () => {
  it('adds masterwork bonus on rolled stats only', () => {
    const eff = effectiveStats(piece({ isMasterwork: true }));
    expect(eff.weapons).toBe(30 + MASTERWORK_STAT_BONUS);
  });

  it('adds mod stat bonuses when modStatsAdditive', () => {
    const eff = effectiveStats(
      piece({
        modStats: { weapons: 10 },
        modStatsAdditive: true,
      }),
    );
    expect(eff.weapons).toBe(40);
  });

  it('reconstructs profile display total from intrinsic + mods (no double-count)', () => {
    const eff = effectiveStats(
      piece({
        modStats: { weapons: 8 },
        modStatsAdditive: true,
        baseStats: { weapons: 25, grenade: 23, super: 18 },
        isMasterwork: true,
      }),
    );
    expect(eff.weapons).toBe(35);
    expect(eff.grenade).toBe(25);
    expect(eff.super).toBe(20);
  });
});
