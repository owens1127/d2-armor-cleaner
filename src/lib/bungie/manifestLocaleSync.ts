import { i18n } from '@/i18n';
import { normalizeLocale, type AppLocale } from '@/i18n/manifestLocales';
import { relocalizeVaultDisplayFromManifest } from '@/lib/armor/manifestDisplay';
import { hasActiveSession } from '@/lib/bungie/loadVault';
import {
  clearManifestMemoryCache,
  getLoadedManifestLocale,
  reloadManifestForLocale,
} from '@/lib/bungie/manifest';
import { clearVaultComputeCache } from '@/lib/coverage/vaultComputeCache';
import { clearManifestArmorSetIcons } from '@/lib/items/setIcons';

let localeSyncInFlight: Promise<void> | null = null;
let lastHandledLocale: AppLocale | null = null;

/** Reload Bungie manifest and refresh vault when UI locale changes. */
export async function syncManifestToAppLocale(locale: AppLocale): Promise<void> {
  const loaded = getLoadedManifestLocale();
  if (locale === loaded) {
    lastHandledLocale = locale;
    return;
  }
  if (locale === lastHandledLocale && loaded === locale) return;

  if (localeSyncInFlight) {
    await localeSyncInFlight;
    if (getLoadedManifestLocale() === locale) {
      lastHandledLocale = locale;
      return;
    }
  }

  localeSyncInFlight = (async () => {
    try {
      clearManifestMemoryCache();
      clearManifestArmorSetIcons();

      const { useAuthStore } = await import('@/stores/authStore');
      const { useVaultStore } = await import('@/stores/vaultStore');
      const { restoreMembership } = await import('@/lib/bungie/loadVault');
      const membership = useAuthStore.getState().membership ?? restoreMembership();

      if (membership && hasActiveSession()) {
        await relocalizeVaultDisplayFromManifest(locale);
        await useVaultStore.getState().loadLiveVault({ background: true, force: true });
        lastHandledLocale = locale;
        return;
      }

      await reloadManifestForLocale(locale);
      lastHandledLocale = locale;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[d2-armor-cleaner] manifest locale sync failed', err);
      }
    } finally {
      localeSyncInFlight = null;
    }
  })();

  await localeSyncInFlight;
}

export function initManifestLocaleSync(): void {
  lastHandledLocale = getLoadedManifestLocale() ?? normalizeLocale(i18n.language);

  i18n.on('languageChanged', (lng) => {
    const locale = normalizeLocale(lng);
    if (locale === lastHandledLocale && getLoadedManifestLocale() === locale) return;
    clearVaultComputeCache();
    clearManifestArmorSetIcons();
    void syncManifestToAppLocale(locale);
  });
}

/** Reset in-memory locale sync state (tests and after clear local data). */
export function resetManifestLocaleSyncState(): void {
  localeSyncInFlight = null;
  lastHandledLocale = null;
}

/** @internal Reset sync state between Vitest cases. */
export function resetManifestLocaleSyncForTests(): void {
  resetManifestLocaleSyncState();
}
