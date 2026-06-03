import type { AppLocale } from './manifestLocales';

/** `common.json` keys for native language names in the switcher. */
export const LOCALE_LABEL_KEYS: Record<
  AppLocale,
  | 'languageDe'
  | 'languageEn'
  | 'languageEs'
  | 'languageEsMx'
  | 'languageFr'
  | 'languageIt'
  | 'languageJa'
  | 'languageKo'
  | 'languagePl'
  | 'languagePtBr'
  | 'languageRu'
  | 'languageZhChs'
  | 'languageZhCht'
> = {
  de: 'languageDe',
  en: 'languageEn',
  es: 'languageEs',
  'es-mx': 'languageEsMx',
  fr: 'languageFr',
  it: 'languageIt',
  ja: 'languageJa',
  ko: 'languageKo',
  pl: 'languagePl',
  'pt-br': 'languagePtBr',
  ru: 'languageRu',
  'zh-chs': 'languageZhChs',
  'zh-cht': 'languageZhCht',
};
