import type { ArmorPiece, PendingTag } from '@/types';
import { BUCKET_ELIMINATION_LOSS_THRESHOLD } from '@/lib/constants';
import { sortForTournament } from '@/lib/dupes/queue';

export type BucketLossCounts = Record<string, number>;

export function preferLossCount(
  lossCounts: BucketLossCounts,
  instanceId: string,
): number {
  return lossCounts[instanceId] ?? 0;
}

export function lossesUntilElimination(
  lossCount: number,
  threshold = BUCKET_ELIMINATION_LOSS_THRESHOLD,
): number {
  return Math.max(0, threshold - lossCount);
}

/** Increment loss count; returns new count and whether the piece is now eliminated. */
export function recordPreferLossIncrement(
  lossCounts: BucketLossCounts,
  instanceId: string,
  threshold = BUCKET_ELIMINATION_LOSS_THRESHOLD,
): { lossCounts: BucketLossCounts; lossCount: number; eliminated: boolean } {
  const lossCount = preferLossCount(lossCounts, instanceId) + 1;
  return {
    lossCounts: { ...lossCounts, [instanceId]: lossCount },
    lossCount,
    eliminated: lossCount >= threshold,
  };
}

/** Junk ids applied when a bucket completes: explicit junk + tournament losers (not protected keeps). */
export function resolveBucketJunkIds(
  explicitJunkedIds: string[],
  eliminatedIds: string[],
  keptBothIds: string[],
  keptSideIds: string[] = [],
): string[] {
  const protectedKept = new Set([...keptBothIds, ...keptSideIds]);
  const autoJunk = eliminatedIds.filter((id) => !protectedKept.has(id));
  return [...new Set([...explicitJunkedIds, ...autoJunk])];
}

/** Instance IDs that must not appear in an active duel pair (junk, keep-both, keep-side, eliminated). */
export function duelExcludedIds(
  junkedIds: string[],
  keptBothIds: string[],
  pendingTags: PendingTag[] = [],
  items?: ArmorPiece[],
  eliminatedIds: string[] = [],
  keptSideIds: string[] = [],
): Set<string> {
  const excluded = new Set([
    ...junkedIds,
    ...keptBothIds,
    ...keptSideIds,
    ...eliminatedIds,
  ]);
  for (const t of pendingTags) {
    if (t.tag === 'junk') excluded.add(t.instanceId);
  }
  if (items) {
    for (const i of items) {
      if (i.dimTag === 'junk') excluded.add(i.instanceId);
    }
  }
  return excluded;
}

/** One entry per instanceId; highest wantScore wins when duplicates appear in a bucket. */
export function dedupeDuelItemsByInstanceId(items: ArmorPiece[]): ArmorPiece[] {
  const byId = new Map<string, ArmorPiece>();
  for (const item of items) {
    const prev = byId.get(item.instanceId);
    if (!prev || (item.wantScore ?? 0) > (prev.wantScore ?? 0)) {
      byId.set(item.instanceId, item);
    }
  }
  return [...byId.values()];
}

export function filterDuelItems(
  items: ArmorPiece[],
  junkedIds: string[],
  keptBothIds: string[],
  pendingTags: PendingTag[] = [],
  eliminatedIds: string[] = [],
  keptSideIds: string[] = [],
): ArmorPiece[] {
  const excluded = duelExcludedIds(
    junkedIds,
    keptBothIds,
    pendingTags,
    items,
    eliminatedIds,
    keptSideIds,
  );
  return dedupeDuelItemsByInstanceId(
    items.filter((i) => !i.isIgnored && !excluded.has(i.instanceId)),
  );
}

export interface TournamentState {
  champion: ArmorPiece | null;
  challengerQueue: ArmorPiece[];
}

export function isSelfPair(state: TournamentState): boolean {
  const challenger = state.challengerQueue[0];
  if (!state.champion || !challenger) return false;
  return state.champion.instanceId === challenger.instanceId;
}

export function initTournament(duelItems: ArmorPiece[]): TournamentState {
  const unique = dedupeDuelItemsByInstanceId(duelItems);
  if (unique.length < 2) {
    return { champion: unique[0] ?? null, challengerQueue: [] };
  }
  const sorted = sortForTournament(unique);
  return { champion: sorted[0], challengerQueue: sorted.slice(1) };
}

export function makePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

export function pairKeyFromPieces(a: ArmorPiece, b: ArmorPiece): string {
  if (a.instanceId === b.instanceId) return '';
  return makePairKey(a.instanceId, b.instanceId);
}

