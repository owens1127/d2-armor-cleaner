import type { DimItemTagState } from '@/lib/dim/parseTags';
import type { ArmorPiece, Stat, Archetype } from '@/types';
import type { ManifestItemDef, ManifestTables } from '@/lib/bungie/manifest';
import type { ProfileItemComponents, RawInventoryItem } from '@/lib/bungie/profile';
import {
  intrinsicStatsFromDisplayed,
  intrinsicStatsFromHiddenPlugs,
  isDegenerateIntrinsicRoll,
  isHiddenIntrinsicRollPlug,
  isMasterworkEnhancementPlug,
  reconcileWearStats,
  validateTierIntrinsicStats,
} from '@/lib/armor/intrinsicStats';
import { countUniqueMappedProfileStats } from '@/lib/armor/profileStats';
import {
  ARCHETYPES,
  ARCHETYPE_STATS,
  BUCKET_TO_SLOT,
  BUNGIE_CLASS_TO_TYPE,
  PLUG_TO_ARCHETYPE,
  POSTMASTER_BUCKET,
  STAT_HASH_TO_STAT,
  TUNING_PLUG_TO_STAT,
  VAULT_BUCKET,
} from '@/lib/constants';
import {
  itemDefHasAltarTuningSocket,
  parseGearTier,
  resolveArmorTier,
} from '@/lib/armor/tier';

function isArchetypePlug(plugHash?: number): boolean {
  return plugHash != null && plugHash in PLUG_TO_ARCHETYPE;
}

function isTuningPlug(plugHash?: number): boolean {
  return plugHash != null && plugHash in TUNING_PLUG_TO_STAT;
}

type PlugDef = {
  investmentStats?: { statTypeHash: number; value: number }[];
};

export interface ParseSkipReasons {
  noInstanceId: number;
  notInManifest: number;
  notArmorSlot: number;
  notLegendary: number;
  noClass: number;
  noArchetype: number;
  noGearTier: number;
  noTertiary: number;
}

/** User-facing labels for parse diagnostics (keys stay stable in telemetry). */
export const PARSE_SKIP_LABELS: Record<keyof ParseSkipReasons, string> = {
  noInstanceId: 'no instance id',
  notInManifest: 'not in manifest',
  notArmorSlot: 'not armor slot',
  notLegendary: 'not legendary',
  noClass: 'no class',
  noArchetype: 'no archetype',
  noGearTier: 'untiered',
  noTertiary: 'no tertiary',
};

export function formatParseSkipReason(key: keyof ParseSkipReasons): string {
  return PARSE_SKIP_LABELS[key];
}

/** Armor set display from manifest item + set tables (locale-specific names). */
export function resolveArmorSetFromManifest(
  itemDef: ManifestItemDef,
  manifest: ManifestTables,
): ArmorPiece['armorSet'] | undefined {
  const setHash = itemDef.equippingBlock?.equipableItemSetHash;
  if (!setHash) return undefined;
  const setDef = manifest.itemSets[String(setHash)];
  if (!setDef) return undefined;
  return {
    hash: setHash,
    name: setDef.displayProperties.name,
    perks: setDef.setPerks.map((p, index) => {
      const perk = manifest.sandboxPerks[String(p.sandboxPerkHash)];
      const required = p.requiredSetCount;
      const pieces =
        required === 2 || required === 4 ? required : (((index + 1) * 2) as 2 | 4);
      return {
        name: perk?.displayProperties.name ?? 'Set perk',
        description: perk?.displayProperties.description ?? '',
        icon: perk?.displayProperties.icon,
        pieces,
      };
    }),
  };
}

export interface ParseDiagnostics {
  rawItems: number;
  legendaryArmor: number;
  withGearTier: number;
  withArchetype: number;
  withTertiary: number;
  inferredArchetype: number;
  inferredTertiary: number;
  parsed: number;
  skipped: ParseSkipReasons;
}

function emptySkipReasons(): ParseSkipReasons {
  return {
    noInstanceId: 0,
    notInManifest: 0,
    notArmorSlot: 0,
    notLegendary: 0,
    noClass: 0,
    noArchetype: 0,
    noGearTier: 0,
    noTertiary: 0,
  };
}

function getPlugDef(manifest: ManifestTables, plugHash?: number): PlugDef | undefined {
  if (!plugHash) return undefined;
  return manifest.items[String(plugHash)] as PlugDef | undefined;
}

