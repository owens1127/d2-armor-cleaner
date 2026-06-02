import { afterEach, describe, expect, it } from 'vitest';
import type { ArmorPiece } from '@/types';
import {
  clearManifestArmorSetIcons,
  resolveArmorSetInfoForHash,
  setManifestArmorSetIcons,
} from '@/lib/items/setIcons';

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

describe('resolveArmorSetInfoForHash', () => {
  afterEach(() => {
    clearManifestArmorSetIcons();
  });

  it('merges manifest perk descriptions when vault perks are empty', () => {
    setManifestArmorSetIcons(
      {
        '3734029045': {
          displayProperties: { name: 'Ferropotent' },
          setPerks: [
            { sandboxPerkHash: 1, requiredSetCount: 2 },
            { sandboxPerkHash: 2, requiredSetCount: 4 },
          ],
        },
      },
      {
        '1': {
          displayProperties: {
            name: '2pc',
            description: 'While you have an Overshield, your weapons deal increased damage.',
          },
        },
        '2': {
          displayProperties: {
            name: '4pc',
            description: 'Melee hits grant Overshield.',
          },
        },
      },
    );

    const vaultOnlyName = {
      hash: 3734029045,
      name: 'Ferropotent Set',
      perks: [],
    };
    const info = resolveArmorSetInfoForHash(3734029045, [piece(vaultOnlyName)]);
    expect(info?.perks).toHaveLength(2);
    expect(info?.perks[0].description).toContain('Overshield');
    expect(info?.perks[1].description).toContain('Melee');
  });
});
