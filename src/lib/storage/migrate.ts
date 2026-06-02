import {
  idbGet,
  idbGetAllKeys,
  idbPut,
  openAppDb,
  openLegacyDb,
} from './idb';
import {
  IDB_MANIFEST_KEY,
  IDB_MANIFEST_STORE,
  IDB_VAULT_STORE,
  LEGACY,
  LS_MIGRATION_FLAG,
  LS_DUPE_RULES,
  LS_ONBOARDING,
  LS_ONBOARDING_PROGRESS,
  LS_PREFS,
  SS_BUNGIE_EXPIRES,
  SS_BUNGIE_OAUTH_CODE_USED,
  SS_BUNGIE_OAUTH_STATE,
  SS_BUNGIE_REFRESH,
  SS_BUNGIE_TOKEN,
  SS_CLEAN_SESSION,
  LS_CLEAN_SESSION,
  SS_DIM_TOKEN,
  SS_MEMBERSHIP,
  SS_VAULT_META,
} from './keys';

function migrateLocalKey(oldKey: string, newKey: string): void {
  if (localStorage.getItem(newKey) != null) return;
  const value = localStorage.getItem(oldKey);
  if (value != null) localStorage.setItem(newKey, value);
}

function migrateSessionKey(oldKey: string, newKey: string): void {
  if (sessionStorage.getItem(newKey) != null) return;
  const value = sessionStorage.getItem(oldKey);
  if (value != null) sessionStorage.setItem(newKey, value);
}

function migrateSessionPrefix(oldPrefix: string, newPrefix: string): void {
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(`${oldPrefix}:`)) continue;
    const suffix = key.slice(oldPrefix.length);
    const newKey = `${newPrefix}${suffix}`;
    if (sessionStorage.getItem(newKey) != null) continue;
    const value = sessionStorage.getItem(key);
    if (value != null) sessionStorage.setItem(newKey, value);
  }
}

function migrateSessionKeyToLocal(oldKey: string, newKey: string): void {
  if (localStorage.getItem(newKey) != null) return;
  const value =
    sessionStorage.getItem(oldKey) ??
    sessionStorage.getItem(newKey) ??
    localStorage.getItem(oldKey);
  if (value != null) localStorage.setItem(newKey, value);
}

function migrateWebStorage(): void {
  migrateLocalKey(LEGACY.lsPrefs, LS_PREFS);
  migrateLocalKey(LEGACY.lsDupeRules, LS_DUPE_RULES);
  migrateLocalKey(LEGACY.lsOnboarding, LS_ONBOARDING);
  migrateLocalKey(LEGACY.lsOnboardingProgress, LS_ONBOARDING_PROGRESS);

  migrateSessionKey(LEGACY.ssVaultMeta, SS_VAULT_META);
  migrateSessionKey(LEGACY.ssCleanSession, SS_CLEAN_SESSION);
  migrateSessionKeyToLocal(LEGACY.ssCleanSession, LS_CLEAN_SESSION);
  migrateSessionKeyToLocal(SS_CLEAN_SESSION, LS_CLEAN_SESSION);
  migrateSessionKeyToLocal(LEGACY.ssBungieToken, SS_BUNGIE_TOKEN);
  migrateSessionKeyToLocal(LEGACY.ssBungieRefresh, SS_BUNGIE_REFRESH);
  migrateSessionKeyToLocal(LEGACY.ssBungieExpires, SS_BUNGIE_EXPIRES);
  migrateSessionKeyToLocal(SS_BUNGIE_TOKEN, SS_BUNGIE_TOKEN);
  migrateSessionKeyToLocal(SS_BUNGIE_REFRESH, SS_BUNGIE_REFRESH);
  migrateSessionKeyToLocal(SS_BUNGIE_EXPIRES, SS_BUNGIE_EXPIRES);
  migrateSessionKeyToLocal(LEGACY.ssMembership, SS_MEMBERSHIP);
  migrateSessionKeyToLocal(SS_MEMBERSHIP, SS_MEMBERSHIP);
  migrateSessionKeyToLocal(LEGACY.ssDimToken, SS_DIM_TOKEN);
  migrateSessionKeyToLocal(SS_DIM_TOKEN, SS_DIM_TOKEN);
  migrateSessionKey(LEGACY.ssBungieOauthState, SS_BUNGIE_OAUTH_STATE);
  migrateSessionPrefix(LEGACY.ssBungieOauthCodeUsed, SS_BUNGIE_OAUTH_CODE_USED);
}

async function migrateIndexedDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const appDb = await openAppDb();

  const legacyVaultDb = await openLegacyDb(LEGACY.idbVault, 2, IDB_VAULT_STORE);
  if (legacyVaultDb) {
    try {
      const keys = await idbGetAllKeys(legacyVaultDb, IDB_VAULT_STORE);
      for (const key of keys) {
        const existing = await idbGet(appDb, IDB_VAULT_STORE, key);
        if (existing != null) continue;
        const value = await idbGet<unknown>(legacyVaultDb, IDB_VAULT_STORE, key);
        if (value != null) await idbPut(appDb, IDB_VAULT_STORE, key, value);
      }
    } finally {
      legacyVaultDb.close();
    }
  }

  const legacyManifestDb = await openLegacyDb(LEGACY.idbManifest, 1, IDB_MANIFEST_STORE);
  if (legacyManifestDb) {
    try {
      const existing = await idbGet(appDb, IDB_MANIFEST_STORE, IDB_MANIFEST_KEY);
      if (existing == null) {
        const value = await idbGet<unknown>(
          legacyManifestDb,
          IDB_MANIFEST_STORE,
          IDB_MANIFEST_KEY,
        );
        if (value != null) await idbPut(appDb, IDB_MANIFEST_STORE, IDB_MANIFEST_KEY, value);
      }
    } finally {
      legacyManifestDb.close();
    }
  }

  appDb.close();
}

/** Copy legacy Vault Cleaner / Dupewise storage to D2 Armor Cleaner keys (once per browser). */
export async function migrateStorage(): Promise<void> {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
  if (localStorage.getItem(LS_MIGRATION_FLAG) === '1') return;

  migrateWebStorage();
  try {
    await migrateIndexedDb();
  } catch {
    /* best-effort: app works without migrated cache */
  }
  localStorage.setItem(LS_MIGRATION_FLAG, '1');
}