function statsFromSockets(
  manifest: ManifestTables,
  sockets?: { plugHash?: number; isVisible?: boolean }[],
): Partial<Record<Stat, number>> {
  const stats: Partial<Record<Stat, number>> = {};
  for (const socket of sockets ?? []) {
    const plug = getPlugDef(manifest, socket.plugHash);
    for (const inv of plug?.investmentStats ?? []) {
      const stat = STAT_HASH_TO_STAT[inv.statTypeHash];
      if (stat) stats[stat] = (stats[stat] ?? 0) + inv.value;
    }
  }
  return stats;
}

/** Equipped stat mod bonuses (excludes archetype, hidden roll fragments, MW). */
function modStatsFromSockets(
  manifest: ManifestTables,
  sockets?: { plugHash?: number; isVisible?: boolean }[],
): Partial<Record<Stat, number>> {
  const stats: Partial<Record<Stat, number>> = {};
  for (const socket of sockets ?? []) {
    const plugHash = socket.plugHash;
    if (isArchetypePlug(plugHash) || isTuningPlug(plugHash)) continue;
    const plug = getPlugDef(manifest, plugHash);
    if (isMasterworkEnhancementPlug(plug)) continue;
    if (isHiddenIntrinsicRollPlug(socket, plug)) continue;
    for (const inv of plug?.investmentStats ?? []) {
      const stat = STAT_HASH_TO_STAT[inv.statTypeHash];
      if (stat) stats[stat] = (stats[stat] ?? 0) + inv.value;
    }
  }
  return stats;
}

function masterworkFromSockets(
  manifest: ManifestTables,
  sockets?: { plugHash?: number; isVisible?: boolean }[],
): boolean {
  for (const socket of sockets ?? []) {
    if (isMasterworkEnhancementPlug(getPlugDef(manifest, socket.plugHash))) return true;
  }
  return false;
}

function statsFromItemComponent(
  itemStats?: { stats?: Record<string, { statHash: number; value: number }> },
): Partial<Record<Stat, number>> {
  const stats: Partial<Record<Stat, number>> = {};
  for (const entry of Object.values(itemStats?.stats ?? {})) {
    const stat = STAT_HASH_TO_STAT[entry.statHash];
    if (stat && entry.value > 0) {
      stats[stat] = Math.max(stats[stat] ?? 0, entry.value);
    }
  }
  return stats;
}

function archetypeFromPlugHash(plugHash?: number): Archetype | undefined {
  return PLUG_TO_ARCHETYPE[plugHash ?? -1];
}

function archetypeFromSockets(
  sockets?: { plugHash?: number }[],
): Archetype | undefined {
  for (const socket of sockets ?? []) {
    const arch = archetypeFromPlugHash(socket.plugHash);
    if (arch) return arch;
  }
  return undefined;
}

function archetypeFromReusablePlugs(
  plugs?: Record<string, { plugItemHash: number }[]>,
): Archetype | undefined {
  if (!plugs) return undefined;
  for (const socketPlugs of Object.values(plugs)) {
    for (const { plugItemHash } of socketPlugs) {
      const arch = archetypeFromPlugHash(plugItemHash);
      if (arch) return arch;
    }
  }
  return undefined;
}

/** Best-fit archetype from rolled stat totals (DIM-style when socket plugs are missing). */
export function archetypeFromStatPattern(
  stats: Partial<Record<Stat, number>>,
): Archetype | undefined {
  const positive = Object.entries(stats).filter(([, v]) => v > 0) as [Stat, number][];
  if (positive.length < 3) return undefined;

  let best: { arch: Archetype; score: number } | undefined;
  for (const arch of ARCHETYPES) {
    const [primary, secondary] = ARCHETYPE_STATS[arch];
    const primaryVal = stats[primary] ?? 0;
    const secondaryVal = stats[secondary] ?? 0;
    const tertiaryVals = positive
      .filter(([st]) => st !== primary && st !== secondary)
      .map(([, v]) => v);
    const tertiaryVal = tertiaryVals.length ? Math.min(...tertiaryVals) : 0;
    const score = primaryVal * 3 + secondaryVal * 2 - tertiaryVal;
    if (!best || score > best.score) best = { arch, score };
  }
  return best?.arch;
}

function resolveArchetype(
  socketData: { plugHash?: number }[] | undefined,
  reusable?: { plugs?: Record<string, { plugItemHash: number }[]> },
  displayedStats: Partial<Record<Stat, number>> = {},
): { archetype?: Archetype; inferred: boolean } {
  const fromSockets = archetypeFromSockets(socketData);
  if (fromSockets) return { archetype: fromSockets, inferred: false };

  const fromReusable = archetypeFromReusablePlugs(reusable?.plugs);
  if (fromReusable) return { archetype: fromReusable, inferred: false };

  const fromStats = archetypeFromStatPattern(displayedStats);
  if (fromStats) return { archetype: fromStats, inferred: true };

  return { inferred: false };
}

