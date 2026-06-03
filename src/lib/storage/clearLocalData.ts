import { clearSession } from '@/lib/bungie/loadVault';
import { clearBungieAuthStorage } from '@/lib/bungie/authStorage';
import { defaultPreferenceProfile } from '@/lib/prefs/profile';
import { loadPrefs, savePrefs } from '@/lib/prefs/storage';
import { clearOnboardingProgress } from '@/lib/onboarding/storage';
import { clearManifestVaultCacheOnly } from '@/lib/storage/clearManifestVaultCache';
import { useAuthStore } from '@/stores/authStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  reloadVaultStoreFromStorage,
  resetVaultStore,
  useVaultStore,
} from '@/stores/vaultStore';
import {
  LS_DUPE_RULES,
  LS_MIGRATED_REDUNDANT_DUPE,
  LS_MIGRATION_FLAG,
  LS_ONBOARDING,
  IDB_NAME,
  LEGACY,
} from './keys';
import { collectRemovableStorageKeys } from './clearLocalDataKeys';
import { deleteIndexedDb } from './idb';

export type ClearLocalDataOptions = {
  /** When true, clears calibration prefs, dupe rules, onboarding, and locale overrides. */
  resetPrefsAndOnboarding: boolean;
};

function clearWebStorage(keepPrefs: boolean): void {
  if (typeof localStorage !== 'undefined') {
    for (const key of collectRemovableStorageKeys(localStorage, 'local', keepPrefs)) {
      localStorage.removeItem(key);
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    for (const key of collectRemovableStorageKeys(sessionStorage, 'session', false)) {
      sessionStorage.removeItem(key);
    }
  }
}

async function clearAllIndexedDb(): Promise<void> {
  await deleteIndexedDb(IDB_NAME);
  await deleteIndexedDb(LEGACY.idbVault);
  await deleteIndexedDb(LEGACY.idbManifest);
}

/**
 * Clear app-owned browser storage (vault/manifest IDB, caches, sessions).
 * Always signs out. Optionally keeps prefs, dupe rules, onboarding, and UI locale.
 */
export async function clearLocalAppData(options: ClearLocalDataOptions): Promise<void> {
  await clearManifestVaultCacheOnly();

  clearSession();
  clearBungieAuthStorage();
  clearWebStorage(!options.resetPrefsAndOnboarding);
  await clearAllIndexedDb();

  if (options.resetPrefsAndOnboarding) {
    savePrefs(defaultPreferenceProfile());
    clearOnboardingProgress();
    localStorage.removeItem(LS_ONBOARDING);
    localStorage.removeItem(LS_DUPE_RULES);
    localStorage.removeItem(LS_MIGRATION_FLAG);
    localStorage.removeItem(LS_MIGRATED_REDUNDANT_DUPE);
  }

  useSessionStore.getState().clearSession();
  resetVaultStore();
  reloadVaultStoreFromStorage();
  useAuthStore.getState().setMembership(null);

  if (options.resetPrefsAndOnboarding) {
    usePrefsStore.getState().setProfile(defaultPreferenceProfile());
    useVaultStore.getState().setOnboardingComplete(false);
  } else {
    usePrefsStore.getState().setProfile(loadPrefs());
  }
}