/** Count pairwise duels among active items that are not yet in actedPairKeys. */
export function countUnresolvedPairs(
  duelItems: ArmorPiece[],
  actedPairKeys: readonly string[] = [],
): number {
  if (duelItems.length < 2) return 0;
  const resolved = new Set(actedPairKeys);
  const unique = dedupeDuelItemsByInstanceId(duelItems);
  let count = 0;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (unique[i].instanceId === unique[j].instanceId) continue;
      if (!resolved.has(pairKeyFromPieces(unique[i], unique[j]))) count++;
    }
  }
  return count;
}

/** True when at least one active pair still needs a duel decision. */
export function hasUnresolvedPairs(
  duelItems: ArmorPiece[],
  actedPairKeys: readonly string[] = [],
): boolean {
  return countUnresolvedPairs(duelItems, actedPairKeys) > 0;
}

/** Key for the pair currently shown in the duel compare panel. */
export function activePairKey(state: TournamentState): string | null {
  const challenger = state.challengerQueue[0];
  if (!state.champion || !challenger || isSelfPair(state)) return null;
  return pairKeyFromPieces(state.champion, challenger);
}

export function pairAlreadyActed(
  a: ArmorPiece,
  b: ArmorPiece,
  actedPairKeys: readonly string[],
): boolean {
  return actedPairKeys.includes(pairKeyFromPieces(a, b));
}

/** Drop keep-sided/junked pieces from bracket state; re-seed when champion left the pool. */
export function coerceTournamentToPool(
  duelItems: ArmorPiece[],
  state: TournamentState,
): TournamentState {
  const uniqueItems = dedupeDuelItemsByInstanceId(duelItems);
  const byId = new Map(uniqueItems.map((i) => [i.instanceId, i]));
  const activeIds = new Set(byId.keys());

  let champion: ArmorPiece | null = null;
  if (state.champion && activeIds.has(state.champion.instanceId)) {
    champion = byId.get(state.champion.instanceId)!;
  }

  const seenChallengers = new Set<string>();
  const challengerQueue = state.challengerQueue
    .map((c) => byId.get(c.instanceId))
    .filter((c): c is ArmorPiece => c != null)
    .filter((c) => c.instanceId !== champion?.instanceId)
    .filter((c) => {
      if (seenChallengers.has(c.instanceId)) return false;
      seenChallengers.add(c.instanceId);
      return true;
    });

  if (!champion && uniqueItems.length > 0) {
    return initTournament(uniqueItems);
  }

  return { champion, challengerQueue };
}

function findNextChampionWithWork(
  duelItems: ArmorPiece[],
  resolved: Set<string>,
  afterInstanceId: string,
): TournamentState | null {
  const unique = dedupeDuelItemsByInstanceId(duelItems);
  const sorted = sortForTournament(unique);
  const startIdx = sorted.findIndex((i) => i.instanceId === afterInstanceId);
  const order =
    startIdx === -1
      ? sorted
      : [...sorted.slice(startIdx + 1), ...sorted.slice(0, startIdx + 1)];

  for (const candidate of order) {
    const others = sorted.filter((i) => i.instanceId !== candidate.instanceId);
    if (others.some((o) => !resolved.has(pairKeyFromPieces(candidate, o)))) {
      return coerceTournamentToPool(unique, {
        champion: candidate,
        challengerQueue: others,
      });
    }
  }
  return null;
}

/**
 * Advance tournament state past pairs that already have recorded outcomes.
 * Returns null when no unresolved duels remain (bucket may complete early).
 */
