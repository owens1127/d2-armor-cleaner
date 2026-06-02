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
import {
  autoJunkCandidates,
  findDominatorsMap,
  type DominatorResult,
} from '@/lib/scoring/dominance';
import {
  findTuningRedundantMap,
  intrinsicRollComparisonKey,
  type TuningCoverageResult,
} from '@/lib/scoring/tuningEquivalence';
import { DEFAULT_REDUNDANT_PEER_SCOPE } from '@/lib/scoring/peerScope';
import { compareRedundantKeepPriority } from '@/lib/scoring/redundantKeepPriority';

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

function tuningDisplayGroupKey(
  candidate: DismantleCandidate,
  scope: RedundantPeerScope,
): string {
  return `${candidate.peer.instanceId}|${intrinsicRollComparisonKey(candidate.item, scope)}`;
}

/** Collapse tuning-duplicate rows that share the same roll identity and keeper peer. */
export function groupDismantleCandidatesForDisplay(
  candidates: DismantleCandidate[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
): DismantleDisplayEntry[] {
  const out: DismantleDisplayEntry[] = [];
  const tuningGroups = new Map<string, DismantleCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.reason !== 'tuning-duplicate') {
      out.push({
        ...candidate,
        copyCount: 1,
        instanceIds: [candidate.item.instanceId],
      });
      continue;
    }
    const key = tuningDisplayGroupKey(candidate, scope);
    const list = tuningGroups.get(key) ?? [];
    list.push(candidate);
    tuningGroups.set(key, list);
  }

  for (const group of tuningGroups.values()) {
    const representative =
      group.length === 1
        ? group[0]
        : [...group].sort((a, b) => a.item.instanceId.localeCompare(b.item.instanceId))[0];
    if (!representative) continue;
    out.push({
      ...representative,
      copyCount: group.length,
      instanceIds: group.map((entry) => entry.item.instanceId),
    });
  }

  return out;
}

function sortDisplayGroups(
  groups: DismantleDisplayGroup[],
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  const slotOrder = new Map(ARMOR_SLOTS.map((s, i) => [s, i]));
  return [...groups].sort((a, b) => {
    const slotCmp = (slotOrder.get(a.slot) ?? 0) - (slotOrder.get(b.slot) ?? 0);
    if (slotCmp !== 0) return slotCmp;
    if (a.reason !== b.reason) {
      return a.reason === 'stat-lower' ? -1 : 1;
    }
    const keeperA = a.members.find((m) => m.role === 'keeper')?.piece;
    const keeperB = b.members.find((m) => m.role === 'keeper')?.piece;
    if (keeperA && keeperB && prefs) {
      return compareRedundantKeepPriority(keeperA, keeperB, prefs);
    }
    return (keeperA?.name ?? '').localeCompare(keeperB?.name ?? '');
  });
}

/** Build keeper + redundant grids for redundant-roll browse. */
export function buildDismantleDisplayGroups(
  candidates: DismantleCandidate[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  const statByPeer = new Map<string, DismantleCandidate[]>();
  const tuningByKey = new Map<string, DismantleCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.reason === 'stat-lower') {
      const key = candidate.peer.instanceId;
      const list = statByPeer.get(key) ?? [];
      list.push(candidate);
      statByPeer.set(key, list);
      continue;
    }
    const key = tuningDisplayGroupKey(candidate, scope);
    const list = tuningByKey.get(key) ?? [];
    list.push(candidate);
    tuningByKey.set(key, list);
  }

  const groups: DismantleDisplayGroup[] = [];

  for (const [peerId, list] of statByPeer) {
    const peer = list[0]?.peer;
    if (!peer) continue;
    const sorted = prefs ? sortDismantleCandidates(list, prefs) : list;
    groups.push({
      id: `stat-${peerId}`,
      slot: peer.armorSlot,
      reason: 'stat-lower',
      members: [
        {
          piece: peer,
          role: 'keeper',
          copyCount: 1,
          instanceIds: [peer.instanceId],
        },
        ...sorted.map((candidate) => ({
          piece: candidate.item,
          role: 'redundant' as const,
          candidate,
          copyCount: 1,
          instanceIds: [candidate.item.instanceId],
        })),
      ],
    });
  }

  for (const [key, list] of tuningByKey) {
    const peer = list[0]?.peer;
    if (!peer) continue;
    const collapsed = groupDismantleCandidatesForDisplay(list, scope);
    const sortedCollapsed = prefs
      ? [...collapsed].sort((a, b) =>
          compareRedundantKeepPriority(a.item, b.item, prefs),
        )
      : collapsed;
    groups.push({
      id: `tuning-${key}`,
      slot: peer.armorSlot,
      reason: 'tuning-duplicate',
      members: [
        {
          piece: peer,
          role: 'keeper',
          copyCount: 1,
          instanceIds: [peer.instanceId],
        },
        ...sortedCollapsed.map((entry) => ({
          piece: entry.item,
          role: 'redundant' as const,
          candidate: entry,
          copyCount: entry.copyCount,
          instanceIds: entry.instanceIds,
        })),
      ],
    });
  }

  return sortDisplayGroups(groups, prefs);
}

export function countRedundantMembersInGroups(groups: DismantleDisplayGroup[]): number {
  let n = 0;
  for (const group of groups) {
    for (const member of group.members) {
      if (member.role === 'redundant') n += member.copyCount;
    }
  }
  return n;
}

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

export function countByReason(
  candidates: DismantleCandidate[],
): Record<DismantleReason, number> {
  return candidates.reduce(
    (acc, c) => {
      acc[c.reason] += 1;
      return acc;
    },
    { 'stat-lower': 0, 'tuning-duplicate': 0 } as Record<DismantleReason, number>,
  );
}

/** @deprecated Use findDismantleBySlot: returns items only, stat-lower + tuning-duplicate. */
export function findSafeDismantleBySlot(
  items: ArmorPiece[],
  classType: ClassType,
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
): Map<ArmorSlot, ArmorPiece[]> {
  const result = new Map<ArmorSlot, ArmorPiece[]>();
  for (const [slot, list] of findDismantleBySlot(items, classType, scope, prefs)) {
    result.set(
      slot,
      list.map((c) => c.item),
    );
  }
  return result;
}

/** @deprecated Use countDismantleCandidates */
export function countSafeDismantle(
  items: ArmorPiece[],
  classType: ClassType,
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): number {
  return countDismantleCandidates(items, classType, scope, prefs);
}

/** @deprecated Use allDismantleCandidates */
export function allSafeDismantleCandidates(
  items: ArmorPiece[],
  classType: ClassType,
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): ArmorPiece[] {
  return allDismantleCandidates(items, classType, scope, prefs).map((c) => c.item);
}

/** Stat-lower dominated only: for filters or diagnostics. */
export function statLowerCandidates(
  items: ArmorPiece[],
  scope?: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): ArmorPiece[] {
  return autoJunkCandidates(items.filter((i) => !i.isIgnored), scope, prefs);
}
