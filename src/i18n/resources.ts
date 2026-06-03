import autoFiltersEn from '@/locales/en/autoFilters.json';
import browseEn from '@/locales/en/browse.json';
import buildEn from '@/locales/en/build.json';
import calibrateEn from '@/locales/en/calibrate.json';
import commonEn from '@/locales/en/common.json';
import dashboardEn from '@/locales/en/dashboard.json';
import duelEn from '@/locales/en/duel.json';
import dupesEn from '@/locales/en/dupes.json';
import errorsEn from '@/locales/en/errors.json';
import footerEn from '@/locales/en/footer.json';
import gameEn from '@/locales/en/game.json';
import homeEn from '@/locales/en/home.json';
import layoutEn from '@/locales/en/layout.json';
import navEn from '@/locales/en/nav.json';
import onboardingEn from '@/locales/en/onboarding.json';
import reviewEn from '@/locales/en/review.json';
import rulesOnboardingEn from '@/locales/en/rulesOnboarding.json';
import settingsEn from '@/locales/en/settings.json';
import vaultEn from '@/locales/en/vault.json';
import {
  MANIFEST_LOCALES,
  type AppLocale,
  DEFAULT_LOCALE,
} from './manifestLocales';

export { LOCALE_STORAGE_KEY, LOCALE_USE_BROWSER_KEY } from './localePreferences';
export { MANIFEST_LOCALES, DEFAULT_LOCALE, type AppLocale };

export const SUPPORTED_LOCALES = MANIFEST_LOCALES;

const en = {
  common: commonEn,
  nav: navEn,
  layout: layoutEn,
  home: homeEn,
  footer: footerEn,
  dupes: dupesEn,
  rulesOnboarding: rulesOnboardingEn,
  settings: settingsEn,
  vault: vaultEn,
  errors: errorsEn,
  onboarding: onboardingEn,
  dashboard: dashboardEn,
  browse: browseEn,
  duel: duelEn,
  calibrate: calibrateEn,
  review: reviewEn,
  autoFilters: autoFiltersEn,
  build: buildEn,
  game: gameEn,
} as const;

export type AppNamespaces = keyof typeof en;

const localeJsonModules = import.meta.glob('../locales/*/*.json', {
  eager: true,
}) as Record<string, { default: Record<string, unknown> }>;

const LOCALE_JSON_PATH = /^\.\.\/locales\/([^/]+)\/([^/]+)\.json$/;

function buildResourcesFromGlob(): Record<AppLocale, typeof en> {
  const byLocale = Object.fromEntries(
    MANIFEST_LOCALES.map((locale) => [locale, {} as Record<string, unknown>]),
  ) as Record<AppLocale, Record<string, unknown>>;

  for (const [path, mod] of Object.entries(localeJsonModules)) {
    const match = LOCALE_JSON_PATH.exec(path);
    if (!match) continue;
    const locale = match[1] as AppLocale;
    const namespace = match[2] as AppNamespaces;
    byLocale[locale][namespace] = mod.default;
  }

  return { ...byLocale, en } as Record<AppLocale, typeof en>;
}

export const resources = buildResourcesFromGlob();
