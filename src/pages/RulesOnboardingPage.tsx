import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DupeRulesImpactTabs } from '@/components/DupeRulesImpactTabs';
import { Layout } from '@/components/Layout';
import { OnboardingStepActions } from '@/components/onboarding/OnboardingBackButton';
import { DUPE_PRESETS } from '@/lib/constants';
import { hasActiveSession, restoreMembership, clearSession } from '@/lib/bungie/loadVault';
import { resetBootstrapVaultLoad } from '@/lib/bungie/vaultBootstrap';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { vaultErrorHint } from '@/lib/vault/errors';
import { markRulesAccepted, markRulesPhase } from '@/lib/onboarding/storage';
import { useAuthStore, useSessionStore, useVaultStore, resetVaultStore } from '@/stores';

export function RulesOnboardingPage() {
  const navigate = useNavigate();
  const { membership, setMembership } = useAuthStore();
  const {
    classStates,
    globalDupeRules,
    strictness,
    setStrictness,
    applyPreset,
    setGlobalDupeRules,
    loadLiveVault,
    vaultLoading,
    vaultRefreshing,
    vaultError,
    vaultStatus,
    lastParsedCount,
  } = useVaultStore();

  useEffect(() => {
    markRulesPhase();
  }, []);

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

  function handleBack() {
    clearSession();
    useSessionStore.getState().clearSession();
    setMembership(null);
    resetVaultStore();
    navigate('/');
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

  const hunter = classStates.hunter;
  const suggestions = hunter?.ruleSuggestions ?? [];

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-2">Dupe rules</h1>
      <p className="text-muted mb-8 max-w-2xl">
        Choose which rolls count as duplicates. Preview uses your Hunter vault; rules apply globally by default.
      </p>

      {vaultRefreshing && (
        <div className="mb-4 text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
          Refreshing… {vaultStatus}
        </div>
      )}

      {hunter && hunter.profile.totalT5 === 0 && !vaultLoading && !vaultRefreshing && (
        <p className="mb-6 text-muted border border-border rounded-lg px-4 py-3 text-sm bg-surface-2">
          No armor in dupe scope at your minimum tier
          {lastParsedCount !== null ? ` (imported ${lastParsedCount} tiered pieces total)` : ''}.
          Imports tiered armor (T1–T5) only; legacy and untiered gear skipped. Preview uses Tier 5;
          change minimum tier in Settings for lower tiers.
        </p>
      )}

      {hunter && (
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Stat label="Tier 5 pieces" value={hunter.profile.totalT5} />
          <Stat label="Dupe buckets" value={hunter.buckets.filter((b) => b.hasDupes).length} />
          <Stat label="Buckets with 5+ items" value={hunter.profile.totalT5 > 0 ? hunter.profile.heavyBuckets : 0} />
        </div>
      )}

      <div className="mb-8">
        <label className="text-sm text-muted block mb-2">
          Strictness: {strictness}
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={strictness}
          onChange={(e) => setStrictness(Number(e.target.value))}
          className="w-full max-w-md accent-accent"
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.entries(DUPE_PRESETS).map(([id, { label }]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-white/5"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 mb-8 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Suggestions
        </h2>
        {suggestions.length === 0 && (
          <p className="text-sm text-muted">No suggestions yet: load vault data first.</p>
        )}
        {suggestions.map((s, i) => (
          <div key={i} className="border border-border rounded-lg p-4 bg-surface-2">
            <p className="text-sm">{s.reason}</p>
            <p className="text-xs text-muted mt-2">
              ~{s.impact.itemsToReview} items to review across {s.impact.buckets} buckets
            </p>
            {s.presetId && (
              <button
                type="button"
                onClick={() => applyPreset(s.presetId!)}
                className="mt-3 text-xs text-accent-dim hover:underline"
              >
                Apply {DUPE_PRESETS[s.presetId]?.label ?? s.presetId} preset
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <Toggle
          label="Require same armor set"
          checked={globalDupeRules.sameArmorSet}
          onChange={(v) => setGlobalDupeRules({ sameArmorSet: v })}
        />
        <Toggle
          label="Require same tuning stat"
          checked={globalDupeRules.sameTuningStat}
          onChange={(v) => setGlobalDupeRules({ sameTuningStat: v })}
        />
        <Toggle
          label="Ignore DIM keep/favorite"
          checked={globalDupeRules.ignoreTaggedKeep}
          onChange={(v) => setGlobalDupeRules({ ignoreTaggedKeep: v, ignoreTaggedFavorite: v })}
        />
      </div>

      <div className="mb-8 p-4 border border-border rounded-xl bg-surface-2 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">
          Live impact
        </h2>
        <DupeRulesImpactTabs rules={globalDupeRules} />
      </div>

      <OnboardingStepActions
        onBack={handleBack}
        backLabel="Sign out"
      >
        <button
          type="button"
          onClick={() => {
            markRulesAccepted();
            navigate('/onboarding/inventory');
          }}
          className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold hover:opacity-90"
        >
          Continue
        </button>
      </OnboardingStepActions>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface-2">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      {label}
    </label>
  );
}
