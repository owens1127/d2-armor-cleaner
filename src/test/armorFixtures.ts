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

/** Two gunner helms per armor set — sameArmorSet splits into separate dupe buckets. */
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

/** Five gunner pieces with weapons/super optimal rolls — fills recommended loadout. */
export function weaponsSuperVault(classType: ArmorPiece['classType'] = 'hunter'): ArmorPiece[] {
  return ARMOR_SLOTS.map((armorSlot) =>
    armorPiece({
      instanceId: `ws-${armorSlot}`,
      classType,
      armorSlot,
      archetype: 'gunner',
      tertiaryStat: 'super',
      tuningStat: 'weapons',
      baseStats: { weapons: 35, grenade: 20, super: 30 },
    }),
  );
}

/** Five brawler pieces covering all slots for build-ready coverage tests. */
export function fullBrawlerVault(classType: ArmorPiece['classType'] = 'hunter'): ArmorPiece[] {
  return ARMOR_SLOTS.map((armorSlot) =>
    armorPiece({
      instanceId: `brawler-${armorSlot}`,
      classType,
      armorSlot,
      archetype: 'brawler',
      tertiaryStat: 'super',
      tuningStat: 'melee',
      baseStats: { melee: 30, health: 25, super: 20 },
    }),
  );
}
