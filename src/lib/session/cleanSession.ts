import { CLASSES } from '@/lib/constants';
import { duelExcludedIds } from '@/lib/dupes/duel';
import {
  buildDuelQueueKeys,
  findBucketByKey,
  prioritizeQueueHead,
  rebuildDuelQueueKeys,
} from '@/lib/dupes/queue';
import {
  emptyBucketSessionFields,
  hasBucketSessionProgress,
  type BucketProgressInput,
} from '@/lib/session/bucketSession';
import type { ClassType, ClassVaultState, PendingTag } from '@/types';
import type { PersistedSession } from './persist';

function isClassType(value: string): value is ClassType {
  return CLASSES.includes(value as ClassType);
}

/** Infer active clean class from persisted queue when `cleanClassType` is absent. */
export function inferCleanClassType(session: {
  cleanClassType?: ClassType | null;
  duelQueue: string[];
}): ClassType | null {
  if (session.cleanClassType && isClassType(session.cleanClassType)) {
    return session.cleanClassType;
  }
  const keyStr = session.duelQueue[0];
  if (!keyStr) return null;
  const classPart = keyStr.split('|')[0];
  return isClassType(classPart) ? classPart : null;
}

export type CleanSessionSnapshot = Pick<
  PersistedSession,
  | 'duelQueue'
  | 'bucketJunkedIds'
  | 'bucketEliminatedIds'
  | 'bucketLossCounts'
  | 'bucketKeptBothIds'
  | 'bucketKeptSideIds'
  | 'cleanClassType'
  | 'bucketChampionId'
  | 'bucketChallengerIds'
  | 'actedPairKeys'
> & {
  pendingTags?: PendingTag[];
};

/** Keep restored session on refresh when URL class matches and duel work is in flight. */
export function shouldPreserveCleanSession(
  urlClass: ClassType,
  session: CleanSessionSnapshot,
): boolean {
  const sessionClass = inferCleanClassType(session);
  if (sessionClass !== urlClass) return false;
  if (session.duelQueue.length > 0) return true;
  return hasInBucketProgress(session);
}

export function hasInBucketProgress(session: BucketProgressInput): boolean {
  return hasBucketSessionProgress(session);
}

function cleanSessionExcludedIds(
  classVault: Pick<ClassVaultState, 'buckets'>,
  session: CleanSessionSnapshot,
  pendingTags: PendingTag[] = [],
) {
  return duelExcludedIds(
    session.bucketJunkedIds,
    session.bucketKeptBothIds,
    pendingTags,
    classVault.buckets.flatMap((b) => b.items),
    session.bucketEliminatedIds ?? [],
    session.bucketKeptSideIds ?? [],
  );
}

/** Vault has duplicate buckets that could still be dueled (respecting junk/keep exclusions). */
export function vaultHasDuelableBuckets(
  classType: ClassType,
  classVault: Pick<ClassVaultState, 'buckets'>,
  pendingTags: PendingTag[] = [],
): boolean {
  const excluded = duelExcludedIds(
    [],
    [],
    pendingTags,
    classVault.buckets.flatMap((b) => b.items),
  );
  return buildDuelQueueKeys(classType, classVault.buckets, excluded).length > 0;
}

/** No duplicate buckets left to duel for this class. */
export function showCleanEmptyState(
  classType: ClassType,
  classVault: Pick<ClassVaultState, 'buckets'>,
  pendingTags: PendingTag[] = [],
): boolean {
  return !vaultHasDuelableBuckets(classType, classVault, pendingTags);
}

/** Rebuild duel queue from vault + persisted session; URL bucket wins as queue head when valid. */
export function deriveCleanQueue(
  classType: ClassType,
  classVault: Pick<ClassVaultState, 'buckets'>,
  session: CleanSessionSnapshot,
  urlBucketKey: string | null,
  pendingTags: PendingTag[] = [],
): string[] {
  let queue = rebuildDuelQueueKeys(
    classType,
    classVault.buckets,
    [],
    session.duelQueue,
    session.bucketJunkedIds,
    session.bucketKeptBothIds,
    pendingTags,
    session.bucketEliminatedIds ?? [],
    session.bucketKeptSideIds ?? [],
  );

  if (urlBucketKey && findBucketByKey(classVault.buckets, urlBucketKey)) {
    queue = prioritizeQueueHead(queue, urlBucketKey);
  }

  if (queue.length === 0) {
    const excluded = cleanSessionExcludedIds(classVault, session, pendingTags);
    queue = buildDuelQueueKeys(classType, classVault.buckets, excluded);
    if (urlBucketKey && findBucketByKey(classVault.buckets, urlBucketKey)) {
      queue = prioritizeQueueHead(queue, urlBucketKey);
    }
  }

  return queue;
}

export type CleanMountPlan =
  | { action: 'noop' }
  | { action: 'init' }
  | {
      action: 'restore';
      duelQueue: string[];
      bucketJunkedIds: string[];
      bucketEliminatedIds: string[];
      bucketLossCounts: Record<string, number>;
      bucketKeptBothIds: string[];
      bucketKeptSideIds: string[];
      bucketChampionId: string | null;
      bucketChallengerIds: string[];
      actedPairKeys: string[];
    };

/**
 * Decide how to hydrate clean session on mount from URL + persisted session + vault.
 * Does not depend on in-memory Zustand surviving HMR.
 */
export function planCleanMount(
  urlClass: ClassType,
  urlBucketKey: string | null,
  session: CleanSessionSnapshot,
  classVault: Pick<ClassVaultState, 'buckets'> | undefined,
  singleBucketKey: string | null = null,
  pendingTags: PendingTag[] = [],
): CleanMountPlan {
  if (!classVault) return { action: 'noop' };

  if (singleBucketKey) {
    return {
      action: 'restore',
      duelQueue: [singleBucketKey],
      ...emptyBucketSessionFields(),
    };
  }

  const hasBucketProgress = hasInBucketProgress(session);

  if (shouldPreserveCleanSession(urlClass, session) || hasBucketProgress) {
    return {
      action: 'restore',
      duelQueue: deriveCleanQueue(urlClass, classVault, session, urlBucketKey, pendingTags),
      bucketJunkedIds: session.bucketJunkedIds,
      bucketEliminatedIds: session.bucketEliminatedIds ?? [],
      bucketLossCounts: session.bucketLossCounts ?? {},
      bucketKeptBothIds: session.bucketKeptBothIds,
      bucketKeptSideIds: session.bucketKeptSideIds ?? [],
      bucketChampionId: session.bucketChampionId ?? null,
      bucketChallengerIds: session.bucketChallengerIds ?? [],
      actedPairKeys: session.actedPairKeys ?? [],
    };
  }

  return freshCleanMountWithOptionalBucket(urlClass, classVault, session, urlBucketKey, pendingTags);
}

function freshCleanMountWithOptionalBucket(
  urlClass: ClassType,
  classVault: Pick<ClassVaultState, 'buckets'>,
  session: CleanSessionSnapshot,
  urlBucketKey: string | null,
  pendingTags: PendingTag[],
): CleanMountPlan {
  if (urlBucketKey && findBucketByKey(classVault.buckets, urlBucketKey)) {
    return {
      action: 'restore',
      duelQueue: deriveCleanQueue(urlClass, classVault, session, urlBucketKey, pendingTags),
      ...emptyBucketSessionFields(),
    };
  }

  return { action: 'init' };
}
