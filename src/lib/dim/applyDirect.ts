import { applyDimTags, type DimApplySummary } from '@/lib/dim/tags';
import { resolveDimToken } from '@/lib/dim/resolveToken';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import type { TagValue } from '@/types';

export interface DimTagUpdate {
  instanceId: string;
  tag: TagValue | null;
}

function dimOkInstanceIds(summary: DimApplySummary | null): Set<string> {
  if (!summary) return new Set();
  return new Set(summary.applied.filter((r) => r.ok).map((r) => r.instanceId));
}

/** Apply tags to DIM Sync when possible; persist locally when DIM is unavailable or fails. */
export async function applyTagsDirect(updates: DimTagUpdate[]): Promise<DimApplySummary> {
  if (updates.length === 0) {
    return { applied: [], allOk: true };
  }

  const membership = useAuthStore.getState().membership;
  if (!membership) throw new Error('Sign in to apply tags to DIM');

  let dimSummary: DimApplySummary | null = null;
  try {
    const dimToken = await resolveDimToken(membership);
    dimSummary = await applyDimTags(membership.destinyMembershipId, dimToken, updates);
  } catch {
    dimSummary = null;
  }

  const dimOkIds = dimOkInstanceIds(dimSummary);
  const dimOkUpdates = updates.filter((u) => dimOkIds.has(u.instanceId));
  const localFallbackUpdates = updates.filter((u) => !dimOkIds.has(u.instanceId));

  if (dimOkUpdates.length > 0) {
    useVaultStore.getState().patchItemDimTags(dimOkUpdates);
  }
  if (localFallbackUpdates.length > 0) {
    useVaultStore.getState().patchItemDimTags(localFallbackUpdates);
  }

  const applied = updates.map((u) => {
    const dimResult = dimSummary?.applied.find((r) => r.instanceId === u.instanceId);
    const dimOk = dimOkIds.has(u.instanceId);
    return {
      instanceId: u.instanceId,
      ok: true,
      error: dimOk ? undefined : dimResult?.error,
    };
  });

  return { applied, allOk: applied.every((r) => r.ok) };
}
