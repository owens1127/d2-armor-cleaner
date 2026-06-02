import { coerceTournamentToPool } from '@/lib/dupes/duel';
import type { BucketLossCounts } from '@/lib/dupes/duel';
import type { ArmorPiece, PendingTag } from '@/types';

/** Snapshot of in-bucket duel progress before a single user action. */
export interface BucketDuelUndoSnapshot {
  bucketJunkedIds: string[];
  bucketEliminatedIds: string[];
  bucketLossCounts: BucketLossCounts;
  bucketKeptBothIds: string[];
  bucketKeptSideIds: string[];
  actedPairKeys: string[];
  bucketChampionId: string | null;
  bucketChallengerIds: string[];
  pendingTags: PendingTag[];
}

export const MAX_DUEL_UNDO_DEPTH = 50;

export function captureBucketDuelSnapshot(
  session: BucketDuelUndoSnapshot,
  pendingTags: PendingTag[],
): BucketDuelUndoSnapshot {
  return {
    bucketJunkedIds: [...session.bucketJunkedIds],
    bucketEliminatedIds: [...session.bucketEliminatedIds],
    bucketLossCounts: { ...session.bucketLossCounts },
    bucketKeptBothIds: [...session.bucketKeptBothIds],
    bucketKeptSideIds: [...session.bucketKeptSideIds],
    actedPairKeys: [...session.actedPairKeys],
    bucketChampionId: session.bucketChampionId,
    bucketChallengerIds: [...session.bucketChallengerIds],
    pendingTags: pendingTags.map((t) => ({ ...t })),
  };
}

export function tournamentFromSnapshot(
  snapshot: BucketDuelUndoSnapshot,
  duelItems: ArmorPiece[],
): { champion: ArmorPiece | null; challengerQueue: ArmorPiece[] } {
  const byId = new Map(duelItems.map((i) => [i.instanceId, i]));
  const champion = snapshot.bucketChampionId
    ? byId.get(snapshot.bucketChampionId) ?? null
    : null;
  const challengerQueue = snapshot.bucketChallengerIds
    .map((id) => byId.get(id))
    .filter((p): p is ArmorPiece => p != null);
  return coerceTournamentToPool(duelItems, { champion, challengerQueue });
}
