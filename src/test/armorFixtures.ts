import type { ArmorPiece } from '@/types';
import { ARMOR_SLOTS } from '@/lib/constants';

/** Minimal armor piece factory for integration and algorithm tests. */
export function armorPiece(
  overrides: Partial<ArmorPiece> & { instanceId: string },
): ArmorPiece {
  return {
    itemHash: 1,
    name: 'Test Helm',
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'gunner',
    baseStats: { weapons: 30, grenade: 25, super: 20 },
    tertiaryStat: 'super',
    tuningStat: 'weapons',
    isMasterwork: false,
    dimTag: null,
    ...overrides,
  };
}

/** Two gunner helms per armor set - sameArmorSet splits into separate dupe buckets. */
export function splitSetHelmVault(): ArmorPiece[] {
  const setA = { hash: 101, name: 'Set Alpha', perks: [] };
  const setB = { hash: 202, name: 'Set Beta', perks: [] };
  return [
    armorPiece({ instanceId: 'helm-a1', armorSet: setA }),
    armorPiece({ instanceId: 'helm-a2', armorSet: setA, tuningStat: 'grenade' }),
    armorPiece({ instanceId: 'helm-b1', armorSet: setB }),
    armorPiece({ instanceId: 'helm-b2', armorSet: setB, tuningStat: 'grenade' }),
  ];
}

/** Five powerhouse pieces with weapons/super optimal rolls - fills recommended loadout. */
export function weaponsSuperVault(classType: ArmorPiece['classType'] = 'hunter'): ArmorPiece[] {
  return ARMOR_SLOTS.map((armorSlot) =>
    armorPiece({
      instanceId: `ws-${armorSlot}`,
      classType,
      armorSlot,
      archetype: 'powerhouse',
      tertiaryStat: 'melee',
      tuningStat: 'weapons',
      baseStats: { weapons: 35, super: 30, melee: 20 },
    }),
  );
}

/** Five paragon pieces covering all slots for melee+super build-ready coverage tests. */
export function fullBrawlerVault(classType: ArmorPiece['classType'] = 'hunter'): ArmorPiece[] {
  return ARMOR_SLOTS.map((armorSlot) =>
    armorPiece({
      instanceId: `melee-super-${armorSlot}`,
      classType,
      armorSlot,
      archetype: 'paragon',
      tertiaryStat: 'weapons',
      tuningStat: 'melee',
      baseStats: { super: 30, melee: 25, weapons: 20 },
    }),
  );
}
