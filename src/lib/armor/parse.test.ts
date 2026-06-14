import { describe, expect, it } from 'vitest';
import brawlerFixture from './fixtures/brawler-chest.fixture.json';
import fixture from './fixtures/gunner-helmet.fixture.json';
import { parseArmorFromProfile } from './parse';
import type { ManifestTables } from '@/lib/bungie/manifest';
import type { ProfileItemComponents, RawInventoryItem } from '@/lib/bungie/profile';

type Fixture = {
  rawItems: RawInventoryItem[];
  components: ProfileItemComponents;
  manifest: ManifestTables;
  expected: {
    instanceId: string;
    classType: string;
    armorSlot: string;
    archetype: string;
    tertiaryStat: string;
    tuningStat: string;
    tier: number | null;
    isMasterwork: boolean;
    armorSetName: string;
  };
};

const gold = fixture as unknown as Fixture;
const brawlerGold = brawlerFixture as unknown as Fixture;

describe('parseArmorFromProfile', () => {
  it('parses golden gunner helmet fixture', () => {
    const { items, diagnostics } = parseArmorFromProfile(
      gold.rawItems,
      gold.components,
      gold.manifest,
    );

    expect(diagnostics.parsed).toBe(1);
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.instanceId).toBe(gold.expected.instanceId);
    expect(item.classType).toBe(gold.expected.classType);
    expect(item.armorSlot).toBe(gold.expected.armorSlot);
    expect(item.archetype).toBe(gold.expected.archetype);
    expect(item.tertiaryStat).toBe(gold.expected.tertiaryStat);
    expect(item.tuningStat).toBe(gold.expected.tuningStat);
    expect(item.tier).toBe(gold.expected.tier);
    expect(item.isMasterwork).toBe(true);
    expect(item.baseStats.weapons).toBe(30);
    expect(item.baseStats.grenade).toBe(25);
    expect(item.baseStats.super).toBe(20);
    expect(item.armorSet?.name).toBe(gold.expected.armorSetName);
    expect(item.armorSet?.perks[0]?.icon).toBe(
      '/common/destiny2_content/icons/fixture-set-2pc.png',
    );
    expect(item.armorSet?.perks[0]?.pieces).toBe(2);
    expect(item.location).toBe('vault');
    expect(item.icon).toBe('/common/destiny2_content/icons/172009eaee2bb314b70bc95565ba82ad.jpg');
  });

  it('parses golden brawler chest fixture', () => {
    const { items, diagnostics } = parseArmorFromProfile(
      brawlerGold.rawItems,
      brawlerGold.components,
      brawlerGold.manifest,
    );

    expect(diagnostics.parsed).toBe(1);
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.instanceId).toBe(brawlerGold.expected.instanceId);
    expect(item.classType).toBe(brawlerGold.expected.classType);
    expect(item.armorSlot).toBe(brawlerGold.expected.armorSlot);
    expect(item.archetype).toBe(brawlerGold.expected.archetype);
    expect(item.tertiaryStat).toBe(brawlerGold.expected.tertiaryStat);
    expect(item.tuningStat).toBe(brawlerGold.expected.tuningStat);
    expect(item.tier).toBe(5);
    expect(item.isMasterwork).toBe(false);
    expect(item.baseStats.melee).toBe(30);
    expect(item.baseStats.health).toBe(25);
    expect(item.baseStats.super).toBe(20);
    expect(item.armorSet?.name).toBe(brawlerGold.expected.armorSetName);
    expect(item.icon).toBe('/common/destiny2_content/icons/ec88f1ed1bc957aded9fe08e92c138be.jpg');
  });

  it('imports altar-tier armor with low altar tier (T1-T3)', () => {
    for (const tier of [1, 2, 3] as const) {
      const components = structuredClone(gold.components);
      components.instances!['fixture-gunner-helm-001'].gearTier = tier;

      const { items, diagnostics } = parseArmorFromProfile(
        gold.rawItems,
        components,
        gold.manifest,
      );

      expect(items).toHaveLength(1);
      expect(items[0].tier).toBe(tier);
      expect(diagnostics.parsed).toBe(1);
      expect(diagnostics.skipped.noGearTier).toBe(0);
    }
  });

  it('skips altar-tier armor when instance gearTier is missing', () => {
    const components = structuredClone(gold.components);
    delete components.instances!['fixture-gunner-helm-001'].gearTier;

    const { items, diagnostics } = parseArmorFromProfile(
      gold.rawItems,
      components,
      gold.manifest,
    );

    expect(items).toHaveLength(0);
    expect(diagnostics.skipped.noGearTier).toBe(1);
    expect(diagnostics.withGearTier).toBe(0);
  });

  it('labels altar-tier Smoke Jumper style armor from instance gearTier', () => {
    const components = structuredClone(gold.components);
    components.instances!['fixture-gunner-helm-001'].gearTier = 4;

    const { items, diagnostics } = parseArmorFromProfile(
      gold.rawItems,
      components,
      gold.manifest,
    );

    expect(diagnostics.parsed).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].tier).toBe(4);
    expect(diagnostics.withGearTier).toBe(1);
  });

  it('applies DIM tags from map', () => {
    const { items } = parseArmorFromProfile(
      gold.rawItems,
      gold.components,
      gold.manifest,
      { 'fixture-gunner-helm-001': { dimTag: 'keep', dimFavorite: false } },
    );
    expect(items[0].dimTag).toBe('keep');
    expect(items[0].dimFavorite).toBe(false);
  });

  it('applies DIM favorite as dimFavorite overlay', () => {
    const { items } = parseArmorFromProfile(
      gold.rawItems,
      gold.components,
      gold.manifest,
      { 'fixture-gunner-helm-001': { dimTag: null, dimFavorite: true } },
    );
    expect(items[0].dimTag).toBeNull();
    expect(items[0].dimFavorite).toBe(true);
  });

  it('skips non-legendary armor', () => {
    const manifest = structuredClone(gold.manifest);
    manifest.items['4248888147'].inventory!.tierType = 4;

    const { items, diagnostics } = parseArmorFromProfile(
      gold.rawItems,
      gold.components,
      manifest,
    );

    expect(items).toHaveLength(0);
    expect(diagnostics.legendaryArmor).toBe(0);
  });

  it('imports Bushido-style chest without T5 label when intrinsics fail tier-5 shape', () => {
    const components = structuredClone(gold.components);
    const manifest = structuredClone(gold.manifest);
    components.instances!['fixture-gunner-helm-001'] = {
      ...components.instances!['fixture-gunner-helm-001'],
      gearTier: 5,
      isMasterwork: false,
    };
    components.stats!['fixture-gunner-helm-001'] = {
      stats: {
        '0': { statHash: 2996146975, value: 18 },
        '1': { statHash: 4030660414, value: 18 },
        '2': { statHash: 144602215, value: 3 },
      },
    };
    manifest.items['4248888148'] = {
      ...manifest.items['4248888147'],
      displayProperties: {
        name: 'Bushido Vest',
        icon: manifest.items['4248888147'].displayProperties.icon,
      },
      inventory: { bucketTypeHash: 14239492, tierType: 5 },
      sockets: manifest.items['4248888147'].sockets,
    };
    manifest.items['2230428468'] = {
      displayProperties: { name: 'Specialist' },
      classType: 3,
    };
    const rawItems = [
      {
        itemHash: 4248888148,
        itemInstanceId: 'fixture-gunner-helm-001',
        bucketHash: 138197802,
        location: 2,
      },
    ];
    components.sockets!['fixture-gunner-helm-001'] = {
      sockets: [{ plugHash: 2230428468, isVisible: true }],
    };

    const { items, diagnostics } = parseArmorFromProfile(rawItems, components, manifest);

    expect(diagnostics.parsed).toBe(1);
    expect(items[0].name).toBe('Bushido Vest');
    expect(items[0].tier).toBeNull();
    expect(items[0].baseStats.super).toBe(3);
    expect(
      (items[0].baseStats.weapons ?? 0) + (items[0].baseStats.class ?? 0) + (items[0].baseStats.super ?? 0),
    ).toBeLessThan(45);
    expect(diagnostics.withGearTier).toBe(1);
  });

  it('parses tertiary from a full six-stat ItemStats block', () => {
    const components = structuredClone(gold.components);
    components.stats!['fixture-gunner-helm-001'] = {
      stats: {
        '0': { statHash: 2996146975, value: 30 },
        '1': { statHash: 1735777505, value: 25 },
        '2': { statHash: 144602215, value: 20 },
        '3': { statHash: 392767087, value: 0 },
        '4': { statHash: 4244567218, value: 0 },
        '5': { statHash: 1943323491, value: 0 },
      },
    };

    const { items, diagnostics } = parseArmorFromProfile(
      gold.rawItems,
      components,
      gold.manifest,
    );

    expect(diagnostics.parsed).toBe(1);
    expect(items[0].tertiaryStat).toBe('super');
    expect(items[0].baseStats.super).toBe(20);
  });

  it('infers archetype from stat pattern when archetype plug is missing', () => {
    const components = structuredClone(gold.components);
    components.sockets!['fixture-gunner-helm-001'] = { sockets: [] };

    const { items, diagnostics } = parseArmorFromProfile(
      gold.rawItems,
      components,
      gold.manifest,
    );

    expect(items).toHaveLength(1);
    expect(items[0].archetype).toBe('gunner');
    expect(diagnostics.inferredArchetype).toBe(1);
    expect(diagnostics.skipped.noArchetype).toBe(0);
  });

  it('recognizes Monument of Triumph archetype plugs', () => {
    const components = structuredClone(gold.components);
    const manifest = structuredClone(gold.manifest) as typeof gold.manifest;
    manifest.items['2503381935'] = {
      displayProperties: { name: 'Siegebreaker' },
      classType: 3,
    };
    components.sockets!['fixture-gunner-helm-001'] = {
      sockets: [{ plugHash: 2503381935, isVisible: true }],
    };

    const { items } = parseArmorFromProfile(gold.rawItems, components, manifest);

    expect(items[0].archetype).toBe('siegebreaker');
  });
});