function tertiaryFromStats(
  archetype: Archetype,
  stats: Partial<Record<Stat, number>>,
): Stat | undefined {
  const focus = new Set<Stat>(ARCHETYPE_STATS[archetype]);
  const candidates = Object.entries(stats)
    .filter(([stat, val]) => val > 0 && !focus.has(stat as Stat))
    .map(([stat, val]) => ({ stat: stat as Stat, val }));

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0].stat;
  // Tertiary is the lowest-weight stat on the piece
  candidates.sort((a, b) => a.val - b.val);
  return candidates[0].stat;
}

function tertiaryFromStatsRelaxed(
  archetype: Archetype,
  stats: Partial<Record<Stat, number>>,
): Stat | undefined {
  const direct = tertiaryFromStats(archetype, stats);
  if (direct) return direct;
  const positive = Object.entries(stats).filter(([, v]) => v > 0) as [Stat, number][];
  if (positive.length === 0) return undefined;
  positive.sort((a, b) => a[1] - b[1]);
  return positive[0][0];
}

function tuningFromReusablePlugs(
  plugs?: Record<string, { plugItemHash: number }[]>,
): Stat | undefined {
  if (!plugs) return undefined;
  for (const socketPlugs of Object.values(plugs)) {
    for (const { plugItemHash } of socketPlugs) {
      const stat = TUNING_PLUG_TO_STAT[plugItemHash];
      if (stat) return stat;
    }
  }
  return undefined;
}

function locationFromItem(item: RawInventoryItem): ArmorPiece['location'] {
  if (item.bucketHash === POSTMASTER_BUCKET) return 'postmaster';
  if (item.bucketHash === VAULT_BUCKET || item.location === 2) return 'vault';
  if (item.location === 1) return 'character';
  if (item.location === 4) return 'postmaster';
  return 'character';
}

function countPositiveStatLines(stats: Partial<Record<Stat, number>>): number {
  return Object.values(stats).filter((value) => (value ?? 0) > 0).length;
}

/** Prefer full bulk 304 rolls; fall back to socket investmentStats when 304 is partial. */
function pickDisplayedStatTotals(
  profileStatTotals: Partial<Record<Stat, number>>,
  socketStatTotals: Partial<Record<Stat, number>>,
  itemStatData?: { stats?: Record<string, { statHash: number; value: number }> },
): Partial<Record<Stat, number>> {
  const profileUnique = countPositiveStatLines(profileStatTotals);
  const socketUnique = countPositiveStatLines(socketStatTotals);
  const mappedUnique = countUniqueMappedProfileStats(itemStatData);

  if (mappedUnique >= 3 && profileUnique >= 3) return profileStatTotals;
  if (socketUnique > profileUnique) return socketStatTotals;
  if (profileUnique > 0) return profileStatTotals;
  return socketStatTotals;
}

type ResolvedLegendaryArmorRollFailure = {
  skip: 'noArchetype' | 'noTertiary' | 'invalidIntrinsic';
};

type ResolvedLegendaryArmorRollSuccess = {
  displayedTotals: Partial<Record<Stat, number>>;
  isMasterwork: boolean;
  socketModStats: Partial<Record<Stat, number>>;
  archetype: Archetype;
  archetypeInferred: boolean;
  baseStats: Partial<Record<Stat, number>>;
  modStats?: Partial<Record<Stat, number>>;
  tertiaryStat: Stat;
  tertiaryInferred: boolean;
};

type ResolvedLegendaryArmorRoll =
  | ResolvedLegendaryArmorRollFailure
  | ResolvedLegendaryArmorRollSuccess;

