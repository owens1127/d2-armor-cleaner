import { useTranslation } from 'react-i18next';

export function PageFallback() {
  const { t } = useTranslation('common');
  return (
    <div className="py-20 text-center" role="status" aria-live="polite">
      <p className="text-muted">{t('pleaseWait')}</p>
    </div>
  );
}
