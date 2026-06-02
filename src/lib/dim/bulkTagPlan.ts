import type { ArmorPiece, TagValue } from '@/types';

export interface BulkDimTagApplyPlan {
  tag: TagValue | null;
  pieces: ArmorPiece[];
}

/**
 * Plan a single DIM batch for bulk keep/junk on recommended grid pieces.
 * Matches bulk button labels: "mark all" when not uniformly tagged, "clear all" when all are.
 */
export function planBulkDimTagApply(
  pieces: readonly ArmorPiece[],
  targetTag: 'keep' | 'junk',
): BulkDimTagApplyPlan | null {
  if (pieces.length === 0) return null;
  const allTagged = pieces.every((piece) => piece.dimTag === targetTag);
  if (allTagged) {
    return { tag: null, pieces: [...pieces] };
  }
  const untagged = pieces.filter((piece) => piece.dimTag !== targetTag);
  if (untagged.length === 0) return null;
  return { tag: targetTag, pieces: untagged };
}
