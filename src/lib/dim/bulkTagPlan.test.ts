import { describe, expect, it } from 'vitest';
import { planBulkDimTagApply } from '@/lib/dim/bulkTagPlan';
import type { ArmorPiece } from '@/types';

function piece(instanceId: string, dimTag?: ArmorPiece['dimTag']): ArmorPiece {
  return {
    instanceId,
    name: instanceId,
    armorSlot: 'helmet',
    archetype: 'bulwark',
    tertiaryStat: 'health',
    tuningStat: 'health',
    baseStats: { health: 20, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 },
    isIgnored: false,
    dimTag,
  } as ArmorPiece;
}

describe('planBulkDimTagApply', () => {
  it('marks only pieces missing the target tag', () => {
    const a = piece('a');
    const b = piece('b', 'keep');
    const plan = planBulkDimTagApply([a, b], 'keep');
    expect(plan).toEqual({ tag: 'keep', pieces: [a] });
  });

  it('clears all when every piece already has the tag', () => {
    const a = piece('a', 'junk');
    const b = piece('b', 'junk');
    const plan = planBulkDimTagApply([a, b], 'junk');
    expect(plan).toEqual({ tag: null, pieces: [a, b] });
  });

  it('returns null for empty input', () => {
    expect(planBulkDimTagApply([], 'keep')).toBeNull();
  });
});