export function skipResolvedPairs(
  duelItems: ArmorPiece[],
  resolvedPairKeys: readonly string[],
  initial: TournamentState,
): TournamentState | null {
  if (duelItems.length < 2) return null;

  const activeIds = new Set(duelItems.map((i) => i.instanceId));
  const resolved = new Set(resolvedPairKeys);
  if (resolved.size === 0) {
    const coerced = coerceTournamentToPool(duelItems, initial);
    const challenger = coerced.challengerQueue[0];
    if (coerced.champion && challenger && !isSelfPair(coerced)) return coerced;
    return initTournament(duelItems);
  }

  let state = coerceTournamentToPool(duelItems, initial);
  const seen = new Set<string>();
  const maxSteps = duelItems.length * duelItems.length + duelItems.length;

  for (let step = 0; step < maxSteps; step++) {
    state = coerceTournamentToPool(duelItems, state);
    if (!state.champion) {
      state = initTournament(duelItems);
    }

    let challenger = state.challengerQueue[0];
    if (!challenger) {
      const remaining = duelItems.filter(
        (i) => i.instanceId !== state.champion!.instanceId,
      );
      if (remaining.length === 0) return null;
      state = { champion: state.champion, challengerQueue: remaining };
      challenger = state.challengerQueue[0];
    }

    if (!state.champion || !challenger) {
      return findNextChampionWithWork(duelItems, resolved, '') ?? null;
    }

    const fingerprint = `${state.champion.instanceId}|${state.challengerQueue.map((c) => c.instanceId).join(',')}`;
    if (seen.has(fingerprint)) {
      const fallback =
        findNextChampionWithWork(duelItems, resolved, state.champion.instanceId) ??
        findNextChampionWithWork(duelItems, resolved, '');
      if (fallback) {
        state = fallback;
        continue;
      }
      return null;
    }
    seen.add(fingerprint);

    const key = pairKeyFromPieces(state.champion, challenger);
    if (!resolved.has(key)) {
      if (state.champion.instanceId === challenger.instanceId) {
        const rest = state.challengerQueue.slice(1);
        if (rest.length > 0) {
          state = { champion: state.champion, challengerQueue: rest };
          continue;
        }
        const next = findNextChampionWithWork(
          duelItems,
          resolved,
          state.champion.instanceId,
        );
        if (!next) return null;
        state = next;
        continue;
      }
      if (
        activeIds.has(state.champion.instanceId) &&
        activeIds.has(challenger.instanceId)
      ) {
        return state;
      }
      const rest = state.challengerQueue.slice(1);
      if (rest.length > 0) {
        state = { champion: state.champion, challengerQueue: rest };
        continue;
      }
      const sorted = sortForTournament(duelItems);
      const unresolvedForChampion = sorted.filter(
        (item) =>
          item.instanceId !== state.champion!.instanceId &&
          !resolved.has(pairKeyFromPieces(state.champion!, item)),
      );
      if (unresolvedForChampion.length > 0) {
        state = { champion: state.champion, challengerQueue: unresolvedForChampion };
        continue;
      }
      const next = findNextChampionWithWork(
        duelItems,
        resolved,
        state.champion.instanceId,
      );
      if (!next) return null;
      state = next;
      continue;
    }

    const rest = state.challengerQueue.slice(1);
    if (rest.length > 0) {
      state = { champion: state.champion, challengerQueue: rest };
      continue;
    }

    const sorted = sortForTournament(duelItems);
    const unresolvedForChampion = sorted.filter(
      (item) =>
        item.instanceId !== state.champion!.instanceId &&
        !resolved.has(pairKeyFromPieces(state.champion!, item)),
    );
    if (unresolvedForChampion.length > 0) {
      state = { champion: state.champion, challengerQueue: unresolvedForChampion };
      continue;
    }

    const next = findNextChampionWithWork(
      duelItems,
      resolved,
      state.champion.instanceId,
    );
    if (!next) return null;
    state = next;
  }

  return null;
}

export function initTournamentSkippingResolved(
  duelItems: ArmorPiece[],
  resolvedPairKeys: readonly string[] = [],
): TournamentState | null {
  if (duelItems.length < 2) return null;
  if (!hasUnresolvedPairs(duelItems, resolvedPairKeys)) return null;
  const resolved = new Set(resolvedPairKeys);
  return (
    skipResolvedPairs(duelItems, resolvedPairKeys, initTournament(duelItems)) ??
    findNextChampionWithWork(duelItems, resolved, '')
  );
}

/**
 * Apply bracket advance logic used by the duel page: skip acted pairs and fall back to a fresh seed.
 */
export function advanceTournamentSkippingActed(
  duelItems: ArmorPiece[],
  raw: TournamentState,
  actedPairKeys: readonly string[],
): TournamentState | null {
  if (duelItems.length < 2) return null;
  if (!raw.champion || raw.challengerQueue.length === 0) {
    return initTournamentSkippingResolved(duelItems, actedPairKeys);
  }
  return (
    skipResolvedPairs(duelItems, actedPairKeys, raw) ??
    initTournamentSkippingResolved(duelItems, actedPairKeys)
  );
}

/** True when no more pairwise duels remain in the current duplicate group. */
export function noMoreDuelPairs(
  duelItems: ArmorPiece[],
  actedPairKeys: readonly string[] = [],
): boolean {
  if (duelItems.length < 2) return true;
  return !hasUnresolvedPairs(duelItems, actedPairKeys);
}

/** Prefer losers with no unresolved pairs left (e.g. two-item bucket after one recorded prefer). */
export function findStrandedPreferLosers(
  duelItems: ArmorPiece[],
  lossCounts: BucketLossCounts,
  resolvedPairKeys: readonly string[],
): string[] {
  const resolved = new Set(resolvedPairKeys);
  const stranded: string[] = [];

  for (const item of duelItems) {
    if (preferLossCount(lossCounts, item.instanceId) === 0) continue;
    const hasUnresolved = duelItems.some(
      (other) =>
        other.instanceId !== item.instanceId &&
        !resolved.has(pairKeyFromPieces(item, other)),
    );
    if (!hasUnresolved) stranded.push(item.instanceId);
  }

  return stranded;
}

