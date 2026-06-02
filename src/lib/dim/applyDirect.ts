import { applyDimTags, type DimApplySummary } from '@/lib/dim/tags';
import { resolveDimToken } from '@/lib/dim/resolveToken';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import type { TagValue } from '@/types';

export interface DimTagUpdate {
  instanceId: string;
  tag: TagValue | null;
}

/** Apply tags to DIM Sync immediately and patch local vault state on success. */
export async function applyTagsDirect(updates: DimTagUpdate[]): Promise<DimApplySummary> {
  if (updates.length === 0) {
    return { applied: [], allOk: true };
  }

  const membership = useAuthStore.getState().membership;
  if (!membership) throw new Error('Sign in to apply tags to DIM');

  const dimToken = await resolveDimToken(membership);
  const summary = await applyDimTags(membership.destinyMembershipId, dimToken, updates);

  const okById = new Map(
    summary.applied.filter((r) => r.ok).map((r) => [r.instanceId, r.instanceId]),
  );
  const okUpdates = updates.filter((u) => okById.has(u.instanceId));
  if (okUpdates.length > 0) {
    useVaultStore.getState().patchItemDimTags(okUpdates);
  }

  return summary;
}
