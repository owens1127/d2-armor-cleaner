import type { ArmorPiece, ClassPreferenceProfile, RedundantPeerScope, Stat } from '@/types';
import { STATS } from '@/lib/constants';
import { intrinsicStatDeltas, intrinsicStats } from '@/lib/armor/intrinsicCompare';
import { tuningPermutations } from '@/lib/armor/tuning';
import {
  configDominates,
  type DominatorResult,
} from '@/lib/scoring/dominance';
import { armorComparisonPeers, DEFAULT_REDUNDANT_PEER_SCOPE } from '@/lib/scoring/peerScope';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import {
  compareRedundantKeepPriority,
  redundantKeepRank,
  redundantKeepTailScore,
  sortByRedundantKeepPriority,
} from '@/lib/scoring/redundantKeepPriority';
export interface TuningCoverageResult {
  /** Peer that can replicate every tuning layout of the candidate. */
  peer: ArmorPiece;
  /** Both pieces can match each other's tuning layouts. */
  mutual: boolean;
}

function freshConfigsForItem(item: ArmorPiece): Partial<Record<Stat, number>>[] {
  return tuningPermutations(item, { statsBase: intrinsicStats(item) });
}

function prepareItems(items: ArmorPiece[]): ArmorPiece[] {
  return items.map((item) => ({
    ...item,
    statConfigurations: freshConfigsForItem(item),
  }));
}

function configsForItem(item: ArmorPiece): Partial<Record<Stat, number>>[] {
  return item.statConfigurations ?? freshConfigsForItem(item);
}

/** Stable key for identical intrinsic rolls within redundant comparison scope. */
export function intrinsicRollComparisonKey(
  item: ArmorPiece,
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
): string {
  const statPart = STATS.map((s) => `${s}:${intrinsicStats(item)[s] ?? 0}`).join(',');
  const parts = [item.classType, item.armorSlot, item.archetype, item.tertiaryStat, statPart];
  if (scope.groupBySet) parts.push(String(item.armorSet?.hash ?? 0));
  if (scope.groupByTuning) parts.push(String(item.tuningStat ?? 'none'));
  return parts.join('|');
}

/** True when every stat value matches between two tuning layouts. */
export function configsIdentical(
  a: Partial<Record<Stat, number>>,
  b: Partial<Record<Stat, number>>,
): boolean {
  for (const stat of STATS) {
    if ((a[stat] ?? 0) !== (b[stat] ?? 0)) return false;
  }
  return true;
}

/** Peers in the same class, slot, archetype, tertiary roll, and armor set. */
export function tuningPeerGroup(
  candidate: ArmorPiece,
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
): ArmorPiece[] {
  return armorComparisonPeers(candidate, items, scope);
}

/** True when `cover` is identical to or Pareto-dominates `target`. */
export function configMatchesOrBeats(
  cover: Partial<Record<Stat, number>>,
  target: Partial<Record<Stat, number>>,
): boolean {
  return configsIdentical(cover, target) || configDominates(cover, target);
}

/**
 * True when `peer` can match or beat every tuning layout `candidate` can reach.
 * Strict stat-lower dominance is a subset of this check.
 */
export function peerMatchesOrBeatsAllConfigs(peer: ArmorPiece, candidate: ArmorPiece): boolean {
  const peerConfigs = configsForItem(peer);
  const candConfigs = configsForItem(candidate);
  if (candConfigs.length === 0) return false;

  for (const candCfg of candConfigs) {
    let covered = false;
    for (const peerCfg of peerConfigs) {
      if (configMatchesOrBeats(peerCfg, candCfg)) {
        covered = true;
        break;
      }
    }
    if (!covered) return false;
  }
  return true;
}

/**
 * True when `peer` can reach every tuning layout that `candidate` can
 * (identical intrinsic stat lines after tuning permutations).
 */
