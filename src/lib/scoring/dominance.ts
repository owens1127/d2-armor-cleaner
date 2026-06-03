import type { ArmorPiece, ClassPreferenceProfile, RedundantPeerScope, Stat } from '@/types';
import { statLabel } from '@/i18n/gameCopy';
import { ARCHETYPE_STATS, STATS } from '@/lib/constants';
import { wornStatsEqual } from '@/lib/armor/effectiveStats';
import {
  budgetRelevantIntrinsicStats,
  intrinsicStatDeltas,
  intrinsicStats,
  intrinsicStatsEqual,
  type IntrinsicStatDelta,
} from '@/lib/armor/intrinsicCompare';
import { tuningPermutations } from '@/lib/armor/tuning';
import { armorComparisonPeers } from '@/lib/scoring/peerScope';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import { sortByRedundantKeepPriority } from '@/lib/scoring/redundantKeepPriority';

export type StatBeat = IntrinsicStatDelta;

export interface DominatorResult {
  dominator: ArmorPiece;
  beatsOn: StatBeat[];
}

function dominanceConfigurations(item: ArmorPiece): Partial<Record<Stat, number>>[] {
  return tuningPermutations(item, { statsBase: intrinsicStats(item) });
}

function withStatConfigurations(items: ArmorPiece[]): ArmorPiece[] {
  return items.map((i) =>
    i.statConfigurations
      ? i
      : { ...i, statConfigurations: dominanceConfigurations(i) },
  );
}

/** Roll lines that are comparable for beat summaries (archetype primaries + tertiary). */
export function comparableBeatStats(piece: ArmorPiece): Stat[] {
  const [primary, secondary] = ARCHETYPE_STATS[piece.archetype];
  return [primary, secondary, piece.tertiaryStat];
}

/** @deprecated Use budgetRelevantIntrinsicStats from intrinsicCompare. */
export const budgetRelevantStats = budgetRelevantIntrinsicStats;

/** Signed intrinsic-roll deltas on comparable budget lines. */
export const comparableStatDeltas = intrinsicStatDeltas;

/** @deprecated Alias of intrinsicStatDeltas: comparisons use intrinsicStats only. */
export const comparableIntrinsicStatDeltas = intrinsicStatDeltas;

/** Full signed deltas on comparable roll lines (alias of intrinsicStatDeltas). */
export const dominatorBeatStats = intrinsicStatDeltas;

/** True when dominator is ≥ candidate on every intrinsic budget line and strictly > on at least one. */
export function baseComparableDominates(
  dominator: ArmorPiece,
  candidate: ArmorPiece,
): boolean {
  if (dominator.tertiaryStat !== candidate.tertiaryStat) return false;

  let strictlyHigher = false;
  for (const stat of budgetRelevantIntrinsicStats(dominator, candidate)) {
    const dv = intrinsicStats(dominator)[stat] ?? 0;
    const cv = intrinsicStats(candidate)[stat] ?? 0;
    if (cv > dv) return false;
    if (dv > cv) strictlyHigher = true;
  }
  return strictlyHigher;
}

/** @deprecated Use baseComparableDominates: comparisons use intrinsicStats only. */
export const effectiveComparableDominates = baseComparableDominates;

/** True when the peer wins at least one comparable line (T5 budget tradeoff, not strict stat-lower). */
export function hasDifferentStatSplit(beats: StatBeat[]): boolean {
  return beats.some((b) => b.delta < 0);
}

/**
 * True when dominator wins on exactly one budget line with no offsetting losses.
 * T5 fixed budget: a lone +10 Weapons without -10 elsewhere is a sidegrade, not junk.
 */
export function isSingleStatSidegrade(
  dominator: ArmorPiece,
  candidate: ArmorPiece,
): boolean {
  const beats = intrinsicStatDeltas(dominator, candidate);
  if (hasDifferentStatSplit(beats)) return false;
  return beats.filter((b) => b.delta > 0).length === 1;
}

/** Stat-lower dismantle: tuning coverage, full-budget dominance, no tradeoff or lone-stat sidegrade. */
export function qualifiesAsStatLowerDominator(
  dominator: ArmorPiece,
  candidate: ArmorPiece,
): boolean {
  const comparable = budgetRelevantIntrinsicStats(dominator, candidate);
  if (wornStatsEqual(dominator, candidate, comparable)) return false;
  if (intrinsicStatsEqual(dominator, candidate, comparable)) return false;
  if (!itemStatLowerDominates(dominator, candidate)) return false;
  if (!baseComparableDominates(dominator, candidate)) return false;
  if (isSingleStatSidegrade(dominator, candidate)) return false;
  return true;
}

