import type { Stat } from '@/types';
import type { ManifestTables } from '@/lib/bungie/manifest';
import { ARCHETYPE_STATS, STATS, STAT_HASH_TO_STAT } from '@/lib/constants';
import { MASTERWORK_STAT_BONUS } from '@/lib/armor/effectiveStats';

type SocketEntry = { plugHash?: number; isVisible?: boolean };

type PlugDef = {
  investmentStats?: { statTypeHash: number; value: number }[];
};

function getPlugDef(manifest: ManifestTables, plugHash?: number): PlugDef | undefined {
  if (!plugHash) return undefined;
  return manifest.items[String(plugHash)] as PlugDef | undefined;
}

/** +N all-stats mods apply the same value to every rolled line. */
export function isAllStatsModPlug(plug: PlugDef | undefined): boolean {
  const inv = plug?.investmentStats ?? [];
  if (inv.length < 2) return false;
  const value = inv[0].value;
  return inv.every((s) => s.value === value);
}

export function isMasterworkEnhancementPlug(plug: PlugDef | undefined): boolean {
  const inv = plug?.investmentStats ?? [];
  return inv.length > 0 && inv.every((s) => s.value === MASTERWORK_STAT_BONUS);
}

/** T5 hidden roll fragment values: multiples of 5, or 3 on tertiary focus. */
export function isHiddenRollStatValue(value: number): boolean {
  return value % 5 === 0 || value === 3;
}

/** Hidden socket stat mod (+6, +8, etc.): not an intrinsic roll fragment. */
export function isHiddenStatModPlug(plug: PlugDef | undefined): boolean {
  const inv = plug?.investmentStats ?? [];
  if (inv.length === 0) return false;
  if (isAllStatsModPlug(plug)) return true;
  if (inv.length === 1) return !isHiddenRollStatValue(inv[0].value);
  return false;
}

/** Hidden socket roll fragment (tier5 `w4`); excludes MW, all-stat mods, and hidden stat mods. */
export function isHiddenIntrinsicRollPlug(
  socket: SocketEntry,
  plug: PlugDef | undefined,
): boolean {
  if (socket.isVisible !== false) return false;
  const inv = plug?.investmentStats ?? [];
  if (inv.length === 0) return false;
  if (isMasterworkEnhancementPlug(plug)) return false;
  if (isAllStatsModPlug(plug)) return false;
  if (inv.length === 1) return isHiddenRollStatValue(inv[0].value);
  return inv.every((s) => isHiddenRollStatValue(s.value));
}

/**
 * Intrinsic roll from hidden socket plugs only (tier5.report `w4`).
 * Visible sockets (archetype, mods, MW) are excluded.
 */
export function intrinsicStatsFromHiddenPlugs(
  manifest: ManifestTables,
  sockets?: SocketEntry[],
): Partial<Record<Stat, number>> {
  const stats: Partial<Record<Stat, number>> = {};
  for (const socket of sockets ?? []) {
    if (socket.isVisible !== false) continue;
    const plug = getPlugDef(manifest, socket.plugHash);
    if (!isHiddenIntrinsicRollPlug(socket, plug)) continue;
    for (const inv of plug?.investmentStats ?? []) {
      const stat = STAT_HASH_TO_STAT[inv.statTypeHash];
      if (stat) stats[stat] = (stats[stat] ?? 0) + inv.value;
    }
  }
  return stats;
}

export interface TierIntrinsicValidation {
  valid: boolean;
  warnings: string[];
}

/**
 * Tier 4+ primaries/secondaries should land on multiples of 5; tertiary focus may be 3.
 */
export function validateTierIntrinsicStats(
  tier: number,
  baseStats: Partial<Record<Stat, number>>,
  tertiaryStat: Stat | undefined,
  archetype: keyof typeof ARCHETYPE_STATS,
): TierIntrinsicValidation {
  if (tier < 4) return { valid: true, warnings: [] };
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  const warnings: string[] = [];
  for (const stat of statsOnPiece(baseStats)) {
    const value = baseStats[stat] ?? 0;
    if (stat === tertiaryStat && value <= 5) continue;
    if (stat !== primary && stat !== secondary && stat !== tertiaryStat) continue;
    if (value % 5 !== 0) {
      warnings.push(`${stat}=${value}`);
    }
  }
  return { valid: warnings.length === 0, warnings };
}