export function peerCoversAllConfigs(peer: ArmorPiece, candidate: ArmorPiece): boolean {
  const peerConfigs = configsForItem(peer);
  const candConfigs = configsForItem(candidate);
  if (candConfigs.length === 0) return false;

  for (const candCfg of candConfigs) {
    let matched = false;
    for (const peerCfg of peerConfigs) {
      if (configsIdentical(peerCfg, candCfg)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

/** True when both pieces reach the same tuning layout set. */
export function mutuallyTuningEquivalent(a: ArmorPiece, b: ArmorPiece): boolean {
  return peerCoversAllConfigs(a, b) && peerCoversAllConfigs(b, a);
}

/**
 * Heuristic for which interchangeable piece to keep when coverage is mutual.
 * @deprecated Prefer redundantKeepRank with class prefs: MW is only a tiebreaker there.
 */
export function keepPreferenceScore(item: ArmorPiece): number {
  let score = redundantKeepTailScore(item);
  if (item.isMasterwork) score += 500;
  return score;
}

function bestCoveragePeer(
  candidate: ArmorPiece,
  peers: ArmorPiece[],
  prefs?: ClassPreferenceProfile,
  excludePeerIds: Set<string> = new Set(),
): TuningCoverageResult | null {
  const effectivePrefs = prefs ?? defaultClassPreferenceProfile();
  const sorted = [...peers].sort((a, b) =>
    compareRedundantKeepPriority(b, a, effectivePrefs),
  );

  for (const peer of sorted) {
    if (excludePeerIds.has(peer.instanceId)) continue;
    if (!peerCoversAllConfigs(peer, candidate)) continue;

    const mutual = peerCoversAllConfigs(candidate, peer);
    const identicalMutual = mutual;
    if (mutual) {
      if (compareRedundantKeepPriority(candidate, peer, effectivePrefs) > 0) continue;
      if (
        compareRedundantKeepPriority(candidate, peer, effectivePrefs) === 0 &&
        candidate.instanceId >= peer.instanceId
      ) {
        continue;
      }
    }

    return { peer, mutual: identicalMutual };
  }
  return null;
}

function buildMutualTuningGroups(
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
): ArmorPiece[][] {
  const parent = new Map<string, string>();

  function find(id: string): string {
    const parentId = parent.get(id) ?? id;
    if (parentId !== id) {
      const root = find(parentId);
      parent.set(id, root);
      return root;
    }
    return id;
  }

  function union(a: string, b: string) {
    parent.set(find(a), find(b));
  }

  for (const item of items) {
    find(item.instanceId);
    for (const peer of armorComparisonPeers(item, items, scope)) {
      if (mutuallyTuningEquivalent(item, peer)) {
        union(item.instanceId, peer.instanceId);
      }
    }
  }

  const groups = new Map<string, ArmorPiece[]>();
  for (const item of items) {
    const root = find(item.instanceId);
    const list = groups.get(root) ?? [];
    list.push(item);
    groups.set(root, list);
  }
  return [...groups.values()];
}

/** First peer that fully covers `candidate`, or null. */
export function findTuningCoveragePeer(
  candidate: ArmorPiece,
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): TuningCoverageResult | null {
  return bestCoveragePeer(
    candidate,
    tuningPeerGroup(candidate, items, scope),
    prefs,
  );
}

/**
 * Map dominated-by-tuning-coverage instanceIds → peer proof.
 * Skips items already stat-lower dominated when `excludeIds` is provided.
 */
export function findTuningRedundantMap(
  items: ArmorPiece[],
  excludeIds: Set<string> = new Set(),
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): Map<string, TuningCoverageResult> {
  const prepared = prepareItems(items);
  const eligible = prepared.filter((item) => !excludeIds.has(item.instanceId));
  const effectivePrefs = prefs ?? defaultClassPreferenceProfile();
  const map = new Map<string, TuningCoverageResult>();
  const handled = new Set<string>();

  for (const group of buildMutualTuningGroups(eligible, scope)) {
    if (group.length < 2) continue;
    const sorted = sortByRedundantKeepPriority(group, effectivePrefs);
    const keeper = sorted[0];
    if (!keeper) continue;
    for (const item of sorted.slice(1)) {
      if (excludeIds.has(item.instanceId)) continue;
      map.set(item.instanceId, { peer: keeper, mutual: true });
      handled.add(item.instanceId);
    }
  }

  for (const candidate of eligible) {
    if (handled.has(candidate.instanceId)) continue;
    const peers = armorComparisonPeers(candidate, prepared, scope);
    const coverage = bestCoveragePeer(candidate, peers, prefs, excludeIds);
    if (coverage && !coverage.mutual) {
      map.set(candidate.instanceId, coverage);
    }
  }

  return map;
}

export function tuningRedundantCandidateIds(
  items: ArmorPiece[],
  excludeIds: Set<string> = new Set(),
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): Set<string> {
  return new Set(findTuningRedundantMap(items, excludeIds, scope, prefs).keys());
}

export { redundantKeepRank };

/** Popover payload for a tuning-redundant candidate vs its covering peer. */
export function tuningCoverageToDominatorResult(
  candidate: ArmorPiece,
  coverage: TuningCoverageResult,
): DominatorResult {
  return {
    dominator: coverage.peer,
    beatsOn: intrinsicStatDeltas(coverage.peer, candidate),
  };
}
