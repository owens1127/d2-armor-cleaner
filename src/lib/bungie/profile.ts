import { bungieFetch } from './client';
import type { ManifestTables } from '@/lib/bungie/manifest';
import { legendaryArmorNeedsStatEnrichment } from '@/lib/armor/parse';
import { countUniqueMappedProfileStats } from '@/lib/armor/profileStats';
import {
  BUCKET_TO_SLOT,
  BUNGIE_CLASS_TO_TYPE,
} from '@/lib/constants';

export {
  countMappedProfileStats,
  countUniqueMappedProfileStats,
} from '@/lib/armor/profileStats';

/** Profile item + linked components for armor parsing */
export interface RawInventoryItem {
  itemHash: number;
  itemInstanceId?: string;
  bucketHash: number;
  location: number;
}

export interface ProfileItemComponents {
  instances?: Record<
    string,
    {
      primaryStat?: { value: number };
      isMasterwork?: boolean;
      gearTier?: number;
    }
  >;
  sockets?: Record<
    string,
    {
      sockets?: {
        plugHash?: number;
        isVisible?: boolean;
      }[];
    }
  >;
  reusablePlugs?: Record<
    string,
    {
      plugs?: Record<string, { plugItemHash: number }[]>;
    }
  >;
  stats?: Record<
    string,
    {
      stats?: Record<string, { statHash: number; value: number }>;
    }
  >;
}

export interface FetchProfileDiagnostics {
  vaultItems: number;
  characterInventoryItems: number;
  equipmentItems: number;
  totalUnique: number;
  instanceComponentCount: number;
  socketComponentCount: number;
  statsComponentCount: number;
  reusablePlugComponentCount: number;
  enrichedItemCount: number;
  enrichmentFailedCount: number;
}

interface DataWrapper<T> {
  data?: T;
  privacy?: number;
}

interface ProfileResponse {
  profileInventory?: DataWrapper<{ items?: RawInventoryItem[] }>;
  characterInventories?: DataWrapper<
    Record<string, { items?: RawInventoryItem[] }>
  >;
  characterEquipment?: DataWrapper<
    Record<string, { items?: RawInventoryItem[] }>
  >;
  itemComponents?: {
    instances?: DataWrapper<ProfileItemComponents['instances']>;
    sockets?: DataWrapper<ProfileItemComponents['sockets']>;
    reusablePlugs?: DataWrapper<ProfileItemComponents['reusablePlugs']>;
    stats?: DataWrapper<ProfileItemComponents['stats']>;
  };
}

interface ItemDetailResponse {
  instance?: DataWrapper<{
    primaryStat?: { value: number };
    isMasterwork?: boolean;
    gearTier?: number;
  }>;
  sockets?: DataWrapper<{
    sockets?: { plugHash?: number; isVisible?: boolean }[];
  }>;
  reusablePlugs?: DataWrapper<{
    plugs?: Record<string, { plugItemHash: number }[]>;
  }>;
  stats?: DataWrapper<{
    stats?: Record<string, { statHash: number; value: number }>;
  }>;
}

function unwrap<T>(component?: DataWrapper<T>): T | undefined {
  return component?.data;
}

/**
 * Bungie `Destiny2.GetProfile` / `GetItem` component IDs for vault armor parsing.
 *
 * @see https://bungie-net.github.io/multi/schema_Destiny-DestinyComponentType.html
 *
 * Inventory (which instanced items exist):
 * - 100 Profiles: account profile record (required alongside itemComponents for full 304)
 * - 102 ProfileInventories: vault buckets
 * - 201 CharacterInventories: character + postmaster
 * - 205 CharacterEquipment: equipped pieces
 *
 * Per-instance `itemComponents` (must be requested with inventory lists above):
 * - 300 ItemInstances: gearTier, primaryStat, isMasterwork
 * - 304 ItemStats: worn stat totals (use 304, not 302 ItemPerks)
 * - 305 ItemSockets: equipped plugs (mods, archetype, masterwork)
 * - 310 ItemReusablePlugs: alternate plugs (e.g. tuning)
 *
 * DIM `getStores()` (destiny2-api.ts) requests 300/305/310 and derives many stats from
 * plugs/manifest; it does not request 304. We always request 304 on bulk profile because
 * Bungie often returns sockets without stats, and parse uses 304 before archetype inference.
 *
 * If bulk profile still omits stats for an item, `GetItem` re-requests the same detail set.
 */
export const PROFILE_INVENTORY_COMPONENT_IDS = [
  100,
  102,
  201,
  205,
] as const;

export const PROFILE_ITEM_DETAIL_COMPONENT_IDS = [
  300,
  304,
  305,
  310,
] as const;

export const PROFILE_COMPONENT_IDS = [
  ...PROFILE_INVENTORY_COMPONENT_IDS,
  ...PROFILE_ITEM_DETAIL_COMPONENT_IDS,
] as const;