export function advanceAfterResolve(
  keep: ArmorPiece,
  junk: ArmorPiece,
  challengerQueue: ArmorPiece[],
  duelItems?: ArmorPiece[],
): TournamentState {
  const nextQueue = challengerQueue.filter(
    (c) => c.instanceId !== junk.instanceId && c.instanceId !== keep.instanceId,
  );
  if (nextQueue.length > 0) {
    return { champion: keep, challengerQueue: nextQueue };
  }

  if (duelItems) {
    const remaining = duelItems.filter((i) => i.instanceId !== junk.instanceId);
    if (remaining.length >= 2) {
      const sorted = sortForTournament(remaining);
      const champion =
        sorted.find((i) => i.instanceId === keep.instanceId) ?? sorted[0];
      const challengerQueue = sorted.filter(
        (i) => i.instanceId !== champion.instanceId,
      );
      return { champion, challengerQueue };
    }
  }

  return { champion: null, challengerQueue: [] };
}

/** Prefer loser with lives remaining — winner stays champion; loser re-queued at back. */
export function advanceAfterPreferLoss(
  keep: ArmorPiece,
  loser: ArmorPiece,
  challengerQueue: ArmorPiece[],
): TournamentState {
  const rest = challengerQueue.filter(
    (c) => c.instanceId !== keep.instanceId && c.instanceId !== loser.instanceId,
  );
  if (rest.length === 0) {
    return { champion: keep, challengerQueue: [loser] };
  }
  return { champion: keep, challengerQueue: [...rest, loser] };
}

/** Keep one side — kept exits duel pool; other continues as champion. */
export function advanceAfterKeepSide(
  kept: ArmorPiece,
  other: ArmorPiece,
  challengerQueue: ArmorPiece[],
): TournamentState {
  const rest = challengerQueue.filter(
    (c) => c.instanceId !== kept.instanceId && c.instanceId !== other.instanceId,
  );
  return { champion: other, challengerQueue: rest };
}

/** Pass this pair — neither tagged; both return to the back of the bracket queue. */
export function rotatePairToBack(
  champion: ArmorPiece,
  challenger: ArmorPiece,
  challengerQueue: ArmorPiece[],
): TournamentState {
  const rest = challengerQueue.slice(1);
  if (rest.length === 0) {
    return { champion: challenger, challengerQueue: [champion] };
  }
  return {
    champion: rest[0],
    challengerQueue: [...rest.slice(1), champion, challenger],
  };
}

/** Resume mid-bucket tournament from persisted champion/challenger ids after remount. */
export function restoreTournament(
  duelItems: ArmorPiece[],
  championId: string | null | undefined,
  challengerIds: string[] | undefined,
  resolvedPairKeys: readonly string[] = [],
): TournamentState | null {
  if (duelItems.length < 2) {
    return duelItems[0] ? { champion: duelItems[0], challengerQueue: [] } : null;
  }

  let state: TournamentState;

  if (!championId) {
    state = initTournament(duelItems);
  } else {
    const byId = new Map(duelItems.map((i) => [i.instanceId, i]));
    const champion = byId.get(championId) ?? null;
    const challengerQueue = (challengerIds ?? [])
      .map((id) => byId.get(id))
      .filter((item): item is ArmorPiece => item != null);

    if (!champion) {
      state = initTournament(duelItems);
    } else if (challengerQueue.length === 0) {
      const remaining = duelItems.filter(
        (i) => i.instanceId !== champion.instanceId,
      );
      state =
        remaining.length >= 1
          ? { champion, challengerQueue: remaining }
          : initTournament(duelItems);
    } else {
      state = coerceTournamentToPool(duelItems, { champion, challengerQueue });
    }
  }

  return skipResolvedPairs(duelItems, resolvedPairKeys, state);
}

export function splitBucketTags(
  allInBucket: ArmorPiece[],
  junkedIds: string[],
): { kept: ArmorPiece[]; junked: ArmorPiece[] } {
  const junkedSet = new Set(junkedIds);
  const active = allInBucket.filter((i) => !i.isIgnored);
  return {
    kept: active.filter((i) => !junkedSet.has(i.instanceId)),
    junked: active.filter((i) => junkedSet.has(i.instanceId)),
  };
}

export function decisionKeptIds(decision: {
  keptIds?: string[];
  keptId?: string;
}): string[] {
  if (decision.keptIds && decision.keptIds.length > 0) return decision.keptIds;
  if (decision.keptId) return [decision.keptId];
  return [];
}
