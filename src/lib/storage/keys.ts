/** D2 Armor Cleaner: browser storage key names. */

export const LOG_PREFIX = '[d2-armor-cleaner]';

// localStorage
export const LS_PREFS = 'd2-armor-cleaner-prefs';
export const LS_DUPE_RULES = 'dac-dupe-rules';
export const LS_ONBOARDING = 'dac-onboarding';
export const LS_ONBOARDING_PROGRESS = 'dac-onboarding-progress';
export const LS_MIGRATION_FLAG = 'dac-storage-migrated-v1';
/** Profile redundant-roll prefs merged into dupe rules (v2). */
export const LS_MIGRATED_REDUNDANT_DUPE = 'dac-migrated-redundant-dupe-v1';
/** Pending DIM tags to apply (survives reload and new tabs). */
export const LS_REVIEW_TAGS = 'dac-review-tags';
/** Locally applied DIM tags not yet visible in stale DIM profile fetches. */
export const LS_LOCAL_DIM_TAG_OVERRIDES = 'dac-local-dim-tag-overrides';
/** Clean session progress (queue, in-bucket junk/keep, tournament position). */
export const LS_CLEAN_SESSION = 'dac-clean-session';

// sessionStorage
export const SS_VAULT_META = 'dac-vault-meta';
/** @deprecated Key name retained; values live in localStorage (shared across tabs). */
export const SS_MEMBERSHIP = 'dac-membership';
/** @deprecated Clean session lives in localStorage (`LS_CLEAN_SESSION`); migrated on load. */
export const SS_CLEAN_SESSION = 'dac-clean-session';
/** @deprecated Key name retained; values live in localStorage (shared across tabs). */
export const SS_BUNGIE_TOKEN = 'dac-bungie-token';
/** @deprecated Key name retained; values live in localStorage (shared across tabs). */
export const SS_BUNGIE_REFRESH = 'dac-bungie-refresh-token';
/** @deprecated Key name retained; values live in localStorage (shared across tabs). */
export const SS_BUNGIE_EXPIRES = 'dac-bungie-token-expires';
export const SS_BUNGIE_OAUTH_STATE = 'dac-bungie-oauth-state';
export const SS_BUNGIE_OAUTH_CODE_USED = 'dac-bungie-oauth-code-used';
export const SS_DIM_TOKEN = 'dac-dim-token';
/** In-progress calibrate step/ledger when onboarding progress is not persisted. */
export const SS_CALIBRATE_SESSION = 'dac-calibrate-session';
/** Browse page sort order (preference vs match %). */
export const SS_BROWSE_SORT = 'dac-browse-sort';

// IndexedDB
export const IDB_NAME = 'd2-armor-cleaner';
export const IDB_VERSION = 2;
export const IDB_VAULT_STORE = 'snapshots';
export const IDB_MANIFEST_STORE = 'manifest';
export const IDB_MANIFEST_KEY = 'destiny-manifest';

/** Legacy keys migrated on first load (Vault Cleaner / Dupewise). */
export const LEGACY = {
  lsPrefs: 'vault-cleaner-prefs',
  lsDupeRules: 'vc-dupe-rules',
  lsOnboarding: 'vc-onboarding',
  lsOnboardingProgress: 'vc-onboarding-progress',
  ssVaultMeta: 'vc-vault-meta',
  ssMembership: 'vc-membership',
  ssCleanSession: 'vc-clean-session',
  ssBungieToken: 'bungie-token',
  ssBungieRefresh: 'bungie-refresh-token',
  ssBungieExpires: 'bungie-token-expires',
  ssBungieOauthState: 'bungie-oauth-state',
  ssBungieOauthCodeUsed: 'bungie-oauth-code-used',
  ssDimToken: 'dim-token',
  idbVault: 'dupewise-vault',
  idbManifest: 'vault-cleaner',
} as const;

export function bungieOauthCodeUsedKey(code: string): string {
  return `${SS_BUNGIE_OAUTH_CODE_USED}:${code}`;
}
