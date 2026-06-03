import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyManualLocale,
  getAppLocale,
  readUseBrowserLanguage,
  setUseBrowserLanguage,
  type AppLocale,
} from '@/i18n';
import { LOCALE_LABEL_KEYS } from '@/i18n/localeLabels';
import { SUPPORTED_LOCALES } from '@/i18n/resources';

type LanguageSwitcherProps = {
  className?: string;
  id?: string;
};

export function LanguageSwitcher({ className = '', id }: LanguageSwitcherProps) {
  const { t } = useTranslation(['common', 'settings']);
  const [useBrowser, setUseBrowser] = useState(readUseBrowserLanguage);
  const active = getAppLocale();

  const onToggleBrowser = useCallback(
    (checked: boolean) => {
      setUseBrowser(checked);
      setUseBrowserLanguage(checked);
    },
    [],
  );

  const onSelectLocale = useCallback((locale: AppLocale) => {
    setUseBrowser(false);
    applyManualLocale(locale);
  }, []);

  return (
    <div
      className={`flex flex-col gap-3 text-sm max-w-xl ${className}`.trim()}
      data-testid="language-switcher"
    >
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={useBrowser}
          onChange={(e) => onToggleBrowser(e.target.checked)}
          className="mt-1"
          data-testid="language-use-browser"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{t('settings:language.useBrowser')}</span>
          <span className="text-xs text-muted">{t('settings:language.useBrowserHelp')}</span>
        </span>
      </label>

      <label className="flex flex-col gap-1" htmlFor={id}>
        <span className="text-xs font-semibold uppercase text-muted">{t('common:language')}</span>
        <select
          id={id}
          value={active}
          disabled={useBrowser}
          onChange={(e) => onSelectLocale(e.target.value as AppLocale)}
          className="bg-surface border border-border rounded-md px-2 py-1.5 max-w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="language-select"
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {t(`common:${LOCALE_LABEL_KEYS[locale]}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
