import { duelExcludedIds } from '@/lib/dupes/duel';
import type {
  ArmorPiece,
  ArmorSlot,
  ClassPreferenceProfile,
  ClassType,
  PendingTag,
  RedundantPeerScope,
} from '@/types';
import { ARMOR_SLOTS } from '@/lib/constants';
import { findDominatorsMap, type DominatorResult } from '@/lib/scoring/dominance';
import {
  findTuningRedundantMap,
  type TuningCoverageResult,
} from '@/lib/scoring/tuningEquivalence';
import { DEFAULT_REDUNDANT_PEER_SCOPE } from '@/lib/scoring/peerScope';
import { compareRedundantKeepPriority } from '@/lib/scoring/redundantKeepPriority';
import { groupDismantleCandidatesForDisplay } from '@/lib/browse/redundantGroups';

export type DismantleReason = 'stat-lower' | 'tuning-duplicate';

/** Session + review state that must not appear in redundant-roll buckets. */
export interface DismantleExclusions {
  bucketJunkedIds?: string[];
  bucketKeptBothIds?: string[];
  bucketKeptSideIds?: string[];
  pendingTags?: PendingTag[];
}

/** Instance IDs excluded from redundant-roll comparison (candidates and dominators). */
export function dismantleExcludedIds(
  exclusions: DismantleExclusions = {},
  items?: ArmorPiece[],
): Set<string> {
  const excluded = duelExcludedIds(
    exclusions.bucketJunkedIds ?? [],
    [
      ...(exclusions.bucketKeptBothIds ?? []),
      ...(exclusions.bucketKeptSideIds ?? []),
    ],
    [],
    items,
  );
  for (const t of exclusions.pendingTags ?? []) {
    excluded.add(t.instanceId);
  }
  return excluded;
}

export function filterDismantleItems(
  items: ArmorPiece[],
  exclusions: DismantleExclusions = {},
): ArmorPiece[] {
  const excluded = dismantleExcludedIds(exclusions, items);
  return items.filter((i) => !i.isIgnored && !excluded.has(i.instanceId));
}

export interface DismantleCandidate {
  item: ArmorPiece;
  reason: DismantleReason;
  peer: ArmorPiece;
  /** Present when reason is stat-lower. */
  dominatorResult?: DominatorResult;
  /** Present when reason is tuning-duplicate. */
  tuningCoverage?: TuningCoverageResult;
}

/** One UI row; tuning-duplicate copies with the same peer roll collapse here. */
export interface DismantleDisplayEntry extends DismantleCandidate {
  copyCount: number;
  instanceIds: string[];
}

export type DismantleGroupRole = 'keeper' | 'redundant';

export interface DismantleGroupMember {
  piece: ArmorPiece;
  role: DismantleGroupRole;
  /** Present for redundant members (stat-lower or tuning-duplicate proof). */
  candidate?: DismantleCandidate;
  copyCount: number;
  instanceIds: string[];
}

/** Keeper + redundant pieces shown together for triage. */
export interface DismantleDisplayGroup {
  id: string;
  slot: ArmorSlot;
  reason: DismantleReason;
  members: DismantleGroupMember[];
}

export { groupDismantleCandidatesForDisplay } from '@/lib/browse/redundantGroups';

function sortDismantleCandidates(
  candidates: DismantleCandidate[],
  prefs?: ClassPreferenceProfile,
): DismantleCandidate[] {
  if (!prefs) return candidates;
  return [...candidates].sort((a, b) => {
    const peerCmp = compareRedundantKeepPriority(b.peer, a.peer, prefs);
    if (peerCmp !== 0) return peerCmp;
    return compareRedundantKeepPriority(a.item, b.item, prefs);
  });
}

function candidatesForSlot(
  slotItems: ArmorPiece[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
  exclusions?: DismantleExclusions,
): DismantleCandidate[] {
  const active = filterDismantleItems(slotItems, exclusions);
  const dominators = findDominatorsMap(active, scope, prefs);
  const statLowerIds = new Set(dominators.keys());
  const tuningMap = findTuningRedundantMap(active, statLowerIds, scope, prefs);
  const out: DismantleCandidate[] = [];

  for (const item of active) {
    const dom = dominators.get(item.instanceId);
    if (dom) {
      out.push({
        item,
        reason: 'stat-lower',
        peer: dom.dominator,
        dominatorResult: dom,
      });
      continue;
    }
    const tuning = tuningMap.get(item.instanceId);
    if (tuning) {
      out.push({
        item,
        reason: 'tuning-duplicate',
        peer: tuning.peer,
        tuningCoverage: tuning,
      });
    }
  }

  return sortDismantleCandidates(out, prefs);
}

export function findDismantleBySlot(
  items: ArmorPiece[],
  classType: ClassType,
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
  exclusions?: DismantleExclusions,
): Map<ArmorSlot, DismantleCandidate[]> {
  const active = filterDismantleItems(
    items.filter((i) => i.classType === classType),
    exclusions,
  );
  const result = new Map<ArmorSlot, DismantleCandidate[]>();

  for (const slot of ARMOR_SLOTS) {
    const slotItems = active.filter((i) => i.armorSlot === slot);
    const candidates = candidatesForSlot(slotItems, scope, prefs, exclusions);
    if (candidates.length > 0) result.set(slot, candidates);
  }
  return result;
}

export function countDismantleCandidates(
  items: ArmorPiece[],
  classType: ClassType,
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
  exclusions?: DismantleExclusions,
): number {
  let n = 0;
  for (const list of findDismantleBySlot(items, classType, scope, prefs, exclusions).values()) {
    n += groupDismantleCandidatesForDisplay(list, scope).length;
  }
  return n;
}

export function allDismantleCandidates(
  items: ArmorPiece[],
  classType: ClassType,
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
  exclusions?: DismantleExclusions,
): DismantleCandidate[] {
  const out: DismantleCandidate[] = [];
  for (const list of findDismantleBySlot(items, classType, scope, prefs, exclusions).values()) {
    out.push(...list);
  }
  return out;
}