function countPositiveStatLines(stats: Partial<Record<Stat, number>>): number {
  return Object.values(stats).filter((value) => (value ?? 0) > 0).length;
}

/**
 * Impossible T5 intrinsic: e.g. 0/0/5 when wear fallback decomposes sparse 304 without hidden plugs.
 * Does not reject valid two-stat specialist profiles where secondary focus is absent on the piece.
 */
export function isDegenerateIntrinsicRoll(
  tier: number,
  baseStats: Partial<Record<Stat, number>>,
  archetype: keyof typeof ARCHETYPE_STATS,
): boolean {
  if (tier < 4) return false;
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  const primaryVal = baseStats[primary] ?? 0;
  const secondaryVal = baseStats[secondary] ?? 0;
  const positiveCount = countPositiveStatLines(baseStats);
  if (positiveCount === 0) return true;
  if (primaryVal === 0 && secondaryVal === 0) return true;
  return false;
}

function statsOnPiece(stats: Partial<Record<Stat, number>>): Stat[] {
  return STATS.filter((s) => (stats[s] ?? 0) > 0);
}

export function subtractModStatsFromTotals(
  totals: Partial<Record<Stat, number>>,
  mods: Partial<Record<Stat, number>>,
): Partial<Record<Stat, number>> {
  const out = { ...totals };
  for (const stat of STATS) {
    const mod = mods[stat] ?? 0;
    if (!mod) continue;
    out[stat] = Math.max(0, (out[stat] ?? 0) - mod);
  }
  return out;
}

/** Remove masterwork +2 from each rolled stat line (instance.isMasterwork). */
export function subtractMasterworkFromTotals(
  totals: Partial<Record<Stat, number>>,
  isMasterwork: boolean,
): Partial<Record<Stat, number>> {
  if (!isMasterwork) return { ...totals };
  const out = { ...totals };
  for (const stat of statsOnPiece(out)) {
    out[stat] = Math.max(0, (out[stat] ?? 0) - MASTERWORK_STAT_BONUS);
  }
  return out;
}

/**
 * Profile/socket displayed totals → intrinsic roll.
 * Subtracts equipped stat mods (socket investmentStats) then masterwork bonus.
 */
export function intrinsicStatsFromDisplayed(
  displayed: Partial<Record<Stat, number>>,
  modStats: Partial<Record<Stat, number>>,
  isMasterwork: boolean,
): Partial<Record<Stat, number>> {
  return subtractMasterworkFromTotals(
    subtractModStatsFromTotals(displayed, modStats),
    isMasterwork,
  );
}

export interface ReconciledWearStats {
  baseStats: Partial<Record<Stat, number>>;
  modStats: Partial<Record<Stat, number>>;
}

/**
 * Align socket mod totals with ItemStats (304) worn totals.
 * Closes gaps when equipped mods are on non-visible sockets or missing from manifest.
 */
export function reconcileWearStats(
  displayed: Partial<Record<Stat, number>>,
  socketMods: Partial<Record<Stat, number>>,
  isMasterwork: boolean,
): ReconciledWearStats {
  const modStats = { ...socketMods };
  let baseStats = intrinsicStatsFromDisplayed(displayed, modStats, isMasterwork);

  for (const stat of statsOnPiece(displayed)) {
    const worn = displayed[stat] ?? 0;
    const intrinsic = baseStats[stat] ?? 0;
    const mwBonus = isMasterwork && intrinsic > 0 ? MASTERWORK_STAT_BONUS : 0;
    const modBonus = modStats[stat] ?? 0;
    const rebuilt = intrinsic + mwBonus + modBonus;
    if (rebuilt !== worn) {
      modStats[stat] = Math.max(0, worn - intrinsic - mwBonus);
      baseStats = intrinsicStatsFromDisplayed(displayed, modStats, isMasterwork);
    }
  }

  return { baseStats, modStats };
}

export {
  budgetRelevantIntrinsicStats,
  intrinsicStatDelta,
  intrinsicStatDeltas,
  intrinsicStats,
  intrinsicStatsEqual,
  rollStats,
  sameIntrinsicRoll,
  type IntrinsicStatDelta,
} from './intrinsicCompare';
