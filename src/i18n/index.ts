import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import {
  detectNavigatorLocale,
  manifestLocaleToI18nTag,
  normalizeLocale,
  type AppLocale,
  DEFAULT_LOCALE,
  MANIFEST_LOCALES,
} from './manifestLocales';
import {
  LOCALE_STORAGE_KEY,
  LOCALE_USE_BROWSER_KEY,
  readManualLocale,
  readUseBrowserLanguage,
  resolveInitialLocale,
  writeManualLocale,
  writeUseBrowserLanguage,
} from './localePreferences';
import { resources, SUPPORTED_LOCALES } from './resources';

export type { AppLocale };
export {
  DEFAULT_LOCALE,
  detectNavigatorLocale,
  manifestLocaleToI18nTag,
  MANIFEST_LOCALES,
  normalizeLocale,
  SUPPORTED_LOCALES,
  LOCALE_STORAGE_KEY,
  LOCALE_USE_BROWSER_KEY,
  readManualLocale,
  readUseBrowserLanguage,
  writeManualLocale,
  writeUseBrowserLanguage,
};

import './types';

const useBrowserOnInit = readUseBrowserLanguage();
const initialLocale = resolveInitialLocale();

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    load: 'currentOnly',
    defaultNS: 'common',
    ns: [
      'common',
      'nav',
      'layout',
      'home',
      'footer',
      'dupes',
      'rulesOnboarding',
      'settings',
      'vault',
      'errors',
      'onboarding',
      'dashboard',
      'browse',
      'duel',
      'calibrate',
      'review',
      'autoFilters',
      'build',
      'game',
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: useBrowserOnInit ? ['navigator'] : ['localStorage'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: useBrowserOnInit ? [] : ['localStorage'],
      convertDetectedLanguage: (lng) => normalizeLocale(lng),
    },
  });

export function setUseBrowserLanguage(useBrowser: boolean): void {
  writeUseBrowserLanguage(useBrowser);
  if (useBrowser) {
    void i18n.changeLanguage(detectNavigatorLocale());
    return;
  }
  void i18n.changeLanguage(readManualLocale());
}

export function applyManualLocale(locale: AppLocale): void {
  writeUseBrowserLanguage(false);
  writeManualLocale(locale);
  void i18n.changeLanguage(locale);
}

export function getAppLocale(): AppLocale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
}

export { i18n };

export { initManifestLocaleSync } from '@/lib/bungie/manifestLocaleSync';
