/**
 * Destiny 2 manifest locales from Bungie `GET /Platform/Destiny2/Manifest/`
 * (`Response.jsonWorldComponentContentPaths` keys). Verified 2026-06 against live API.
 */
export const MANIFEST_LOCALES = [
  'de',
  'en',
  'es',
  'es-mx',
  'fr',
  'it',
  'ja',
  'ko',
  'pl',
  'pt-br',
  'ru',
  'zh-chs',
  'zh-cht',
] as const;

export type ManifestLocale = (typeof MANIFEST_LOCALES)[number];

/** App UI locale; aligned with manifest codes (i18next `lng` tags). */
export type AppLocale = ManifestLocale;

export const DEFAULT_LOCALE: AppLocale = 'en';

export function isManifestLocale(value: string): value is AppLocale {
  return (MANIFEST_LOCALES as readonly string[]).includes(value);
}

/** i18next / BCP-47 tags that map to each manifest locale. */
export const MANIFEST_TO_I18N_TAGS: Record<AppLocale, string> = {
  en: 'en',
  fr: 'fr',
  es: 'es',
  'es-mx': 'es-MX',
  de: 'de',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  pl: 'pl',
  'pt-br': 'pt-BR',
  ru: 'ru',
  'zh-chs': 'zh-CN',
  'zh-cht': 'zh-TW',
};

export function manifestLocaleToI18nTag(locale: AppLocale): string {
  return MANIFEST_TO_I18N_TAGS[locale];
}

/**
 * Map browser / i18next detector output to a supported manifest locale.
 */
export function normalizeLocale(lng: string | undefined): AppLocale {
  const raw = (lng ?? DEFAULT_LOCALE).trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return DEFAULT_LOCALE;

  if (isManifestLocale(raw)) return raw;

  if (raw.startsWith('zh')) {
    if (
      raw.includes('cht') ||
      raw.includes('hant') ||
      raw.includes('tw') ||
      raw === 'zh-tw' ||
      raw === 'zh-hk' ||
      raw === 'zh-mo'
    ) {
      return 'zh-cht';
    }
    return 'zh-chs';
  }

  if (raw === 'es-mx' || raw.startsWith('es-mx')) return 'es-mx';
  if (raw.startsWith('es')) return 'es';

  if (
    raw === 'pt-br' ||
    raw.startsWith('pt-br') ||
    (raw.startsWith('pt') && raw.includes('br'))
  ) {
    return 'pt-br';
  }

  const base = raw.split('-')[0] ?? raw;
  const byBase: Record<string, AppLocale> = {
    de: 'de',
    en: 'en',
    fr: 'fr',
    it: 'it',
    ja: 'ja',
    ko: 'ko',
    pl: 'pl',
    ru: 'ru',
  };
  if (base in byBase) return byBase[base]!;

  return DEFAULT_LOCALE;
}

export function detectNavigatorLocale(): AppLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates = [
    navigator.language,
    ...(navigator.languages ?? []),
  ].filter(Boolean) as string[];
  for (const tag of candidates) {
    const normalized = normalizeLocale(tag);
    if (normalized !== DEFAULT_LOCALE || tag.toLowerCase().startsWith('en')) {
      return normalized;
    }
  }
  return normalizeLocale(candidates[0]);
}
