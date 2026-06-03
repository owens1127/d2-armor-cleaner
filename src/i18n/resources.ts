import type enBundle from '../locales/en.json';
import {
  MANIFEST_LOCALES,
  type AppLocale,
  DEFAULT_LOCALE,
} from './manifestLocales';

export { LOCALE_STORAGE_KEY, LOCALE_USE_BROWSER_KEY } from './localePreferences';
export { MANIFEST_LOCALES, DEFAULT_LOCALE, type AppLocale };

export const SUPPORTED_LOCALES = MANIFEST_LOCALES;

const localeJsonModules = import.meta.glob('../locales/*.json', {
  eager: true,
}) as Record<string, { default: Record<string, unknown> }>;

const LOCALE_JSON_PATH = /^\.\.\/locales\/([^/]+)\.json$/;

function buildResourcesFromGlob(): Record<AppLocale, typeof enBundle> {
  const byLocale = Object.fromEntries(
    MANIFEST_LOCALES.map((locale) => [locale, {} as typeof enBundle]),
  ) as Record<AppLocale, typeof enBundle>;

  for (const [path, mod] of Object.entries(localeJsonModules)) {
    const match = LOCALE_JSON_PATH.exec(path);
    if (!match) continue;
    const locale = match[1] as AppLocale;
    byLocale[locale] = mod.default as typeof enBundle;
  }

  return byLocale;
}

export const resources = buildResourcesFromGlob();

export type AppNamespaces = keyof typeof enBundle;
