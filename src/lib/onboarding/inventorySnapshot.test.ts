import { describe, expect, it } from 'vitest';
import type { ArmorPiece } from '@/types';
import {
  buildVaultInventorySnapshot,
  estimateVaultTrim,
  vaultHeavyThreshold,
} from '@/lib/onboarding/inventorySnapshot';

function t5Piece(classType: ArmorPiece['classType'], id: string): ArmorPiece {
  return {
    instanceId: id,
    itemHash: 1,
    name: 'Test',
    classType,
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'paragon',
    baseStats: { super: 30, melee: 25, grenade: 20 },
    tertiaryStat: 'weapons',
    isMasterwork: false,
  };
}

describe('vault keep targets', () => {
  it('vaultHeavyThreshold uses total keep goal, not legacy tiny counts', () => {
    expect(vaultHeavyThreshold('balanced').totalT5).toBe(900);
    expect(vaultHeavyThreshold('lean').totalT5).toBe(540);
  });
});

describe('estimateVaultTrim', () => {
  it('reports no excess for typical vaults under balanced goal', () => {
    const snapshot = {
      totalT5: 232,
      byClass: { titan: 80, hunter: 82, warlock: 70 },
      byClassSlot: {} as never,
      gaps: [],
    };
    const trim = estimateVaultTrim(snapshot, 'balanced');
    expect(trim.totalTarget).toBe(600);
    expect(trim.excess).toBe(0);
    expect(trim.byClass.hunter.excess).toBe(0);
  });

  it('reports excess only above scaled keep goal', () => {
    const snapshot = {
      totalT5: 700,
      byClass: { titan: 250, hunter: 240, warlock: 210 },
      byClassSlot: {} as never,
      gaps: [],
    };
    const trim = estimateVaultTrim(snapshot, 'balanced');
    expect(trim.excess).toBe(100);
    expect(trim.byClass.titan.excess).toBe(50);
  });
});

describe('buildVaultInventorySnapshot', () => {
  it('counts tier 5 pieces for trim', () => {
    const items = [
      ...Array.from({ length: 90 }, (_, i) => t5Piece('hunter', `h-${i}`)),
      ...Array.from({ length: 85 }, (_, i) => t5Piece('titan', `t-${i}`)),
    ];
    const snapshot = buildVaultInventorySnapshot(items);
    const trim = estimateVaultTrim(snapshot, 'lean');
    expect(snapshot.totalT5).toBe(175);
    expect(trim.totalTarget).toBe(360);
    expect(trim.excess).toBe(0);
  });
});
