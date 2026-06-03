import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, resources } from './resources';
import './types';

/** Fixed English locale for unit tests (no browser detector). */
export async function initI18nForTests(): Promise<void> {
  if (i18n.isInitialized) {
    await i18n.changeLanguage(DEFAULT_LOCALE);
    return;
  }
  await i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
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
    initAsync: true,
  });
}
