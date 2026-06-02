import { describe, expect, it } from 'vitest';
import {
  isDegenerateIntrinsicRoll,
  isHiddenRollStatValue,
  validateTierIntrinsicStats,
} from './intrinsicStats';
import { cardStatsForPiece } from '@/components/duel/ArmorCard';
import { comparableStatDeltas } from '@/lib/scoring/dominance';
import { intrinsicStats } from './intrinsicCompare';
import { legendaryArmorNeedsStatEnrichment, parseArmorFromProfile } from './parse';
import brawlerFixture from './fixtures/brawler-chest.fixture.json';
import gunnerFixture from './fixtures/gunner-helmet.fixture.json';
import smokeJumperFixture from './fixtures/smoke-jumper-cloak.fixture.json';
import sparseStridesFixture from './fixtures/sparse-bulk-strides.fixture.json';
import type { ManifestTables } from '@/lib/bungie/manifest';
import type { ProfileItemComponents, RawInventoryItem } from '@/lib/bungie/profile';
import type { ArmorPiece } from '@/types';

function parseFixture(
  rawItems: RawInventoryItem[],
  components: ProfileItemComponents,
  manifest: ManifestTables,
) {
  return parseArmorFromProfile(rawItems, components, manifest).items;
}

function assertTier5IntrinsicMultiples(piece: ArmorPiece) {
  if (piece.tier == null || piece.tier < 4) return;
  const validation = validateTierIntrinsicStats(
    piece.tier,
    piece.baseStats,
    piece.tertiaryStat,
    piece.archetype,
  );
  expect(
    validation.valid,
    `T${piece.tier} ${piece.name} invalid intrinsic: ${validation.warnings.join(', ')}`,
  ).toBe(true);
  for (const entry of cardStatsForPiece(piece)) {
    if (entry.role === 'tertiary' && entry.value <= 5) continue;
    expect(entry.value % 5, `${entry.stat}=${entry.value} on ${piece.name}`).toBe(0);
    expect(entry.value, `${entry.stat} zero on ${piece.name}`).toBeGreaterThan(0);
  }
}

describe('T5 intrinsic roll integration', () => {
  it('detects impossible 0/0/5 wear fallback as degenerate', () => {
    expect(
      isDegenerateIntrinsicRoll(
        5,
        { weapons: 0, grenade: 0, super: 5 },
        'gunner',
      ),
    ).toBe(true);
    expect(isHiddenRollStatValue(6)).toBe(false);
    expect(isHiddenRollStatValue(30)).toBe(true);
    expect(isHiddenRollStatValue(3)).toBe(true);
  });

  it('skips sparse bulk profile without hidden plugs and requests enrichment', () => {
    const fx = sparseStridesFixture as {
      rawItems: RawInventoryItem[];
      componentsBulk: ProfileItemComponents;
      manifest: ManifestTables;
    };
    const item = fx.rawItems[0];
    expect(
      legendaryArmorNeedsStatEnrichment(item, fx.componentsBulk, fx.manifest),
    ).toBe(true);

    const bulk = parseFixture(fx.rawItems, fx.componentsBulk, fx.manifest);
    expect(bulk).toHaveLength(0);
  });

  it('parses enriched GetItem response from hidden socket roll plugs (w4)', () => {
    const fx = sparseStridesFixture as {
      rawItems: RawInventoryItem[];
      componentsEnriched: ProfileItemComponents;
      manifest: ManifestTables;
      expectedEnriched: {
        baseStats: Record<string, number>;
        archetype: string;
        tertiaryStat: string;
        armorSlot: string;
      };
    };
    const item = fx.rawItems[0];
    expect(
      legendaryArmorNeedsStatEnrichment(
        item,
        fx.componentsEnriched,
        fx.manifest,
      ),
    ).toBe(false);

    const items = parseFixture(
      fx.rawItems,
      fx.componentsEnriched,
      fx.manifest,
    );
    expect(items).toHaveLength(1);
    expect(intrinsicStats(items[0])).toEqual(fx.expectedEnriched.baseStats);
    expect(items[0].archetype).toBe(fx.expectedEnriched.archetype);
    expect(items[0].tertiaryStat).toBe(fx.expectedEnriched.tertiaryStat);
    expect(items[0].armorSlot).toBe(fx.expectedEnriched.armorSlot);
    assertTier5IntrinsicMultiples(items[0]);
  });

  it('card and dominance deltas share the same intrinsicStats source', () => {
    const fx = sparseStridesFixture as {
      rawItems: RawInventoryItem[];
      componentsEnriched: ProfileItemComponents;
      manifest: ManifestTables;
    };
    const dominator = parseFixture(
      fx.rawItems,
      fx.componentsEnriched,
      fx.manifest,
    )[0];
    const candidateStats = { weapons: 0, grenade: 0, super: 5 };
    const candidate = {
      ...dominator,
      instanceId: 'fixture-sparse-strides-bulk',
      baseStats: candidateStats,
    };

    for (const entry of cardStatsForPiece(dominator)) {
      expect(entry.value).toBe(intrinsicStats(dominator)[entry.stat] ?? 0);
    }

    const deltas = comparableStatDeltas(dominator, candidate);
    expect(deltas).toEqual([
      { stat: 'weapons', delta: 30 },
      { stat: 'grenade', delta: 25 },
      { stat: 'super', delta: 15 },
    ]);
  });

  it('golden fixtures never produce non-multiple-of-5 T5 primaries', () => {
    for (const fx of [gunnerFixture, brawlerFixture, smokeJumperFixture]) {
      const items = parseFixture(
        fx.rawItems as RawInventoryItem[],
        fx.components as ProfileItemComponents,
        fx.manifest as ManifestTables,
      );
      for (const piece of items) {
        assertTier5IntrinsicMultiples(piece);
      }
    }
  });
});
