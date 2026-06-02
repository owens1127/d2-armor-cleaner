import { describe, expect, it, afterEach } from 'vitest';
import type { ArmorPiece } from '@/types';
import {
  clearManifestArmorSetIcons,
  setManifestArmorSetIcons,
} from '@/lib/items/setIcons';
import {
  formatSetBonusTargetsSummary,
  resolveSetName,
} from '@/lib/coverage/setBonus';

function piece(armorSet: ArmorPiece['armorSet']): ArmorPiece {
  return {
    instanceId: 'x',
    itemHash: 1,
    name: 'Test',
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'paragon',
    baseStats: { weapons: 10 },
    tertiaryStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    armorSet,
  };
}

describe('resolveSetName', () => {
  afterEach(() => {
    clearManifestArmorSetIcons();
  });

  it('uses vault armor set names when present', () => {
    const smoke = { hash: 2751989785, name: 'Smoke Jumper Set', perks: [] };
    expect(resolveSetName([piece(smoke)], smoke.hash)).toBe('Smoke Jumper Set');
  });

  it('falls back to manifest when vault has no matching set', () => {
    setManifestArmorSetIcons(
      {
        '3734029045': {
          displayProperties: { name: 'Ferropotent' },
          setPerks: [],
        },
      },
      {},
    );
    expect(resolveSetName([], 3734029045)).toBe('Ferropotent');
  });

  it('does not expose raw set hashes when name is unknown', () => {
    expect(resolveSetName([], 9999999999)).toBe('Unknown set');
    expect(resolveSetName([], 9999999999)).not.toMatch(/\d{8,}/);
  });
});

describe('formatSetBonusTargetsSummary', () => {
  afterEach(() => {
    clearManifestArmorSetIcons();
  });

  it('formats 2+2 mix with compact names from manifest', () => {
    setManifestArmorSetIcons(
      {
        '2751989785': {
          displayProperties: { name: 'Smoke Jumper Set' },
          setPerks: [],
        },
        '3734029045': {
          displayProperties: { name: 'Ferropotent' },
          setPerks: [],
        },
      },
      {},
    );
    expect(formatSetBonusTargetsSummary(3734029045, 2751989785, [])).toBe(
      '2pc Ferropotent + 2pc Smoke Jumper',
    );
  });
});
