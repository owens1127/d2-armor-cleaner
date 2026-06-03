import { useTranslation } from 'react-i18next';
import { AutoFilterRulesSection } from '@/components/AutoFilterRulesSection';
import { Layout } from '@/components/Layout';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
export function AutoFiltersPage() {
  useScrollToLocationHash();
  const { t } = useTranslation('autoFilters');

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-muted text-sm mb-6 max-w-xl">{t('intro')}</p>
      <AutoFilterRulesSection />
    </Layout>
  );
}