function resolveLegendaryArmorRoll(
  item: RawInventoryItem,
  components: ProfileItemComponents,
  manifest: ManifestTables,
): ResolvedLegendaryArmorRoll | undefined {
  if (!item.itemInstanceId) return undefined;

  const instance = components.instances?.[item.itemInstanceId];
  const socketData = components.sockets?.[item.itemInstanceId]?.sockets;
  const reusablePlugs = components.reusablePlugs?.[item.itemInstanceId];
  const itemStatData = components.stats?.[item.itemInstanceId];
  const gearTier = parseGearTier(instance?.gearTier);

  const isMasterwork =
    (instance?.isMasterwork ?? false) || masterworkFromSockets(manifest, socketData);
  const profileStatTotals = statsFromItemComponent(itemStatData);
  const socketStatTotals = statsFromSockets(manifest, socketData);
  const displayedTotals = pickDisplayedStatTotals(
    profileStatTotals,
    socketStatTotals,
    itemStatData,
  );
  const socketModStats = modStatsFromSockets(manifest, socketData);
  const hiddenBaseStats = intrinsicStatsFromHiddenPlugs(manifest, socketData);
  const statsForArchetype =
    countPositiveStatLines(hiddenBaseStats) >= 3 ? hiddenBaseStats : displayedTotals;

  const { archetype, inferred: archetypeInferred } = resolveArchetype(
    socketData,
    reusablePlugs,
    statsForArchetype,
  );
  if (!archetype) return { skip: 'noArchetype' };

  let baseStats = hiddenBaseStats;
  let reconciledModStats = socketModStats;
  let usedWearFallback = false;

  if (countPositiveStatLines(baseStats) < 3) {
    ({ baseStats, modStats: reconciledModStats } = reconcileWearStats(
      displayedTotals,
      socketModStats,
      isMasterwork,
    ));
    usedWearFallback = true;
  }

  let tertiaryDirect = tertiaryFromStats(archetype, baseStats);
  let tertiaryStat = tertiaryDirect ?? tertiaryFromStatsRelaxed(archetype, baseStats);

  if (
    !tertiaryStat &&
    countPositiveStatLines(displayedTotals) >= 3
  ) {
    baseStats = intrinsicStatsFromDisplayed(displayedTotals, {}, isMasterwork);
    reconciledModStats = socketModStats;
    usedWearFallback = true;
    tertiaryDirect = tertiaryFromStats(archetype, baseStats);
    tertiaryStat = tertiaryDirect ?? tertiaryFromStatsRelaxed(archetype, baseStats);
  }

  if (!tertiaryStat) return { skip: 'noTertiary' };

  if (
    gearTier != null &&
    isDegenerateIntrinsicRoll(gearTier, baseStats, archetype)
  ) {
    if (countPositiveStatLines(hiddenBaseStats) >= 3) {
      baseStats = hiddenBaseStats;
      reconciledModStats = socketModStats;
      tertiaryDirect = tertiaryFromStats(archetype, baseStats);
      tertiaryStat = tertiaryDirect ?? tertiaryFromStatsRelaxed(archetype, baseStats);
    }
    if (
      !tertiaryStat ||
      isDegenerateIntrinsicRoll(gearTier, baseStats, archetype)
    ) {
      return { skip: 'invalidIntrinsic' };
    }
  }

  if (gearTier != null && gearTier >= 4) {
    const validation = validateTierIntrinsicStats(
      gearTier,
      baseStats,
      tertiaryStat,
      archetype,
    );
    if (!validation.valid) {
      const source = usedWearFallback ? 'ItemStats 304 fallback' : 'hidden socket plugs';
      console.warn(
        `[parse] T${gearTier} intrinsic not multiple-of-5 (${validation.warnings.join(', ')}) from ${source} on ${item.itemInstanceId}`,
      );
      if (usedWearFallback && countPositiveStatLines(hiddenBaseStats) >= 3) {
        const nextTertiary =
          tertiaryFromStats(archetype, hiddenBaseStats) ??
          tertiaryFromStatsRelaxed(archetype, hiddenBaseStats);
        if (nextTertiary) {
          baseStats = hiddenBaseStats;
          reconciledModStats = socketModStats;
          tertiaryDirect = tertiaryFromStats(archetype, baseStats);
          tertiaryStat = nextTertiary;
        }
      }
    }
  }

  const modStats =
    Object.keys(reconciledModStats).length > 0 ? reconciledModStats : undefined;

  return {
    displayedTotals,
    isMasterwork,
    socketModStats,
    archetype,
    archetypeInferred,
    baseStats,
    modStats,
    tertiaryStat,
    tertiaryInferred: !tertiaryDirect,
  };
}

/** True when GetItem should replace sparse or unparseable bulk ItemStats (304). */
export function legendaryArmorNeedsStatEnrichment(
  item: RawInventoryItem,
  components: ProfileItemComponents,
  manifest: ManifestTables,
): boolean {
  if (!item.itemInstanceId) return false;
  if (countUniqueMappedProfileStats(components.stats?.[item.itemInstanceId]) < 3) {
    return true;
  }

  const roll = resolveLegendaryArmorRoll(item, components, manifest);
  return !roll || 'skip' in roll;
}