export const PROFILE_COMPONENTS = PROFILE_COMPONENT_IDS.join(',');

export const PROFILE_ITEM_DETAIL_COMPONENTS =
  PROFILE_ITEM_DETAIL_COMPONENT_IDS.join(',');

export interface FetchProfileResult {
  items: RawInventoryItem[];
  components: ProfileItemComponents;
  rawItemCount: number;
  fetchDiagnostics: FetchProfileDiagnostics;
}

function countKeys(record?: Record<string, unknown>): number {
  return record ? Object.keys(record).length : 0;
}

function mergeComponentMaps<T extends Record<string, unknown>>(
  base: T | undefined,
  patch: T | undefined,
): T | undefined {
  if (!patch || Object.keys(patch).length === 0) return base;
  return { ...base, ...patch };
}

export function mergeProfileItemComponents(
  base: ProfileItemComponents,
  patch: Partial<ProfileItemComponents>,
): ProfileItemComponents {
  return {
    instances: mergeComponentMaps(base.instances, patch.instances),
    sockets: mergeComponentMaps(base.sockets, patch.sockets),
    reusablePlugs: mergeComponentMaps(base.reusablePlugs, patch.reusablePlugs),
    stats: mergeComponentMaps(base.stats, patch.stats),
  };
}

/** Bulk profile often returns sockets without stats: still needs GetItem. */
export function itemNeedsStatEnrichment(
  instanceId: string,
  components: ProfileItemComponents,
): boolean {
  return countUniqueMappedProfileStats(components.stats?.[instanceId]) < 3;
}

function bulkProfileStatsAreSparse(
  legendaryItems: RawInventoryItem[],
  components: ProfileItemComponents,
): boolean {
  if (legendaryItems.length === 0) return false;

  let withFullStats = 0;
  for (const item of legendaryItems) {
    if (!item.itemInstanceId) continue;
    if (countUniqueMappedProfileStats(components.stats?.[item.itemInstanceId]) >= 3) {
      withFullStats++;
    }
  }

  return withFullStats < legendaryItems.length * 0.5;
}

function buildItemEnrichmentPredicate(
  items: RawInventoryItem[],
  components: ProfileItemComponents,
  manifest?: ManifestTables,
): (instanceId: string) => boolean {
  if (!manifest) {
    return (instanceId) => itemNeedsStatEnrichment(instanceId, components);
  }

  const legendaryItems = items.filter(
    (item) => item.itemInstanceId && isLegendaryArmorCandidate(item, manifest),
  );
  const enrichAllLegendary =
    bulkProfileStatsAreSparse(legendaryItems, components) ||
    legendaryItems.filter((item) =>
      legendaryArmorNeedsStatEnrichment(item, components, manifest),
    ).length >=
      legendaryItems.length * 0.5;

  return (instanceId: string) => {
    const item = items.find((entry) => entry.itemInstanceId === instanceId);
    if (item && !isLegendaryArmorCandidate(item, manifest)) {
      return false;
    }
    if (item && isLegendaryArmorCandidate(item, manifest)) {
      if (enrichAllLegendary) return true;
      return legendaryArmorNeedsStatEnrichment(item, components, manifest);
    }
    return itemNeedsStatEnrichment(instanceId, components);
  };
}

export function isLegendaryArmorCandidate(
  item: RawInventoryItem,
  manifest?: ManifestTables,
): boolean {
  if (!manifest) return true;
  const itemDef = manifest.items[String(item.itemHash)];
  if (!itemDef?.inventory) return false;
  if (itemDef.inventory.tierType !== 5) return false;
  if (!BUCKET_TO_SLOT[itemDef.inventory.bucketTypeHash]) return false;
  return Boolean(BUNGIE_CLASS_TO_TYPE[itemDef.classType]);
}

async function fetchSingleItemComponents(
  membershipType: number,
  destinyMembershipId: string,
  itemInstanceId: string,
): Promise<Partial<ProfileItemComponents>> {
  const detail = await bungieFetch<ItemDetailResponse>(
    `/Platform/Destiny2/${membershipType}/Profile/${destinyMembershipId}/Item/${itemInstanceId}/?components=${PROFILE_ITEM_DETAIL_COMPONENTS}`,
  );

  const instance = unwrap(detail.instance);
  const sockets = unwrap(detail.sockets);
  const stats = unwrap(detail.stats);
  const reusable = unwrap(detail.reusablePlugs);

  const partial: Partial<ProfileItemComponents> = {};
  if (instance) {
    partial.instances = { [itemInstanceId]: instance };
  }
  if (sockets) {
    partial.sockets = { [itemInstanceId]: sockets };
  }
  if (stats) {
    partial.stats = { [itemInstanceId]: stats };
  }
  if (reusable) {
    partial.reusablePlugs = { [itemInstanceId]: reusable };
  }
  return partial;
}

