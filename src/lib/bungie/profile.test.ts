import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  countMappedProfileStats,
  fetchProfileInventory,
  itemNeedsStatEnrichment,
  PROFILE_COMPONENTS,
  PROFILE_ITEM_DETAIL_COMPONENTS,
} from './profile';
import { legendaryArmorNeedsStatEnrichment } from '@/lib/armor/parse';
import { POSTMASTER_BUCKET, VAULT_BUCKET } from '@/lib/constants';
import type { ManifestTables } from '@/lib/bungie/manifest';

vi.mock('./client', () => ({
  bungieFetch: vi.fn(),
}));

import { bungieFetch } from './client';

const mockedFetch = vi.mocked(bungieFetch);

const hunterLegManifest: ManifestTables = {
  items: {
    '4248888147': {
      displayProperties: { name: 'Test Legs', icon: '/icon.jpg' },
      classType: 1,
      inventory: { bucketTypeHash: 20886954, tierType: 5 },
    },
    '9999999999': {
      displayProperties: { name: 'Hand Cannon', icon: '/hc.jpg' },
      classType: 1,
      inventory: { bucketTypeHash: 1496356849, tierType: 5 },
    },
  },
  sandboxPerks: {},
  itemSets: {},
  stats: {},
};

describe('itemNeedsStatEnrichment', () => {
  it('needs enrichment when bulk profile returned sockets but no stats', () => {
    expect(
      itemNeedsStatEnrichment('vault-1', {
        sockets: { 'vault-1': { sockets: [{ plugHash: 1807652646 }] } },
        stats: {},
      }),
    ).toBe(true);
  });

  it('needs enrichment when only two unique mapped stats are present', () => {
    expect(
      itemNeedsStatEnrichment('vault-1', {
        stats: {
          'vault-1': {
            stats: {
              '0': { statHash: 2996146975, value: 30 },
              '1': { statHash: 2996146975, value: 32 },
              '2': { statHash: 1735777505, value: 25 },
            },
          },
        },
      }),
    ).toBe(true);
  });

  it('does not need enrichment when three unique mapped stats are present', () => {
    expect(
      itemNeedsStatEnrichment('vault-1', {
        stats: {
          'vault-1': {
            stats: {
              '0': { statHash: 2996146975, value: 30 },
              '1': { statHash: 1735777505, value: 25 },
              '2': { statHash: 144602215, value: 20 },
            },
          },
        },
      }),
    ).toBe(false);
  });
});

describe('legendaryArmorNeedsStatEnrichment', () => {
  it('needs enrichment when bulk stats cannot resolve tertiary after reconciliation', () => {
    const item = {
      itemHash: 4248888147,
      itemInstanceId: 'vault-leg-1',
      bucketHash: VAULT_BUCKET,
      location: 2,
    };
    const components = {
      instances: {
        'vault-leg-1': { gearTier: 5, isMasterwork: true },
      },
      sockets: {
        'vault-leg-1': { sockets: [{ plugHash: 1807652646, isVisible: true }] },
      },
      stats: {
        'vault-leg-1': {
          stats: {
            '0': { statHash: 2996146975, value: 2 },
            '1': { statHash: 1735777505, value: 2 },
            '2': { statHash: 144602215, value: 2 },
          },
        },
      },
    };

    expect(
      legendaryArmorNeedsStatEnrichment(item, components, hunterLegManifest),
    ).toBe(true);
  });
});