export function parseArmorFromProfile(
  rawItems: RawInventoryItem[],
  components: ProfileItemComponents,
  manifest: ManifestTables,
  dimTags: Record<string, DimItemTagState | undefined> = {},
): { items: ArmorPiece[]; diagnostics: ParseDiagnostics } {
  const result: ArmorPiece[] = [];
  const diagnostics: ParseDiagnostics = {
    rawItems: rawItems.length,
    legendaryArmor: 0,
    withGearTier: 0,
    withArchetype: 0,
    withTertiary: 0,
    inferredArchetype: 0,
    inferredTertiary: 0,
    parsed: 0,
    skipped: emptySkipReasons(),
  };

  for (const item of rawItems) {
    if (!item.itemInstanceId) {
      diagnostics.skipped.noInstanceId++;
      continue;
    }
    const itemDef = manifest.items[String(item.itemHash)];
    if (!itemDef?.inventory) {
      diagnostics.skipped.notInManifest++;
      continue;
    }

    const slot = BUCKET_TO_SLOT[itemDef.inventory.bucketTypeHash];
    if (!slot) {
      diagnostics.skipped.notArmorSlot++;
      continue;
    }

    // Legendary armor only (tierType 5). Instance gearTier 1-5 = altar tier on tiered gear.
    if (itemDef.inventory.tierType !== 5) {
      diagnostics.skipped.notLegendary++;
      continue;
    }
    diagnostics.legendaryArmor++;

    const classType = BUNGIE_CLASS_TO_TYPE[itemDef.classType];
    if (!classType) {
      diagnostics.skipped.noClass++;
      continue;
    }

    const instance = components.instances?.[item.itemInstanceId];
    const reusablePlugs = components.reusablePlugs?.[item.itemInstanceId];

    const altarTierable = itemDefHasAltarTuningSocket(itemDef);
    if (!altarTierable) {
      diagnostics.skipped.noGearTier++;
      continue;
    }
    const gearTier = parseGearTier(instance?.gearTier);
    if (gearTier == null) {
      diagnostics.skipped.noGearTier++;
      continue;
    }
    diagnostics.withGearTier++;

    /*
     * Bungie profile components (see fetchProfileInventory in profile.ts):
     * - itemComponents.stats (304): displayed stat totals per item.
     * - itemComponents.sockets (305): equipped plugs; stat mods use investmentStats on plug defs.
     * - itemComponents.instances (300): isMasterwork (+2 on each rolled line), gearTier, power.
     * - itemComponents.reusablePlugs (310): tuning plugs.
     */
    const roll = resolveLegendaryArmorRoll(item, components, manifest);
    if (!roll || 'skip' in roll) {
      if (!roll || roll.skip === 'noArchetype') {
        diagnostics.skipped.noArchetype++;
      } else if (roll.skip === 'invalidIntrinsic') {
        diagnostics.skipped.noTertiary++;
      } else {
        diagnostics.skipped.noTertiary++;
      }
      continue;
    }

    const {
      archetype,
      archetypeInferred,
      baseStats,
      modStats,
      tertiaryStat,
      tertiaryInferred,
      isMasterwork,
    } = roll;
    diagnostics.withArchetype++;
    if (archetypeInferred) diagnostics.inferredArchetype++;
    diagnostics.withTertiary++;
    if (tertiaryInferred) diagnostics.inferredTertiary++;

    const tuningStat = tuningFromReusablePlugs(reusablePlugs?.plugs);

    const armorSet = resolveArmorSetFromManifest(itemDef, manifest);

    result.push({
      instanceId: item.itemInstanceId,
      itemHash: item.itemHash,
      name: itemDef.displayProperties.name,
      icon: itemDef.displayProperties.icon,
      classType,
      armorSlot: slot,
      tier: resolveArmorTier(true, gearTier, {
        baseStats,
        tertiaryStat,
        archetype,
      }),
      power: instance?.primaryStat?.value ?? 0,
      location: locationFromItem(item),
      archetype,
      baseStats,
      ...(modStats ? { modStats, modStatsAdditive: true } : {}),
      tertiaryStat,
      tuningStat,
      armorSet,
      isMasterwork,
      dimTag: dimTags[item.itemInstanceId]?.dimTag ?? null,
      dimFavorite: dimTags[item.itemInstanceId]?.dimFavorite ?? false,
    });
    diagnostics.parsed++;
  }

  return { items: result, diagnostics };
}
