import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { OnboardingStepActions } from '@/components/onboarding/OnboardingBackButton';
import { hasActiveSession, restoreMembership, clearSession } from '@/lib/bungie/loadVault';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { resetBootstrapVaultLoad } from '@/lib/bungie/vaultBootstrap';
import { vaultErrorHint } from '@/lib/vault/errors';
import {
  buildVaultInventorySnapshot,
  estimateVaultTrim,
  VAULT_KEEP_OPTIONS,
} from '@/lib/onboarding/inventorySnapshot';
import {
  loadOnboardingProgress,
  markBackToRules,
  markInventoryComplete,
} from '@/lib/onboarding/storage';
import { useAuthStore, usePrefsStore, useSessionStore, useVaultStore, resetVaultStore } from '@/stores';
import type { VaultKeepPreference } from '@/types';

export function InventorySnapshotPage() {
  const navigate = useNavigate();
  const { membership, setMembership } = useAuthStore();
  const { allItems, classStates, loadLiveVault, vaultLoading, vaultRefreshing, vaultError, vaultStatus, lastParsedCount } =
    useVaultStore();
  const { profile, updateProfile } = usePrefsStore();
  const savedPref =
    loadOnboardingProgress()?.vaultKeepPreference ?? profile.vaultKeepPreference ?? 'balanced';
  const [preference, setPreference] = useState<VaultKeepPreference>(savedPref);

  useEffect(() => {
    if (!membership) {
      const restored = restoreMembership();
      if (restored && getBungieAccessToken()) {
        setMembership(restored);
        return;
      }
      navigate('/');
      return;
    }
  }, [membership, navigate, setMembership]);

  const snapshot = useMemo(() => buildVaultInventorySnapshot(allItems), [allItems]);
  const trim = useMemo(() => estimateVaultTrim(snapshot, preference), [snapshot, preference]);
  const tieredCount = allItems.length;

  function handleSignOutBack() {
    clearSession();
    useSessionStore.getState().clearSession();
    setMembership(null);
    resetVaultStore();
    markBackToRules();
    navigate('/');
  }

  function handleContinue() {
    updateProfile((p) => ({ ...p, vaultKeepPreference: preference }));
    markInventoryComplete(preference);
    navigate('/onboarding/calibrate');
  }

  if (!membership) {
    const mayRestore = Boolean(getBungieAccessToken()) || hasActiveSession();
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg mb-2">
            {mayRestore ? 'Restoring Bungie session…' : 'Redirecting to login…'}
          </p>
          <p className="text-sm text-muted">Please wait</p>
        </div>
      </Layout>
    );
  }

  if (vaultLoading && !classStates.hunter) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg mb-2">Loading vault…</p>
          <p className="text-sm text-muted">{vaultStatus ?? 'Please wait'}</p>
        </div>
      </Layout>
    );
  }

  if (vaultError && !classStates.hunter) {
    const hint = vaultErrorHint(vaultError);
    return (
      <Layout>
        <div className="py-20 text-center max-w-md mx-auto">
          <p className="text-danger mb-2">{vaultError}</p>
          {hint && <p className="text-sm text-muted mb-4">{hint}</p>}
          <button
            type="button"
            disabled={vaultLoading || vaultRefreshing}
            onClick={() => {
              resetBootstrapVaultLoad();
              loadLiveVault({ force: true });
            }}
            className="px-4 py-2 rounded-lg bg-accent text-surface font-medium disabled:opacity-50"
          >
            {vaultLoading || vaultRefreshing ? 'Retrying…' : 'Retry vault load'}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-2">Vault trim goal</h1>
      <p className="text-muted mb-8 max-w-2xl">
        {tieredCount > 0 ? (
          <>
            Found <span className="text-white font-medium tabular-nums">{tieredCount}</span> tiered
            armor {tieredCount === 1 ? 'piece' : 'pieces'}
            {snapshot.totalT5 > 0 && (
              <>
                {' '}
                (<span className="tabular-nums">{snapshot.totalT5}</span> at Tier 5)
              </>
            )}
            .
          </>
        ) : (
          <>
            No tiered armor found
            {lastParsedCount !== null ? ` (parsed ${lastParsedCount} items from vault)` : ''}. Imports
            tiered armor (T1–T5) only; legacy and untiered gear is skipped.
          </>
        )}
      </p>

      {vaultRefreshing && (
        <div className="mb-4 text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
          Refreshing… {vaultStatus}
        </div>
      )}

      <section className="mb-8 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">
          How much do you want to keep?
        </h2>
        <p className="text-sm text-muted mb-4">
          Sets how aggressively we suggest trimming duplicate Tier 5 armor during cleaning.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {VAULT_KEEP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPreference(opt.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                preference === opt.id
                  ? 'border-white/30 bg-white/10'
                  : 'border-border bg-surface-2 hover:border-white/20'
              }`}
            >
              <div className="font-semibold text-white mb-1">{opt.label}</div>
              <div className="text-xs text-muted">{opt.description}</div>
            </button>
          ))}
        </div>
        {snapshot.totalT5 > 0 && (
          <p className="mt-4 text-sm text-muted">
            Keep goal: about {trim.totalTarget} Tier 5 total (about {trim.targetPerClass} per class).
            {trim.excess > 0 ? (
              <>
                {' '}
                You have about <span className="text-white">{trim.excess}</span> above that goal.
              </>
            ) : (
              <> You are at or below that goal.</>
            )}
          </p>
        )}
      </section>

      <OnboardingStepActions
        onBack={handleSignOutBack}
        backLabel="Sign out"
      >
        <button
          type="button"
          onClick={handleContinue}
          className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold hover:opacity-90"
        >
          Continue
        </button>
      </OnboardingStepActions>
    </Layout>
  );
}
