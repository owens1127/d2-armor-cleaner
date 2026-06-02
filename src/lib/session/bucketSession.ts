import type { BucketLossCounts } from '@/lib/dupes/duel';

/** In-bucket duel state reset together when advancing or switching groups. */
export interface BucketSessionFields {
  bucketJunkedIds: string[];
  bucketEliminatedIds: string[];
  bucketLossCounts: BucketLossCounts;
  bucketKeptBothIds: string[];
  bucketKeptSideIds: string[];
  bucketChampionId: string | null;
  bucketChallengerIds: string[];
  actedPairKeys: string[];
}

/** Fields consulted to detect in-progress work within the current duplicate group. */
export type BucketProgressInput = {
  bucketJunkedIds: readonly string[];
  bucketEliminatedIds?: readonly string[];
  bucketLossCounts?: Record<string, number>;
  bucketKeptBothIds: readonly string[];
  bucketKeptSideIds?: readonly string[];
  actedPairKeys?: readonly string[];
  bucketChampionId?: string | null;
};

export function hasBucketSessionProgress(session: BucketProgressInput): boolean {
  return (
    session.bucketJunkedIds.length > 0 ||
    (session.bucketEliminatedIds?.length ?? 0) > 0 ||
    Object.keys(session.bucketLossCounts ?? {}).length > 0 ||
    session.bucketKeptBothIds.length > 0 ||
    (session.bucketKeptSideIds?.length ?? 0) > 0 ||
    (session.actedPairKeys?.length ?? 0) > 0 ||
    session.bucketChampionId != null
  );
}

export function emptyBucketSessionFields(): BucketSessionFields {
  return {
    bucketJunkedIds: [],
    bucketEliminatedIds: [],
    bucketLossCounts: {},
    bucketKeptBothIds: [],
    bucketKeptSideIds: [],
    bucketChampionId: null,
    bucketChallengerIds: [],
    actedPairKeys: [],
  };
}
