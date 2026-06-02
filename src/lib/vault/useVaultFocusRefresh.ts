import { useEffect, useRef } from 'react';
import { isVaultCacheStale } from '@/lib/vault/cache';
import {
  FOCUS_POLL_MS,
  shouldThrottleFocusRefresh,
} from '@/lib/vault/refreshPolicy';
import {
  isVaultRefreshBlocked,
  whenVaultRefreshUnblocked,
} from '@/lib/vault/refreshGuard';
import { useAuthStore, useVaultStore } from '@/stores';

interface UseVaultFocusRefreshOptions {
  /** When true, refresh on mount if vault cache is stale (Review / Browse / Combos). */
  refreshOnMount?: boolean;
}

/**
 * Keeps vault + DIM tags fresh while the app is in use without blocking the UI.
 * See refreshPolicy.ts for the full policy.
 */
export function useVaultFocusRefresh(options?: UseVaultFocusRefreshOptions) {
  const membership = useAuthStore((s) => s.membership);
  const loadLiveVault = useVaultStore((s) => s.loadLiveVault);
  const vaultLoading = useVaultStore((s) => s.vaultLoading);
  const vaultRefreshing = useVaultStore((s) => s.vaultRefreshing);
  const lastRefreshRef = useRef(0);
  const refreshOnMount = options?.refreshOnMount ?? false;

  useEffect(() => {
    if (!membership) return;

    const tryRefresh = (source: 'focus' | 'poll' | 'mount') => {
      const state = useVaultStore.getState();
      if (state.vaultLoading || state.vaultRefreshing) return;

      const now = Date.now();
      if (
        (source === 'focus' || source === 'poll') &&
        shouldThrottleFocusRefresh(lastRefreshRef.current, now)
      ) {
        return;
      }
      if (source === 'mount') {
        if (!refreshOnMount) return;
        if (!isVaultCacheStale(state.vaultFetchedAt)) return;
      }
      if (source === 'poll' && !isVaultCacheStale(state.vaultFetchedAt)) return;

      lastRefreshRef.current = now;
      const refresh = () => void loadLiveVault({ background: true });
      if (isVaultRefreshBlocked()) {
        whenVaultRefreshUnblocked(refresh);
      } else {
        refresh();
      }
    };

    const onFocus = () => tryRefresh('focus');
    window.addEventListener('focus', onFocus);

    if (refreshOnMount) {
      tryRefresh('mount');
    }

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      tryRefresh('poll');
    }, FOCUS_POLL_MS);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(pollId);
    };
  }, [membership, vaultLoading, vaultRefreshing, loadLiveVault, refreshOnMount]);
}
