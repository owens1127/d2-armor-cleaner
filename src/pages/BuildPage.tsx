import { Navigate, useParams } from 'react-router-dom';
import { classLabel } from '@/i18n/gameCopy';
import { CLASSES } from '@/lib/constants';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { DesiredBuildsSection } from '@/components/settings/DesiredBuildsSection';
import { BuildCoveragePanel } from '@/components/dashboard/BuildCoveragePanel';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
import { getClassPrefs } from '@/lib/prefs/profile';
import { useVaultFocusRefresh } from '@/lib/vault/useVaultFocusRefresh';
import { usePrefsStore, useVaultStore } from '@/stores';
import type { ClassType } from '@/types';

export function BuildPage() {
  useScrollToLocationHash();
  useVaultFocusRefresh({ refreshOnMount: true });
  const { t } = useTranslation(['build', 'vault', 'common']);
  const { class: classParam } = useParams<{ class: string }>();
  const classType = (classParam ?? 'hunter') as ClassType;
  const validClass = CLASSES.includes(classType);
  const { classStates, vaultLoading, vaultStatus } = useVaultStore();
  const { profile } = usePrefsStore();

  if (!validClass) return <Navigate to="/combos/hunter" replace />;

  const state = classStates[classType];

  if (vaultLoading && !state) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg mb-2">{t('vault:loading')}</p>
          <p className="text-sm text-muted">{vaultStatus ?? t('common:pleaseWait')}</p>
        </div>
      </Layout>
    );
  }

  if (!state) {
    return (
      <Layout>
        <p className="text-muted">{t('vault:noDataBuildHint')}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          {t('build:title', { class: classLabel(classType) })}
        </h1>
        <p className="max-w-2xl text-sm text-muted/90">{t('build:intro')}</p>
      </div>

      <BuildCoveragePanel
        classState={state}
        classType={classType}
        prefs={getClassPrefs(profile, classType)}
      />

      <div className="mt-10 border-t border-white/10 pt-8">
        <DesiredBuildsSection
          defaultClass={classType}
          hideCoverageLink
          vaultItems={state.items}
        />
      </div>
    </Layout>
  );
}
