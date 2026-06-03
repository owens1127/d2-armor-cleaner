import { getLanguageChangeConfirmCopy } from '@/i18n/languageSwitchConfirm';
import type { AppLocale } from '@/i18n/manifestLocales';

type LanguageChangeConfirmModalProps = {
  targetLocale: AppLocale;
  currentLocale: AppLocale;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function LanguageChangeConfirmModal({
  targetLocale,
  currentLocale,
  confirming,
  onConfirm,
  onCancel,
}: LanguageChangeConfirmModalProps) {
  const copy = getLanguageChangeConfirmCopy(targetLocale, currentLocale);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-change-confirm-title"
      data-testid="language-change-confirm"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label={copy.cancel}
        disabled={confirming}
        onClick={onCancel}
      />
      <div className="relative bg-surface-2 border border-border rounded-xl max-w-md w-full p-5 shadow-2xl">
        <h2 id="language-change-confirm-title" className="text-lg font-semibold mb-2">
          {copy.title}
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-5">{copy.message}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-white/5 disabled:opacity-50"
            data-testid="language-change-cancel"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="text-sm px-4 py-2 rounded-lg bg-accent text-surface font-medium hover:opacity-90 disabled:opacity-50"
            data-testid="language-change-confirm-btn"
          >
            {copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
