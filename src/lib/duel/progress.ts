export interface DuelSessionBucketCounts {
  remaining: number;
  total: number;
}

/** Duplicate groups remaining in the duel queue. */
export function duelSessionBucketCounts(remaining: number): DuelSessionBucketCounts {
  return {
    remaining,
    total: remaining,
  };
}

export function formatDuelSessionBuckets(counts: DuelSessionBucketCounts): string {
  const { remaining } = counts;
  if (remaining === 0) return 'No duplicate groups';
  return remaining === 1 ? '1 group remaining' : `${remaining} groups remaining`;
}

/** 1-based position of the current bucket within the full session plan. */
export function duelSessionBucketIndex(completed: number, queueIndex1Based: number): number {
  return completed + queueIndex1Based;
}

export function formatDuelSessionBucketPosition(
  completed: number,
  queueIndex1Based: number,
  total: number,
): string {
  return `Bucket ${duelSessionBucketIndex(completed, queueIndex1Based)} of ${total}`;
}

export interface DuelInBucketProgress {
  activePieces: number;
  challengersQueued: number;
}

/**
 * In-bucket duel progress derived from the live tournament queue.
 * Unlike single-elim round counts, this stays accurate with prefer-loss re-queues,
 * pass, keep-side, and junk shrinking the active pool.
 */
export function duelInBucketProgress(
  duelItemCount: number,
  challengerQueueLength: number,
): DuelInBucketProgress | null {
  if (duelItemCount < 2) return null;
  return {
    activePieces: duelItemCount,
    challengersQueued: challengerQueueLength,
  };
}

export function formatDuelInBucketProgress(progress: DuelInBucketProgress): string {
  const { activePieces, challengersQueued } = progress;
  const pieceLabel = activePieces === 1 ? 'piece' : 'pieces';
  if (challengersQueued === 0) {
    return `${activePieces} ${pieceLabel} · final pair`;
  }
  const queueLabel = challengersQueued === 1 ? 'challenger' : 'challengers';
  return `${activePieces} ${pieceLabel} · ${challengersQueued} ${queueLabel} queued`;
}
