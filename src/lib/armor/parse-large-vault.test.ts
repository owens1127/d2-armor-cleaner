import { describe, expect, it } from 'vitest';
import gold from './fixtures/gunner-helmet.fixture.json';
import { parseArmorFromProfile } from './parse';
import type { ManifestTables } from '@/lib/bungie/manifest';
import type { ProfileItemComponents, RawInventoryItem } from '@/lib/bungie/profile';

type Fixture = {
  rawItems: RawInventoryItem[];
  components: ProfileItemComponents;
  manifest: ManifestTables;
};

const base = gold as unknown as Fixture;

const ARCHETYPES = [
  {
    plugHash: 1807652646,
    hiddenPlugs: [
      { plugHash: 910001, statHash: 2996146975, value: 30 },
      { plugHash: 910002, statHash: 1735777505, value: 25 },
      { plugHash: 910003, statHash: 144602215, value: 20 },
    ],
  },
  {
    plugHash: 3349393475,
    hiddenPlugs: [
      { plugHash: 910011, statHash: 4244567218, value: 30 },
      { plugHash: 910012, statHash: 392767087, value: 25 },
      { plugHash: 910013, statHash: 144602215, value: 20 },
    ],
  },
  {
    plugHash: 2937665788,
    hiddenPlugs: [
      { plugHash: 910021, statHash: 1735777505, value: 30 },
      { plugHash: 910022, statHash: 144602215, value: 25 },
      { plugHash: 910023, statHash: 2996146975, value: 20 },
    ],
  },
] as const;

function buildLargeVault(count: number, gearTier: number) {
  const rawItems: RawInventoryItem[] = [];
  const instances: ProfileItemComponents['instances'] = {};
  const sockets: ProfileItemComponents['sockets'] = {};
  const stats: ProfileItemComponents['stats'] = {};
  const manifest = structuredClone(base.manifest) as ManifestTables;

  for (const arch of ARCHETYPES) {
    for (const hidden of arch.hiddenPlugs) {
      manifest.items[String(hidden.plugHash)] = {
        displayProperties: { name: 'Roll stat' },
        classType: 3,
        investmentStats: [{ statTypeHash: hidden.statHash, value: hidden.value }],
      };
    }
  }

  for (let i = 0; i < count; i++) {
    const id = `vault-hunter-${i}`;
    const arch = ARCHETYPES[i % ARCHETYPES.length];
    rawItems.push({
      itemHash: 4248888147,
      itemInstanceId: id,
      bucketHash: i % 3 === 0 ? 138197802 : 3551918588,
      location: i % 3 === 0 ? 2 : 1,
    });
    instances![id] = { gearTier, primaryStat: { value: 450 }, isMasterwork: false };
    sockets![id] = {
      sockets: [
        { plugHash: arch.plugHash, isVisible: true },
        ...arch.hiddenPlugs.map((hidden) => ({
          plugHash: hidden.plugHash,
          isVisible: false as const,
        })),
      ],
    };
    stats![id] = {
      stats: Object.fromEntries(
        arch.hiddenPlugs.map((hidden, index) => [
          String(index),
          { statHash: hidden.statHash, value: hidden.value },
        ]),
      ),
    };
  }

  return {
    rawItems,
    components: { instances, sockets, stats } satisfies ProfileItemComponents,
    manifest,
  };
}

describe('parseArmorFromProfile large vault', () => {
  it('parses hundreds of T4 hunter armor at import', () => {
    const count = 240;
    const { rawItems, components, manifest } = buildLargeVault(count, 4);

    const { items, diagnostics } = parseArmorFromProfile(rawItems, components, manifest);

    expect(items).toHaveLength(count);
    expect(items.every((i) => i.classType === 'hunter')).toBe(true);
    expect(items.every((i) => i.tier === 4)).toBe(true);
    expect(diagnostics.parsed).toBe(count);
  });

  it('imports low altar tiers (T2) alongside higher tiers', () => {
    const count = 60;
    const { rawItems, components, manifest } = buildLargeVault(count, 2);

    const { items, diagnostics } = parseArmorFromProfile(rawItems, components, manifest);

    expect(items).toHaveLength(count);
    expect(items.every((i) => i.tier === 2)).toBe(true);
    expect(diagnostics.skipped.noGearTier).toBe(0);
    expect(diagnostics.parsed).toBe(count);
  });

  it('parses large vault when socket roll plugs missing but stats present', () => {
    const count = 120;
    const { rawItems, components, manifest } = buildLargeVault(count, 5);
    for (const item of rawItems) {
      components.sockets![item.itemInstanceId!] = { sockets: [] };
    }

    const { items, diagnostics } = parseArmorFromProfile(rawItems, components, manifest);

    expect(items).toHaveLength(count);
    expect(diagnostics.inferredArchetype).toBe(count);
    expect(diagnostics.skipped.noArchetype).toBe(0);
  });

  it('skips armor when bulk has mod sockets but no stats (regression guard)', () => {
    const count = 50;
    const { rawItems, components, manifest } = buildLargeVault(count, 5);
    for (const item of rawItems) {
      delete components.stats![item.itemInstanceId!];
      components.sockets![item.itemInstanceId!] = {
        sockets: [{ plugHash: 999888777, isVisible: true }],
      };
    }

    const { items, diagnostics } = parseArmorFromProfile(rawItems, components, manifest);

    expect(items).toHaveLength(0);
    expect(diagnostics.skipped.noArchetype).toBe(count);
  });
});
