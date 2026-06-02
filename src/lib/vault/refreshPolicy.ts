/**
 * Vault + DIM refresh policy
 *
 * - Bootstrap (AppBootstrap): hydrate IndexedDB for instant UI, then always
 *   background-fetch vault + DIM tags when a session exists (never skip DIM sync).
 * - Foreground load (no cache): blocking spinner until the first fetch completes.
 * - Window focus: background refresh, throttled to FOCUS_REFRESH_MS (no stale gate).
 * - Visible-tab poll: background refresh when cache age exceeds VAULT_STALE_MS.
 * - Navigation (Review / Browse / Combos): refresh on mount when cache is stale.
 * - Manual "Refresh vault": force re-fetch; non-blocking when cached data exists.
 * - DIM tags: synced on every vault fetch unless skipDimSync is explicitly set;
 *   API failure keeps the last cached tags.
 */
export const VAULT_STALE_MS = 45_000;

/** Minimum interval between focus-driven vault refreshes. */
export const FOCUS_REFRESH_MS = 45_000;

/** How often to check whether a visible-tab refresh is due. */
export const FOCUS_POLL_MS = 15_000;

export interface VaultLoadTriggerOptions {
  force?: boolean;
  background?: boolean;
  skipDimSync?: boolean;
}

/** Options for bootstrap when cached vault data is already hydrated. */
export function bootstrapVaultLoadOptions(hasCachedVault: boolean): VaultLoadTriggerOptions {
  if (!hasCachedVault) return {};
  return { background: true };
}

/** True when a focus/poll refresh should be suppressed (too soon since last trigger). */
export function shouldThrottleFocusRefresh(
  lastRefreshAt: number,
  now = Date.now(),
): boolean {
  return now - lastRefreshAt < FOCUS_REFRESH_MS;
}

/** Resolve DIM sync flags passed to the Bungie loader from store options. */
export function resolveDimSyncFlags(options?: {
  skipDimSync?: boolean;
}): { skipDimSync: boolean } {
  return { skipDimSync: options?.skipDimSync ?? false };
}
