import { slotLabel } from '@/i18n/gameCopy';
import {
  ALTAR_TUNING_MOD_PLUG_SET_HASH,
  ARCHETYPE_STATS,
  EMPTY_TUNING_MOD_SOCKET_HASH,
  MIN_TIERABLE_GEAR_TIER,
} from '@/lib/constants';
import type { ManifestItemDef } from '@/lib/bungie/manifest';
import { validateTierIntrinsicStats } from '@/lib/armor/intrinsicStats';
import type { Archetype, ArmorPiece, Stat } from '@/types';

/** Minimum archetype+tertiary focus sum for genuine T5 (Disaster Corps–style specialist chest). */
export const T5_MIN_FOCUS_STAT_SUM = 45;

export interface ArmorIntrinsicTierContext {
  baseStats: Partial<Record<Stat, number>>;
  tertiaryStat: Stat;
  archetype: Archetype;
}

/** Bungie instance gearTier is 1-5 on altar-tier armor; 0/missing = unknown tier. */
export function isValidGearTier(tier: number): boolean {
  return Number.isFinite(tier) && tier >= 1 && tier <= 5;
}

/** Parse explicit Bungie instance gearTier when present. */
export function parseGearTier(raw: number | null | undefined): number | null {
  if (raw != null && raw !== 0 && isValidGearTier(raw)) return raw;
  return null;
}

/**
 * Altar-tier armor (Edge of Fate) exposes a tuning mod socket in the item definition.
 * Legacy Armor 3.0 (e.g. Great Hunt) uses a normal mod socket instead.
 */
export function itemDefHasAltarTuningSocket(
  itemDef: Pick<ManifestItemDef, 'sockets'>,
): boolean {
  for (const entry of itemDef.sockets?.socketEntries ?? []) {
    if (entry.reusablePlugSetHash === ALTAR_TUNING_MOD_PLUG_SET_HASH) return true;
    if (entry.singleInitialItemHash === EMPTY_TUNING_MOD_SOCKET_HASH) return true;
  }
  return false;
}

/** Sum of archetype primary, secondary, and tertiary intrinsic focus lines. */
export function focusStatSumForPiece(
  baseStats: Partial<Record<Stat, number>>,
  archetype: Archetype,
  tertiaryStat: Stat,
): number {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  return (
    (baseStats[primary] ?? 0) +
    (baseStats[secondary] ?? 0) +
    (baseStats[tertiaryStat] ?? 0)
  );
}

/**
 * True when parsed intrinsics match Edge-of-Fate tier-5 roll shape (multiples-of-5 primaries, min budget).
 */
export function intrinsicSupportsT5Label(
  baseStats: Partial<Record<Stat, number>>,
  tertiaryStat: Stat,
  archetype: Archetype,
): boolean {
  const validation = validateTierIntrinsicStats(5, baseStats, tertiaryStat, archetype);
  if (!validation.valid) return false;
  return focusStatSumForPiece(baseStats, archetype, tertiaryStat) >= T5_MIN_FOCUS_STAT_SUM;
}

/** Confirmed tier from Bungie gearTier + parsed intrinsics (T5 requires valid roll shape). */
export function tierForIntrinsicRoll(
  gearTier: number,
  intrinsic: ArmorIntrinsicTierContext,
): number | null {
  if (!isValidGearTier(gearTier)) return null;
  if (gearTier < 5) return gearTier;
  return intrinsicSupportsT5Label(
    intrinsic.baseStats,
    intrinsic.tertiaryStat,
    intrinsic.archetype,
  )
    ? 5
    : null;
}

/**
 * Display/import tier: altar instance gearTier, with T5 gated on intrinsic roll shape.
 * Legacy armor always null. Without intrinsic context, raw gearTier is returned unchanged.
 */
export function resolveArmorTier(
  altarTierable: boolean,
  rawGearTier: number | null | undefined,
  intrinsic?: ArmorIntrinsicTierContext,
): number | null {
  if (!altarTierable) return null;
  const parsed = parseGearTier(rawGearTier);
  if (parsed == null) return null;
  if (!intrinsic) return parsed;
  return tierForIntrinsicRoll(parsed, intrinsic);
}

export function hasDisplayTier(tier: number | null | undefined): tier is number {
  return tier != null && isValidGearTier(tier);
}

/** True when an item should be excluded by minGearTier dupe/scope filters. */
export function isBelowMinGearTier(
  tier: number | null | undefined,
  minGearTier = MIN_TIERABLE_GEAR_TIER,
): boolean {
  return tier != null && tier < minGearTier;
}

export function formatArmorTierSubtitle(tier: number | null | undefined): string | null {
  if (!hasDisplayTier(tier)) return null;
  return `Tier ${tier}`;
}

export function formatArmorTierBadge(tier: number | null | undefined): string | null {
  if (!hasDisplayTier(tier)) return null;
  return `T${tier}`;
}

export function buildArmorSubtitle(
  piece: Pick<ArmorPiece, 'tier' | 'armorSlot' | 'armorSet'>,
): string {
  const parts = [
    formatArmorTierSubtitle(piece.tier),
    slotLabel(piece.armorSlot),
    piece.armorSet?.name,
  ].filter(Boolean);
  return parts.join(' · ');
}
