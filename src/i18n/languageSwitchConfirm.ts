import { i18n } from '@/i18n';
import type { AppLocale } from '@/i18n/manifestLocales';

export type LanguageChangeConfirmCopy = {
  title: string;
  message: string;
  confirm: string;
  cancel: string;
};

/** Confirm dialog strings: primary copy in target locale, cancel in current locale. */
export function getLanguageChangeConfirmCopy(
  targetLocale: AppLocale,
  currentLocale: AppLocale,
): LanguageChangeConfirmCopy {
  return {
    title: i18n.t('settings:language.changeConfirm.title', { lng: targetLocale }),
    message: i18n.t('settings:language.changeConfirm.message', { lng: targetLocale }),
    confirm: i18n.t('settings:language.changeConfirm.confirm', { lng: targetLocale }),
    cancel: i18n.t('settings:language.changeConfirm.cancel', { lng: currentLocale }),
  };
}
