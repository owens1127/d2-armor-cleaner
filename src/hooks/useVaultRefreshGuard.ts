import { useEffect } from 'react';
import {
  installVaultRefreshGuard,
  releaseVaultInteraction,
  retainVaultInteraction,
} from '@/lib/vault/refreshGuard';

export function useVaultRefreshGuard(): void {
  useEffect(() => installVaultRefreshGuard(), []);
}

/** Hold background vault apply/refresh while `active` (e.g. open picker menu). */
export function useVaultInteractionHold(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    retainVaultInteraction();
    return () => releaseVaultInteraction();
  }, [active]);
}
