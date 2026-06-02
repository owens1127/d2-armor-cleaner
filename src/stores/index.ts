export { useAuthStore } from '@/stores/authStore';
export { usePrefsStore } from '@/stores/prefsStore';
export {
  ensureVaultHydrated,
  resetVaultStore,
  useVaultStore,
  waitForVaultHydrate,
} from '@/stores/vaultStore';
export { useSessionStore } from '@/stores/sessionStore';

import { hasActiveSession, restoreMembership } from '@/lib/bungie/loadVault';
import { primeMembershipCache } from '@/lib/bungie/membership';
import type { ClassType } from '@/types';
import { dupeBucketCount, itemsToReview } from '@/lib/dupes/group';
import { useAuthStore } from '@/stores/authStore';
import { startVaultHydrate, useVaultStore } from '@/stores/vaultStore';

/** Restore Bungie auth before first route render (avoids flash redirect to /). */
function bootstrapAuthSession(): void {
  if (useAuthStore.getState().membership) return;

  if (hasActiveSession()) {
    const restored = restoreMembership();
    if (restored) {
      primeMembershipCache(restored);
      useAuthStore.getState().setMembership(restored);
    }
  }
}

bootstrapAuthSession();
startVaultHydrate();

export function vaultSummary(classType: ClassType) {
  const state = useVaultStore.getState().classStates[classType];
  if (!state) return { t5: 0, dupes: 0, review: 0 };
  return {
    t5: state.profile.totalT5,
    dupes: dupeBucketCount(state.buckets),
    review: itemsToReview(state.buckets),
  };
}
