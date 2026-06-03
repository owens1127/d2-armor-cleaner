import {
  LOCALE_STORAGE_KEY,
  LOCALE_USE_BROWSER_KEY,
} from '@/i18n/localePreferences';
import {
  LEGACY,
  LS_CLEAN_SESSION,
  LS_DUPE_RULES,
  LS_LOCAL_DIM_TAG_OVERRIDES,
  LS_MIGRATED_REDUNDANT_DUPE,
  LS_MIGRATION_FLAG,
  LS_ONBOARDING,
  LS_ONBOARDING_PROGRESS,
  LS_PREFS,
  LS_REVIEW_TAGS,
  SS_BROWSE_SORT,
  SS_BUNGIE_OAUTH_CODE_USED,
  SS_BUNGIE_OAUTH_STATE,
  SS_CALIBRATE_SESSION,
  SS_CALIBRATE_SET_BONUS_DETAILS,
  SS_VAULT_META,
} from './keys';

const LOCAL_PREFIXES = ['dac-', 'd2ac.', 'vc-'] as const;
const LOCAL_EXACT = [
  LS_PREFS,
  LEGACY.lsPrefs,
  LS_CLEAN_SESSION,
  LS_REVIEW_TAGS,
  LS_LOCAL_DIM_TAG_OVERRIDES,
] as const;
const SESSION_PREFIXES = ['dac-', 'vc-', 'bungie-oauth-code-used'] as const;
const SESSION_EXACT = [
  SS_VAULT_META,
  SS_BUNGIE_OAUTH_STATE,
  SS_CALIBRATE_SESSION,
  SS_CALIBRATE_SET_BONUS_DETAILS,
  SS_BROWSE_SORT,
  LEGACY.ssVaultMeta,
  LEGACY.ssBungieOauthState,
] as const;

const PREFS_KEEP_KEYS = new Set<string>([
  LS_PREFS,
  LEGACY.lsPrefs,
  LS_DUPE_RULES,
  LEGACY.lsDupeRules,
  LS_ONBOARDING,
  LEGACY.lsOnboarding,
  LS_ONBOARDING_PROGRESS,
  LEGACY.lsOnboardingProgress,
  LOCALE_STORAGE_KEY,
  LOCALE_USE_BROWSER_KEY,
  LS_MIGRATION_FLAG,
  LS_MIGRATED_REDUNDANT_DUPE,
]);

function matchesPrefix(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => key.startsWith(p));
}

function shouldRemoveLocalKey(key: string, keepPrefs: boolean): boolean {
  if (keepPrefs && PREFS_KEEP_KEYS.has(key)) return false;
  if ((LOCAL_EXACT as readonly string[]).includes(key)) return true;
  if (matchesPrefix(key, LOCAL_PREFIXES)) return true;
  if (key.startsWith(`${SS_BUNGIE_OAUTH_CODE_USED}:`)) return true;
  if (key.startsWith(`${LEGACY.ssBungieOauthCodeUsed}:`)) return true;
  if (key.startsWith('dac-last-duel-bucket:')) return true;
  return false;
}

function shouldRemoveSessionKey(key: string): boolean {
  if ((SESSION_EXACT as readonly string[]).includes(key)) return true;
  if (matchesPrefix(key, SESSION_PREFIXES)) return true;
  if (key.startsWith(`${SS_BUNGIE_OAUTH_CODE_USED}:`)) return true;
  if (key.startsWith(`${LEGACY.ssBungieOauthCodeUsed}:`)) return true;
  return false;
}

export function collectRemovableStorageKeys(
  storage: Storage,
  area: 'local' | 'session',
  keepPrefs: boolean,
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const remove =
      area === 'local'
        ? shouldRemoveLocalKey(key, keepPrefs)
        : shouldRemoveSessionKey(key);
    if (remove) keys.push(key);
  }
  return keys;
}
