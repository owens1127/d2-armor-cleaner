import {
  DEFAULT_LOCALE,
  detectNavigatorLocale,
  isManifestLocale,
  normalizeLocale,
  type AppLocale,
} from './manifestLocales';

export const LOCALE_STORAGE_KEY = 'd2ac.locale';
export const LOCALE_USE_BROWSER_KEY = 'd2ac.locale.useBrowser';

export function readUseBrowserLanguage(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const stored = localStorage.getItem(LOCALE_USE_BROWSER_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

export function writeUseBrowserLanguage(useBrowser: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCALE_USE_BROWSER_KEY, useBrowser ? 'true' : 'false');
}

export function readManualLocale(): AppLocale {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (!stored || !isManifestLocale(stored)) return DEFAULT_LOCALE;
  return stored;
}

export function writeManualLocale(locale: AppLocale): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function resolveInitialLocale(): AppLocale {
  if (readUseBrowserLanguage()) {
    return detectNavigatorLocale();
  }
  return readManualLocale();
}

export { normalizeLocale };
