import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  commitLocaleChangeWithReload,
  resolveLocaleFromCommit,
  type LocaleChangeCommit,
} from '@/i18n/commitLocaleChange';
import {
  applyManualLocale,
  getAppLocale,
  readUseBrowserLanguage,
  setUseBrowserLanguage,
  type AppLocale,
} from '@/i18n';
import { LOCALE_LABEL_KEYS } from '@/i18n/localeLabels';
import { readManualLocale } from '@/i18n/localePreferences';
import { SUPPORTED_LOCALES } from '@/i18n/resources';
import { LanguageChangeConfirmModal } from '@/components/LanguageChangeConfirmModal';

type LanguageSwitcherProps = {
  className?: string;
  id?: string;
};

export function LanguageSwitcher({ className = '', id }: LanguageSwitcherProps) {
  const { t } = useTranslation(['common', 'settings']);
  const currentLocale = getAppLocale();
  const [useBrowser, setUseBrowser] = useState(readUseBrowserLanguage);
  const [selectLocale, setSelectLocale] = useState<AppLocale>(currentLocale);
  const [pending, setPending] = useState<LocaleChangeCommit | null>(null);
  const [confirming, setConfirming] = useState(false);

  const applyWithoutReload = useCallback((commit: LocaleChangeCommit) => {
    if (commit.useBrowser) {
      setUseBrowser(true);
      setUseBrowserLanguage(true);
      return;
    }
    setUseBrowser(false);
    setSelectLocale(commit.locale);
    applyManualLocale(commit.locale);
  }, []);

  const requestLocaleChange = useCallback(
    (commit: LocaleChangeCommit) => {
      const target = resolveLocaleFromCommit(commit);
      if (target === currentLocale) {
        applyWithoutReload(commit);
        return;
      }
      setPending(commit);
    },
    [applyWithoutReload, currentLocale],
  );

  const onToggleBrowser = useCallback(
    (checked: boolean) => {
      if (checked) {
        requestLocaleChange({ useBrowser: true });
        return;
      }
      const manual = readManualLocale();
      setSelectLocale(manual);
      requestLocaleChange({ useBrowser: false, locale: manual });
    },
    [requestLocaleChange],
  );

  const onSelectLocale = useCallback(
    (locale: AppLocale) => {
      setSelectLocale(locale);
      requestLocaleChange({ useBrowser: false, locale });
    },
    [requestLocaleChange],
  );

  const dismissPending = useCallback(() => {
    setPending(null);
    setSelectLocale(currentLocale);
    setUseBrowser(readUseBrowserLanguage());
  }, [currentLocale]);

  const onConfirmPending = useCallback(async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      await commitLocaleChangeWithReload(pending);
    } catch {
      setConfirming(false);
      dismissPending();
    }
  }, [pending, dismissPending]);

  const pendingTarget = pending ? resolveLocaleFromCommit(pending) : null;

  return (
    <>
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
            value={selectLocale}
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

      {pending && pendingTarget && (
        <LanguageChangeConfirmModal
          targetLocale={pendingTarget}
          currentLocale={currentLocale}
          confirming={confirming}
          onConfirm={() => void onConfirmPending()}
          onCancel={dismissPending}
        />
      )}
    </>
  );
}
