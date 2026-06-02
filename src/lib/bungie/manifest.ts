import { STAT_MANIFEST_HASH, STATS } from '@/lib/constants';
import { setManifestStatIcons } from '@/lib/items/icons';
import { setManifestArmorSetIcons } from '@/lib/items/setIcons';
import type { Stat } from '@/types';
import { bungieFetch } from './client';
import { readCachedManifest, writeManifestCache } from './manifestCache';
import { LOG_PREFIX } from '@/lib/storage/keys';

const MANIFEST_MEMORY_KEY = '__dac_manifest__';

export interface ManifestStatDef {
  hash: number;
  displayProperties: { name: string; icon?: string };
}

export interface ManifestTables {
  items: Record<string, ManifestItemDef>;
  itemSets: Record<string, ManifestItemSetDef>;
  sandboxPerks: Record<string, ManifestSandboxPerkDef>;
  stats: Record<string, ManifestStatDef>;
}

export interface ManifestItemDef {
  displayProperties: { name: string; icon?: string };
  classType: number;
  inventory?: { bucketTypeHash: number; tierType: number };
  equippingBlock?: { equipableItemSetHash?: number };
  itemType?: number;
  itemSubType?: number;
  investmentStats?: { statTypeHash: number; value: number }[];
  sockets?: {
    socketEntries?: {
      singleInitialItemHash?: number;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
    }[];
  };
}

export interface ManifestItemSetDef {
  displayProperties: { name: string };
  setPerks: { sandboxPerkHash: number; requiredSetCount?: number }[];
}

export interface ManifestSandboxPerkDef {
  displayProperties: { name: string; description: string; icon?: string };
}

interface ManifestInfo {
  version: string;
  jsonWorldComponentContentPaths?: Record<string, Record<string, string>>;
}

/** Tables required for tiered armor parsing: component paths only, not full world JSON. */
export const MANIFEST_TABLES = [
  {
    key: 'items' as const,
    pathKey: 'DestinyInventoryItemDefinition',
    label: 'item definitions',
  },
  {
    key: 'itemSets' as const,
    pathKey: 'DestinyEquipableItemSetDefinition',
    label: 'set definitions',
  },
  {
    key: 'sandboxPerks' as const,
    pathKey: 'DestinySandboxPerkDefinition',
    label: 'perk definitions',
  },
  {
    key: 'stats' as const,
    pathKey: 'DestinyStatDefinition',
    label: 'stat definitions',
  },
] as const;

/** Build stat → Bungie icon path map from DestinyStatDefinition table. */
export function extractStatIconPaths(
  stats: Record<string, ManifestStatDef>,
): Partial<Record<Stat, string>> {
  const paths: Partial<Record<Stat, string>> = {};
  for (const stat of STATS) {
    const hash = STAT_MANIFEST_HASH[stat];
    const icon = stats[String(hash)]?.displayProperties?.icon;
    if (icon) paths[stat] = icon;
  }
  return paths;
}

/** English per-table JSON paths from a Bungie manifest info response. */
export function getManifestComponentPaths(
  info: ManifestInfo,
): Record<string, string> {
  const paths = info.jsonWorldComponentContentPaths?.en;
  if (!paths || typeof paths !== 'object') {
    throw new Error(
      'Manifest download failed: English component paths not found in Bungie response. Retry in a moment.',
    );
  }
  return paths;
}

let memoryCache: ManifestTables | null = (globalThis as Record<string, unknown>)[
  MANIFEST_MEMORY_KEY
] as ManifestTables | null;

let manifestLoadPromise: Promise<ManifestTables> | null = null;
let backgroundRefreshPromise: Promise<void> | null = null;

/** Resolve a Bungie manifest table path to a fetchable URL (throws if missing/invalid). */
export function resolveManifestTableUrl(
  path: string | undefined | null,
  tableName: string,
): string {
  if (!path || typeof path !== 'string') {
    throw new Error(
      `Manifest download failed: ${tableName} path is missing from Bungie manifest response. Retry in a moment or clear site data.`,
    );
  }
  return path.startsWith('http') ? path : `https://www.bungie.net${path}`;
}

