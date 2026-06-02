import { ARMOR_SLOTS } from '@/lib/constants';
import type {
  DismantleCandidate,
  DismantleDisplayEntry,
  DismantleDisplayGroup,
  DismantleGroupMember,
} from '@/lib/dupes/dismantle';
import { compareRedundantKeepPriority, sortByRedundantKeepPriority } from '@/lib/scoring/redundantKeepPriority';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import { DEFAULT_REDUNDANT_PEER_SCOPE } from '@/lib/scoring/peerScope';
import {
  intrinsicRollComparisonKey,
  mutualTuningGroups,
  prepareItemsForTuningComparison,
} from '@/lib/scoring/tuningEquivalence';
import type { ArmorPiece, ArmorSlot, ClassPreferenceProfile, RedundantPeerScope } from '@/types';

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

function memberFromPiece(
  piece: ArmorPiece,
  role: DismantleGroupMember['role'],
  candidate?: DismantleCandidate,
  copyCount = 1,
  instanceIds?: string[],
): DismantleGroupMember {
  return {
    piece,
    role,
    candidate,
    copyCount,
    instanceIds: instanceIds ?? [piece.instanceId],
  };
}

function buildMutualTuningGroup(
  groupPieces: ArmorPiece[],
  candidates: DismantleCandidate[],
  scope: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup | null {
  const candidateById = new Map(candidates.map((c) => [c.item.instanceId, c]));
  const sorted = sortByRedundantKeepPriority(
    groupPieces,
    prefs ?? defaultClassPreferenceProfile(),
  );
  const keeper = sorted[0];
  if (!keeper) return null;

  const members = sorted.map((piece) =>
    memberFromPiece(
      piece,
      piece.instanceId === keeper.instanceId ? 'keeper' : 'redundant',
      candidateById.get(piece.instanceId),
    ),
  );

  const rollKey = intrinsicRollComparisonKey(keeper, scope);
  return {
    id: `tuning-mutual-${keeper.instanceId}|${rollKey}`,
    slot: keeper.armorSlot,
    reason: 'tuning-duplicate',
    members,
  };
}

function buildStatLowerGroups(
  candidates: DismantleCandidate[],
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  const statByPeer = new Map<string, DismantleCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.reason !== 'stat-lower') continue;
    const key = candidate.peer.instanceId;
    const list = statByPeer.get(key) ?? [];
    list.push(candidate);
    statByPeer.set(key, list);
  }

  const groups: DismantleDisplayGroup[] = [];
  for (const [peerId, list] of statByPeer) {
    const peer = list[0]?.peer;
    if (!peer) continue;
    const sorted = sortDismantleCandidates(list, prefs);
    groups.push({
      id: `stat-${peerId}`,
      slot: peer.armorSlot,
      reason: 'stat-lower',
      members: [
        memberFromPiece(peer, 'keeper'),
        ...sorted.map((candidate) =>
          memberFromPiece(candidate.item, 'redundant', candidate),
        ),
      ],
    });
  }
  return groups;
}

function buildTuningGroups(
  slotItems: ArmorPiece[],
  candidates: DismantleCandidate[],
  scope: RedundantPeerScope,
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  const tuningCandidates = candidates.filter((c) => c.reason === 'tuning-duplicate');
  if (tuningCandidates.length === 0) return [];

  const preparedItems = prepareItemsForTuningComparison(slotItems);
  const candidateIds = new Set(tuningCandidates.map((c) => c.item.instanceId));
  const handledCandidateIds = new Set<string>();
  const groups: DismantleDisplayGroup[] = [];

  for (const groupPieces of mutualTuningGroups(preparedItems, scope)) {
    if (groupPieces.length < 2) continue;
    const involved = groupPieces.filter((p) => candidateIds.has(p.instanceId));
    if (involved.length === 0) continue;

    const group = buildMutualTuningGroup(
      groupPieces,
      tuningCandidates.filter((c) => groupPieces.some((p) => p.instanceId === c.item.instanceId)),
      scope,
      prefs,
    );
    if (!group) continue;

    groups.push(group);
    for (const candidate of tuningCandidates) {
      if (groupPieces.some((piece) => piece.instanceId === candidate.item.instanceId)) {
        handledCandidateIds.add(candidate.item.instanceId);
      }
    }
  }

  const tuningByKey = new Map<string, DismantleCandidate[]>();
  for (const candidate of tuningCandidates) {
    if (handledCandidateIds.has(candidate.item.instanceId)) continue;
    const key = tuningDisplayGroupKey(candidate, scope);
    const list = tuningByKey.get(key) ?? [];
    list.push(candidate);
    tuningByKey.set(key, list);
  }

  for (const [key, list] of tuningByKey) {
    const peer = list[0]?.peer;
    if (!peer) continue;
    const collapsed = groupDismantleCandidatesForDisplay(list, scope);
    const sortedCollapsed = prefs
      ? [...collapsed].sort((a, b) => compareRedundantKeepPriority(a.item, b.item, prefs))
      : collapsed;

    groups.push({
      id: `tuning-${key}`,
      slot: peer.armorSlot,
      reason: 'tuning-duplicate',
      members: [
        memberFromPiece(peer, 'keeper'),
        ...sortedCollapsed.map((entry) =>
          memberFromPiece(entry.item, 'redundant', entry, entry.copyCount, entry.instanceIds),
        ),
      ],
    });
  }

  return groups;
}

/** Build keeper + redundant grids for redundant-roll browse. */
export function buildRedundantBrowseGroups(
  candidates: DismantleCandidate[],
  slotItems: ArmorPiece[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  const statGroups = buildStatLowerGroups(candidates, prefs);
  const tuningGroups = buildTuningGroups(slotItems, candidates, scope, prefs);
  return sortDisplayGroups([...statGroups, ...tuningGroups], prefs);
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

function buildDismantleDisplayGroupsFromCandidates(
  candidates: DismantleCandidate[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  const slotItems = new Map<ArmorSlot, ArmorPiece[]>();
  for (const candidate of candidates) {
    for (const piece of [candidate.item, candidate.peer]) {
      const list = slotItems.get(piece.armorSlot) ?? [];
      if (!list.some((p) => p.instanceId === piece.instanceId)) list.push(piece);
      slotItems.set(piece.armorSlot, list);
    }
  }
  const allSlotItems = [...slotItems.values()].flat();
  return buildRedundantBrowseGroups(candidates, allSlotItems, scope, prefs);
}

/** @deprecated Prefer buildRedundantBrowseGroups with slot items for full tuning clusters. */
export function buildDismantleDisplayGroups(
  candidates: DismantleCandidate[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
  prefs?: ClassPreferenceProfile,
): DismantleDisplayGroup[] {
  return buildDismantleDisplayGroupsFromCandidates(candidates, scope, prefs);
}