const ENRICH_CONCURRENCY = 8;

/** Fill missing per-item components when profile bulk response omits stat data. */
export async function enrichMissingItemComponents(
  membershipType: number,
  destinyMembershipId: string,
  items: RawInventoryItem[],
  components: ProfileItemComponents,
  needsEnrichment: (instanceId: string) => boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<{
  components: ProfileItemComponents;
  enrichedItemCount: number;
  enrichmentFailedCount: number;
}> {
  const missing = items
    .map((i) => i.itemInstanceId)
    .filter((id): id is string => Boolean(id && needsEnrichment(id)));

  if (missing.length === 0) {
    return { components, enrichedItemCount: 0, enrichmentFailedCount: 0 };
  }

  let merged = components;
  let done = 0;
  let enrichmentFailedCount = 0;

  for (let i = 0; i < missing.length; i += ENRICH_CONCURRENCY) {
    const chunk = missing.slice(i, i + ENRICH_CONCURRENCY);
    const patches = await Promise.all(
      chunk.map(async (id) => {
        try {
          return await fetchSingleItemComponents(
            membershipType,
            destinyMembershipId,
            id,
          );
        } catch {
          enrichmentFailedCount++;
          return {};
        }
      }),
    );
    for (const patch of patches) {
      merged = mergeProfileItemComponents(merged, patch);
    }
    done += chunk.length;
    onProgress?.(done, missing.length);
  }

  return { components: merged, enrichedItemCount: missing.length, enrichmentFailedCount };
}

export interface FetchProfileInventoryOptions {
  onProgress?: (msg: string) => void;
  manifest?: ManifestTables;
}

export async function fetchProfileInventory(
  membershipType: number,
  destinyMembershipId: string,
  options?: FetchProfileInventoryOptions,
): Promise<FetchProfileResult> {
  const profile = await bungieFetch<ProfileResponse>(
    `/Platform/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${PROFILE_COMPONENTS}`,
  );

  const items: RawInventoryItem[] = [];
  const seen = new Set<string>();
  let vaultItems = 0;
  let characterInventoryItems = 0;
  let equipmentItems = 0;

  const add = (list?: RawInventoryItem[]) => {
    for (const item of list ?? []) {
      if (!item.itemInstanceId || seen.has(item.itemInstanceId)) continue;
      seen.add(item.itemInstanceId);
      items.push(item);
    }
  };

  const vaultList = unwrap(profile.profileInventory)?.items;
  vaultItems = vaultList?.length ?? 0;
  add(vaultList);

  for (const inv of Object.values(unwrap(profile.characterInventories) ?? {})) {
    const n = inv.items?.length ?? 0;
    characterInventoryItems += n;
    add(inv.items);
  }
  for (const eq of Object.values(unwrap(profile.characterEquipment) ?? {})) {
    const n = eq.items?.length ?? 0;
    equipmentItems += n;
    add(eq.items);
  }

  let components: ProfileItemComponents = {
    instances: unwrap(profile.itemComponents?.instances),
    sockets: unwrap(profile.itemComponents?.sockets),
    reusablePlugs: unwrap(profile.itemComponents?.reusablePlugs),
    stats: unwrap(profile.itemComponents?.stats),
  };

  const manifest = options?.manifest;
  const needsEnrichment = buildItemEnrichmentPredicate(items, components, manifest);

  const missingCount = items.filter(
    (i) => i.itemInstanceId && needsEnrichment(i.itemInstanceId),
  ).length;

  let enrichmentFailedCount = 0;
  if (missingCount > 0) {
    options?.onProgress?.(
      `Fetching item details for ${missingCount} armor pieces missing stat data…`,
    );
    const enriched = await enrichMissingItemComponents(
      membershipType,
      destinyMembershipId,
      items,
      components,
      needsEnrichment,
      (done, total) => {
        if (done === total || done % 40 === 0) {
          options?.onProgress?.(`Item details ${done}/${total}…`);
        }
      },
    );
    components = enriched.components;
    enrichmentFailedCount = enriched.enrichmentFailedCount;
  }

  const fetchDiagnostics: FetchProfileDiagnostics = {
    vaultItems,
    characterInventoryItems,
    equipmentItems,
    totalUnique: items.length,
    instanceComponentCount: countKeys(components.instances),
    socketComponentCount: countKeys(components.sockets),
    statsComponentCount: countKeys(components.stats),
    reusablePlugComponentCount: countKeys(components.reusablePlugs),
    enrichedItemCount: missingCount,
    enrichmentFailedCount,
  };

  return {
    items,
    components,
    rawItemCount: items.length,
    fetchDiagnostics,
  };
}