describe('fetchProfileInventory', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('merges vault, all characters, equipment, and postmaster without duplicates', async () => {
    mockedFetch.mockResolvedValue({
      profileInventory: {
        data: {
          items: [
            {
              itemHash: 1,
              itemInstanceId: 'vault-1',
              bucketHash: VAULT_BUCKET,
              location: 2,
            },
          ],
        },
      },
      characterInventories: {
        data: {
          charA: {
            items: [
              {
                itemHash: 2,
                itemInstanceId: 'char-1',
                bucketHash: 3448274439,
                location: 1,
              },
              {
                itemHash: 3,
                itemInstanceId: 'post-1',
                bucketHash: POSTMASTER_BUCKET,
                location: 4,
              },
              {
                itemHash: 1,
                itemInstanceId: 'vault-1',
                bucketHash: VAULT_BUCKET,
                location: 2,
              },
            ],
          },
          charB: {
            items: [
              {
                itemHash: 4,
                itemInstanceId: 'char-2',
                bucketHash: 3551918588,
                location: 1,
              },
            ],
          },
        },
      },
      characterEquipment: {
        data: {
          charA: {
            items: [
              {
                itemHash: 5,
                itemInstanceId: 'equipped-1',
                bucketHash: 3448274439,
                location: 1,
              },
            ],
          },
        },
      },
      itemComponents: {
        instances: { data: { 'vault-1': { gearTier: 4 } } },
        sockets: { data: {} },
        reusablePlugs: { data: {} },
        stats: { data: {} },
      },
    });

    const { items, rawItemCount, components, fetchDiagnostics } =
      await fetchProfileInventory(3, 'member-1');

    expect(String(mockedFetch.mock.calls[0][0])).toContain(
      `components=${PROFILE_COMPONENTS}`,
    );
    expect(rawItemCount).toBe(5);
    expect(fetchDiagnostics.totalUnique).toBe(5);
    expect(fetchDiagnostics.enrichmentFailedCount).toBe(0);
    expect(items.map((i) => i.itemInstanceId).sort()).toEqual([
      'char-1',
      'char-2',
      'equipped-1',
      'post-1',
      'vault-1',
    ]);
    expect(components.instances?.['vault-1']?.gearTier).toBe(4);
  });

  it('enriches legendary armor missing stats even when bulk profile returned sockets', async () => {
    mockedFetch
      .mockResolvedValueOnce({
        profileInventory: {
          data: {
            items: [
              {
                itemHash: 4248888147,
                itemInstanceId: 'vault-leg-1',
                bucketHash: VAULT_BUCKET,
                location: 2,
              },
              {
                itemHash: 9999999999,
                itemInstanceId: 'weapon-1',
                bucketHash: VAULT_BUCKET,
                location: 2,
              },
            ],
          },
        },
        characterInventories: { data: {} },
        characterEquipment: { data: {} },
        itemComponents: {
          instances: {
            data: {
              'vault-leg-1': { gearTier: 5 },
              'weapon-1': { gearTier: 5 },
            },
          },
          sockets: {
            data: {
              'vault-leg-1': { sockets: [{ plugHash: 1807652646, isVisible: true }] },
              'weapon-1': { sockets: [{ plugHash: 1234567890, isVisible: true }] },
            },
          },
          reusablePlugs: { data: {} },
          stats: { data: {} },
        },
      })
      .mockResolvedValueOnce({
        instance: { data: { gearTier: 5, primaryStat: { value: 450 } } },
        sockets: {
          data: { sockets: [{ plugHash: 1807652646, isVisible: true }] },
        },
        stats: {
          data: {
            stats: {
              '0': { statHash: 2996146975, value: 30 },
              '1': { statHash: 1735777505, value: 25 },
              '2': { statHash: 144602215, value: 20 },
            },
          },
        },
        reusablePlugs: { data: {} },
      });

    const { components, fetchDiagnostics } = await fetchProfileInventory(
      3,
      'member-1',
      { manifest: hunterLegManifest },
    );

    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(String(mockedFetch.mock.calls[0][0])).toContain(
      `components=${PROFILE_COMPONENTS}`,
    );
    expect(String(mockedFetch.mock.calls[1][0])).toContain('/Item/vault-leg-1/');
    expect(String(mockedFetch.mock.calls[1][0])).toContain(
      `components=${PROFILE_ITEM_DETAIL_COMPONENTS}`,
    );
    expect(fetchDiagnostics.enrichedItemCount).toBe(1);
    expect(countMappedProfileStats(components.stats?.['vault-leg-1'])).toBe(3);
  });

  it('enriches legendary armor when bulk 304 has sockets but only duplicate stat lines', async () => {
    mockedFetch
      .mockResolvedValueOnce({
        profileInventory: {
          data: {
            items: [
              {
                itemHash: 4248888147,
                itemInstanceId: 'vault-leg-dup',
                bucketHash: VAULT_BUCKET,
                location: 2,
              },
            ],
          },
        },
        characterInventories: { data: {} },
        characterEquipment: { data: {} },
        itemComponents: {
          instances: { data: { 'vault-leg-dup': { gearTier: 5 } } },
          sockets: {
            data: {
              'vault-leg-dup': { sockets: [{ plugHash: 1807652646, isVisible: true }] },
            },
          },
          reusablePlugs: { data: {} },
          stats: {
            data: {
              'vault-leg-dup': {
                stats: {
                  '0': { statHash: 2996146975, value: 30 },
                  '1': { statHash: 2996146975, value: 32 },
                  '2': { statHash: 1735777505, value: 25 },
                },
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        instance: { data: { gearTier: 5, primaryStat: { value: 450 } } },
        sockets: {
          data: { sockets: [{ plugHash: 1807652646, isVisible: true }] },
        },
        stats: {
          data: {
            stats: {
              '0': { statHash: 2996146975, value: 30 },
              '1': { statHash: 1735777505, value: 25 },
              '2': { statHash: 144602215, value: 20 },
            },
          },
        },
        reusablePlugs: { data: {} },
      });

    const { fetchDiagnostics } = await fetchProfileInventory(3, 'member-1', {
      manifest: hunterLegManifest,
    });

    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(fetchDiagnostics.enrichedItemCount).toBe(1);
  });
});
