import { describe, expect, it } from 'vitest';
import { effectiveStats } from './effectiveStats';
import {
  intrinsicStatsFromDisplayed,
  intrinsicStatsFromHiddenPlugs,
} from './intrinsicStats';
import type { ManifestTables } from '@/lib/bungie/manifest';

describe('intrinsicStatsFromDisplayed', () => {
  it('subtracts mods then masterwork (Ferropotent-style profile total)', () => {
    const base = intrinsicStatsFromDisplayed(
      { weapons: 35, grenade: 25, super: 20 },
      { weapons: 8 },
      true,
    );
    expect(base).toEqual({ weapons: 25, grenade: 23, super: 18 });
    expect(
      effectiveStats({
        instanceId: 'x',
        itemHash: 1,
        name: 'Mask',
        classType: 'hunter',
        armorSlot: 'helmet',
        tier: 5,
        power: 450,
        location: 'vault',
        archetype: 'gunner',
        baseStats: base,
        modStats: { weapons: 8 },
        modStatsAdditive: true,
        tertiaryStat: 'super',
        isMasterwork: true,
      }).weapons,
    ).toBe(35);
  });
});

describe('intrinsicStatsFromHiddenPlugs', () => {
  const manifest = {
    items: {
      '910101': {
        investmentStats: [{ statTypeHash: 2996146975, value: 30 }],
      },
      '910102': {
        investmentStats: [{ statTypeHash: 1735777505, value: 20 }],
      },
      '910103': {
        investmentStats: [{ statTypeHash: 1943323491, value: 3 }],
      },
      '900020': {
        investmentStats: [
          { statTypeHash: 1735777505, value: 6 },
          { statTypeHash: 144602215, value: 6 },
          { statTypeHash: 2996146975, value: 6 },
        ],
      },
    },
  } as unknown as ManifestTables;

  it('sums only hidden roll fragments', () => {
    const stats = intrinsicStatsFromHiddenPlugs(manifest, [
      { plugHash: 1807652646, isVisible: true },
      { plugHash: 900020, isVisible: true },
      { plugHash: 910101, isVisible: false },
      { plugHash: 910102, isVisible: false },
      { plugHash: 910103, isVisible: false },
    ]);
    expect(stats).toEqual({ weapons: 30, grenade: 20, class: 3 });
  });

  it('treats hidden single-stat non-roll increments as mods, not intrinsic', () => {
    const modManifest = {
      items: {
        '900010': {
          investmentStats: [{ statTypeHash: 2996146975, value: 6 }],
        },
        '910001': {
          investmentStats: [{ statTypeHash: 2996146975, value: 30 }],
        },
      },
    } as unknown as ManifestTables;
    expect(
      intrinsicStatsFromHiddenPlugs(modManifest, [
        { plugHash: 900010, isVisible: false },
        { plugHash: 910001, isVisible: false },
      ]),
    ).toEqual({ weapons: 30 });
  });
});