export function formatBeatsOn(beats: StatBeat[]): string {
  const nonzero = beats.filter((b) => b.delta !== 0);
  if (nonzero.length === 0) {
    return beats.length > 0 ? 'same on all stats' : 'every tuning config';
  }
  const wins = nonzero.filter((b) => b.delta > 0);
  const losses = nonzero.filter((b) => b.delta < 0);
  const parts = [
    ...wins.map((b) => `${statLabel(b.stat)} +${b.delta}`),
    ...losses.map((b) => `${statLabel(b.stat)} ${b.delta}`),
  ];
  return parts.join(' · ');
}

/** True when tuning layouts cover the candidate but no comparable line is strictly higher. */
export function dominatesAfterTuningOnly(
  dominator: ArmorPiece,
  candidate: ArmorPiece,
): boolean {
  return (
    itemStatLowerDominates(dominator, candidate) &&
    !baseComparableDominates(dominator, candidate)
  );
}

/** Peers that can dominate `candidate`: same class, slot, archetype, tertiary, and armor set. */
export function dominatorPeers(
  candidate: ArmorPiece,
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
): ArmorPiece[] {
  return armorComparisonPeers(candidate, items, scope);
}

/** Among stat-lower dominators, keep only those not dominated by another dominator. */
function maximalStatLowerDominators(
  candidate: ArmorPiece,
  peers: ArmorPiece[],
): ArmorPiece[] {
  const dominators = peers.filter((other) =>
    qualifiesAsStatLowerDominator(other, candidate),
  );
  return dominators.filter(
    (d) =>
      !dominators.some(
        (other) =>
          other.instanceId !== d.instanceId &&
          qualifiesAsStatLowerDominator(other, d),
      ),
  );
}

function pickBestDominator(
  candidate: ArmorPiece,
  peers: ArmorPiece[],
  prefs?: ClassPreferenceProfile,
): ArmorPiece | null {
  const maximal = maximalStatLowerDominators(candidate, peers);
  if (maximal.length === 0) return null;
  const effectivePrefs = prefs ?? defaultClassPreferenceProfile();
  return sortByRedundantKeepPriority(maximal, effectivePrefs)[0] ?? null;
}

/** First peer that stat-lower-dominates `candidate`, or null. */
export function findDominator(
  candidate: ArmorPiece,
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): DominatorResult | null {
  const pool = withStatConfigurations(dominatorPeers(candidate, items, scope));
  const [prepared] = withStatConfigurations([candidate]);
  const other = pickBestDominator(prepared, pool, prefs);
  if (!other) return null;
  return {
    dominator: other,
    beatsOn: dominatorBeatStats(other, prepared),
  };
}

/** Map from dominated instanceId → dominator proof (best keeper among dominators). */
export function findDominatorsMap(
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): Map<string, DominatorResult> {
  const prepared = withStatConfigurations(items);
  const map = new Map<string, DominatorResult>();
  for (const candidate of prepared) {
    const peers = armorComparisonPeers(candidate, prepared, scope);
    const other = pickBestDominator(candidate, peers, prefs);
    if (!other) continue;
    map.set(candidate.instanceId, {
      dominator: other,
      beatsOn: dominatorBeatStats(other, candidate),
    });
  }
  return map;
}

/** True if `lower` is Pareto-dominated by `higher` (≥ all stats, > at least one). */
export function configDominates(
  higher: Partial<Record<Stat, number>>,
  lower: Partial<Record<Stat, number>>,
): boolean {
  let strictlyHigher = false;
  for (const stat of STATS) {
    const hv = higher[stat] ?? 0;
    const lv = lower[stat] ?? 0;
    if (hv < lv) return false;
    if (hv > lv) strictlyHigher = true;
  }
  return strictlyHigher;
}

/**
 * B stat-lower-dominates A when for every tuning config of A,
 * B has some config that Pareto-dominates it.
 */
export function itemStatLowerDominates(
  dominator: ArmorPiece,
  candidate: ArmorPiece,
): boolean {
  if (dominator.instanceId === candidate.instanceId) return false;
  const domConfigs = dominator.statConfigurations ?? dominanceConfigurations(dominator);
  const candConfigs = candidate.statConfigurations ?? dominanceConfigurations(candidate);

  for (const candCfg of candConfigs) {
    let covered = false;
    for (const domCfg of domConfigs) {
      if (configDominates(domCfg, candCfg)) {
        covered = true;
        break;
      }
    }
    if (!covered) return false;
  }
  return candConfigs.length > 0;
}

/** @deprecated Use itemStatLowerDominates: kept for simple base-stat checks. */
export function isStrictlyStatLower(
  a: Partial<Record<Stat, number>>,
  b: Partial<Record<Stat, number>>,
): boolean {
  return configDominates(b, a);
}

export function findStrictlyDominatedIds(
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): Set<string> {
  return new Set(findDominatorsMap(items, scope, prefs).keys());
}

export function autoJunkCandidates(
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): ArmorPiece[] {
  const dominated = findStrictlyDominatedIds(items, scope, prefs);
  return items.filter((i) => dominated.has(i.instanceId));
}
