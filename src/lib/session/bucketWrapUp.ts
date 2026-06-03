import {
  findStrandedPreferLosers,
  filterDuelItems,
  noMoreDuelPairs,
  resolveBucketJunkIds,
  splitBucketTags,
  type BucketLossCounts,
} from '@/lib/dupes/duel';
import type { ArmorPiece, PendingTag } from '@/types';

export interface BucketSessionSnapshot {
  bucketJunkedIds: string[];
  bucketEliminatedIds: string[];
  bucketLossCounts: BucketLossCounts;
  bucketKeptBothIds: string[];
  bucketKeptSideIds: string[];
  actedPairKeys: string[];
  pendingTags: PendingTag[];
}

export interface BucketWrapUpReport {
  totalItems: number;
  keepCount: number;
  junkCount: number;
  keptBothCount: number;
  keptSideCount: number;
  explicitJunkCount: number;
  tournamentEliminatedCount: number;
  preferInProgressCount: number;
  pairsActed: number;
}

/** True when the current bucket has no remaining duel pairs and should pause for wrap-up. */
export function isBucketReadyForWrapUp(
  duelItems: ArmorPiece[],
  actedPairKeys: readonly string[],
  hasBucket: boolean,
): boolean {
  if (!hasBucket) return false;
  if (duelItems.length >= 2 && !noMoreDuelPairs(duelItems, actedPairKeys)) return false;
  if (duelItems.length >= 2 && actedPairKeys.length === 0) return false;
  return true;
}

/** Preview final keep/junk split for the bucket session (same rules as advanceToNextBucket). */
export function buildBucketWrapUpReport(
  allInBucket: ArmorPiece[],
  session: BucketSessionSnapshot,
): BucketWrapUpReport {
  const activeItems = allInBucket.filter((i) => !i.isIgnored);
  const duelItems = filterDuelItems(
    activeItems,
    session.bucketJunkedIds,
    session.bucketKeptBothIds,
    session.pendingTags,
    session.bucketEliminatedIds,
    session.bucketKeptSideIds,
  );
  const stranded = findStrandedPreferLosers(
    duelItems,
    session.bucketLossCounts,
    session.actedPairKeys,
  );
  const eliminatedIds = [...new Set([...session.bucketEliminatedIds, ...stranded])];
  const resolvedJunkIds = resolveBucketJunkIds(
    session.bucketJunkedIds,
    eliminatedIds,
    session.bucketKeptBothIds,
    session.bucketKeptSideIds,
  );
  const { kept, junked } = splitBucketTags(activeItems, resolvedJunkIds);

  const preferInProgressCount = Object.entries(session.bucketLossCounts).filter(
    ([id, count]) =>
      count > 0 &&
      !eliminatedIds.includes(id) &&
      !session.bucketJunkedIds.includes(id) &&
      !session.bucketKeptBothIds.includes(id) &&
      !session.bucketKeptSideIds.includes(id),
  ).length;

  return {
    totalItems: activeItems.length,
    keepCount: kept.length,
    junkCount: junked.length,
    keptBothCount: session.bucketKeptBothIds.length,
    keptSideCount: session.bucketKeptSideIds.length,
    explicitJunkCount: new Set(session.bucketJunkedIds).size,
    tournamentEliminatedCount: eliminatedIds.filter((id) => !session.bucketJunkedIds.includes(id))
      .length,
    preferInProgressCount,
    pairsActed: session.actedPairKeys.length,
  };
}

/** Duplicate groups still queued after the current wrap-up bucket is advanced. */
export function wrapUpGroupsRemainingAfterCurrent(queueLengthIncludingCurrent: number): number {
  return Math.max(0, queueLengthIncludingCurrent - 1);
}

export { formatWrapUpSessionContext } from '@/i18n/duelCopy';
