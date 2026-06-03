import { Navigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { DesiredBuildsSection } from '@/components/settings/DesiredBuildsSection';
import { BuildCoveragePanel } from '@/components/dashboard/BuildCoveragePanel';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
import { CLASS_LABELS, CLASSES } from '@/lib/constants';
import { getClassPrefs } from '@/lib/prefs/profile';
import {
  getOnboardingResumePath,
  needsOnboardingRedirect,
} from '@/lib/onboarding/storage';
import { useVaultFocusRefresh } from '@/lib/vault/useVaultFocusRefresh';
import { useAuthStore, usePrefsStore, useVaultStore } from '@/stores';
import type { ClassType } from '@/types';

export function BuildPage() {
  useScrollToLocationHash();
  useVaultFocusRefresh({ refreshOnMount: true });
  const { class: classParam } = useParams<{ class: string }>();
  const classType = (classParam ?? 'hunter') as ClassType;
  const validClass = CLASSES.includes(classType);
  const { membership } = useAuthStore();
  const { classStates, vaultLoading, vaultStatus } = useVaultStore();
  const { profile } = usePrefsStore();

  if (!validClass) return <Navigate to="/combos/hunter" replace />;
  if (!membership) return <Navigate to="/" replace />;
  if (needsOnboardingRedirect()) {
    return <Navigate to={getOnboardingResumePath(false)} replace />;
  }

  const state = classStates[classType];

  if (vaultLoading && !state) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg mb-2">Loading vault…</p>
          <p className="text-sm text-muted">{vaultStatus ?? 'Please wait'}</p>
        </div>
      </Layout>
    );
  }

  if (!state) {
    return (
      <Layout>
        <p className="text-muted">No vault data yet. Load your vault from the dashboard.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          {CLASS_LABELS[classType]} combos
        </h1>
        <p className="max-w-2xl text-sm text-muted/90">
          Best vault pieces for each roll target in your combo.
        </p>
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
