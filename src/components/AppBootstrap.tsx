import { useEffect } from 'react';
import { subscribeBungieAuthSync } from '@/lib/bungie/authStorage';
import { hasActiveSession, restoreMembership } from '@/lib/bungie/loadVault';
import { primeMembershipCache } from '@/lib/bungie/membership';
import {
  markBootstrapVaultLoadTriggered,
  shouldAutoLoadVault,
} from '@/lib/bungie/vaultBootstrap';
import { bootstrapVaultLoadOptions } from '@/lib/vault/refreshPolicy';
import { ensureVaultHydrated, resetVaultStore, useAuthStore, useVaultStore, waitForVaultHydrate } from '@/stores';

/** Restore Bungie session on app load */
export function AppBootstrap() {
  const { membership, setMembership } = useAuthStore();
  const { loadLiveVault } = useVaultStore();

  useEffect(() => {
    if (membership) return;

    const restored = restoreMembership();
    if (restored && hasActiveSession()) {
      primeMembershipCache(restored);
      setMembership(restored);
    }
  }, [membership, setMembership]);

  useEffect(() => {
    return subscribeBungieAuthSync(() => {
      if (hasActiveSession()) {
        const restored = restoreMembership();
        if (restored) {
          primeMembershipCache(restored);
          setMembership(restored);
          void ensureVaultHydrated();
        }
      } else {
        setMembership(null);
        resetVaultStore();
      }
    });
  }, [setMembership]);

  useEffect(() => {
    if (!membership) return;

    let cancelled = false;

    void (async () => {
      await waitForVaultHydrate();
      if (cancelled) return;

      const state = useVaultStore.getState();
      if (state.vaultLoading || state.vaultRefreshing || state.vaultError) return;
      if (!shouldAutoLoadVault()) return;

      const hasVaultData = state.lastParsedCount !== null || Boolean(state.classStates.hunter);
      if (hasVaultData) {
        markBootstrapVaultLoadTriggered();
        void loadLiveVault(bootstrapVaultLoadOptions(true));
        return;
      }

      markBootstrapVaultLoadTriggered();
      void loadLiveVault();
    })();

    return () => {
      cancelled = true;
    };
  }, [membership, loadLiveVault]);

  return null;
}