async function fetchTable(
  path: string | undefined,
  tableName: string,
): Promise<Record<string, unknown>> {
  const url = resolveManifestTableUrl(path, tableName);
  // Browser fetch negotiates gzip/br automatically via Accept-Encoding.
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Manifest fetch failed for ${tableName}: HTTP ${res.status}`);
  }
  return res.json();
}

function storeMemoryCache(tables: ManifestTables): void {
  memoryCache = tables;
  (globalThis as Record<string, unknown>)[MANIFEST_MEMORY_KEY] = memoryCache;
  if (tables.stats) {
    setManifestStatIcons(extractStatIconPaths(tables.stats));
  }
  if (tables.itemSets && tables.sandboxPerks) {
    setManifestArmorSetIcons(tables.itemSets, tables.sandboxPerks);
  }
}

async function downloadManifestTables(
  info: ManifestInfo,
  onProgress?: (msg: string) => void,
): Promise<ManifestTables> {
  const paths = getManifestComponentPaths(info);
  const total = MANIFEST_TABLES.length;
  let completed = 0;

  onProgress?.(`Downloading manifest tables (0/${total})…`);

  const reportComplete = (label: string) => {
    completed += 1;
    onProgress?.(`Loaded ${label} (${completed}/${total})…`);
  };

  const fetchJobs = MANIFEST_TABLES.map(async (table) => {
    onProgress?.(`Downloading ${table.label}…`);
    const data = (await fetchTable(paths[table.pathKey], table.pathKey)) as Record<
      string,
      unknown
    >;
    reportComplete(table.label);
    return { key: table.key, data };
  });

  const results = await Promise.all(fetchJobs);

  const byKey = Object.fromEntries(results.map(({ key, data }) => [key, data])) as {
    items: Record<string, ManifestItemDef>;
    itemSets: Record<string, ManifestItemSetDef>;
    sandboxPerks: Record<string, ManifestSandboxPerkDef>;
    stats: Record<string, ManifestStatDef>;
  };

  return {
    items: byKey.items,
    itemSets: byKey.itemSets,
    sandboxPerks: byKey.sandboxPerks,
    stats: byKey.stats,
  };
}

async function refreshManifestInBackground(info: ManifestInfo, staleVersion: string): Promise<void> {
  if (info.version === staleVersion) return;
  if (backgroundRefreshPromise) return backgroundRefreshPromise;

  backgroundRefreshPromise = (async () => {
    try {
      const tables = await downloadManifestTables(info);
      storeMemoryCache(tables);
      await writeManifestCache(info.version, tables);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`${LOG_PREFIX} background manifest refresh failed`, err);
      }
    } finally {
      backgroundRefreshPromise = null;
    }
  })();

  return backgroundRefreshPromise;
}

async function loadManifestTablesInner(
  onProgress?: (msg: string) => void,
): Promise<ManifestTables> {
  onProgress?.('Checking manifest version…');

  const [cached, info] = await Promise.all([
    readCachedManifest(),
    bungieFetch<ManifestInfo>('/Platform/Destiny2/Manifest/'),
  ]);

  const version = info.version;

  if (cached?.version === version) {
    onProgress?.('Loaded manifest from local cache…');
    storeMemoryCache(cached.tables);
    return cached.tables;
  }

  if (cached?.tables) {
    onProgress?.('Using cached manifest (checking for updates)…');
    storeMemoryCache(cached.tables);
    void refreshManifestInBackground(info, cached.version);
    return cached.tables;
  }

  const tables = await downloadManifestTables(info, onProgress);
  storeMemoryCache(tables);
  onProgress?.('Caching manifest locally…');
  await writeManifestCache(version, tables);
  return tables;
}

export async function loadManifestTables(
  onProgress?: (msg: string) => void,
): Promise<ManifestTables> {
  if (memoryCache) {
    onProgress?.('Using cached manifest…');
    return memoryCache;
  }
  if (manifestLoadPromise) return manifestLoadPromise;

  manifestLoadPromise = loadManifestTablesInner(onProgress).finally(() => {
    manifestLoadPromise = null;
  });
  return manifestLoadPromise;
}
