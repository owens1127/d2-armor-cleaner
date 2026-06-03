import { detectNavigatorLocale, type AppLocale } from '@/i18n/manifestLocales';
import { writeManualLocale, writeUseBrowserLanguage } from '@/i18n/localePreferences';
import { clearManifestVaultCacheOnly } from '@/lib/storage/clearManifestVaultCache';

export type LocaleChangeCommit =
  | { useBrowser: true }
  | { useBrowser: false; locale: AppLocale };

export function resolveLocaleFromCommit(commit: LocaleChangeCommit): AppLocale {
  if (commit.useBrowser) return detectNavigatorLocale();
  return commit.locale;
}

/** Persist locale choice, clear manifest/vault caches, and hard-reload the app. */
export async function commitLocaleChangeWithReload(commit: LocaleChangeCommit): Promise<void> {
  await clearManifestVaultCacheOnly();
  writeUseBrowserLanguage(commit.useBrowser);
  if (!commit.useBrowser) {
    writeManualLocale(commit.locale);
  }
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
