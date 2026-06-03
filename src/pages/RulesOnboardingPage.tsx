import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DupeRulesImpactTabs } from '@/components/DupeRulesImpactTabs';
import { Layout } from '@/components/Layout';
import { OnboardingBackButton } from '@/components/onboarding/OnboardingBackButton';
import { DUPE_PRESETS } from '@/lib/constants';
import {
  dupeMatchStyleCardDescription,
  dupeMatchStyleCardHeadline,
  dupeMatchStyleLabel,
} from '@/lib/dupes/rules';
import {
  DUPE_GROUPING_TOGGLES,
  DUPE_RESPECT_KEEP_FAVORITE_LABEL,
  respectDimKeepFavoriteChecked,
  respectDimKeepFavoritePatch,
} from '@/lib/dupes/ruleUi';
import { dupeBucketCount, groupIntoBuckets, itemsToReview } from '@/lib/dupes/group';
import { hasActiveSession, restoreMembership, clearSession } from '@/lib/bungie/loadVault';
import { resetBootstrapVaultLoad } from '@/lib/bungie/vaultBootstrap';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { vaultErrorHint } from '@/lib/vault/errors';
import {
  loadOnboardingProgress,
  markRulesAccepted,
  markRulesPhase,
} from '@/lib/onboarding/storage';
import { useAuthStore, useSessionStore, useVaultStore, resetVaultStore } from '@/stores';
import type { DupeRuleConfig } from '@/types';

const RECOMMENDED_PRESET_ID = 'setAware';

function isSetAwareRules(rules: DupeRuleConfig): boolean {
  return (
    rules.sameArmorSet &&
    !rules.sameTuningStat &&
    !respectDimKeepFavoriteChecked(rules)
  );
}

function formatImpactLine(buckets: number, review: number, classLabel = 'Hunter'): string {
  if (buckets === 0) {
    return `No duplicate groups found for ${classLabel} at your current tier.`;
  }
  const groupWord = buckets === 1 ? 'group' : 'groups';
  const rollWord = review === 1 ? 'roll' : 'rolls';
  return `About ${buckets} duplicate ${groupWord} · roughly ${review} ${rollWord} to compare (${classLabel})`;
}

export function RulesOnboardingPage() {
  const navigate = useNavigate();
  const { membership, setMembership } = useAuthStore();
  const {
    classStates,
    globalDupeRules,
    applyPreset,
    setGlobalDupeRules,
    loadLiveVault,
    vaultLoading,
    vaultRefreshing,
    vaultError,
    vaultStatus,
    lastParsedCount,
  } = useVaultStore();
  const [showCustomize, setShowCustomize] = useState(false);
  const seededPreset = useRef(false);

  useEffect(() => {
    markRulesPhase();
  }, []);

  useEffect(() => {
    if (seededPreset.current) return;
    seededPreset.current = true;
    const progress = loadOnboardingProgress();
    if (!progress?.rulesAccepted && !isSetAwareRules(globalDupeRules)) {
      applyPreset(RECOMMENDED_PRESET_ID);
    }
  }, [applyPreset, globalDupeRules]);

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

  function handleContinue() {
    markRulesAccepted();
    navigate('/onboarding/inventory');
  }

  const hunter = classStates.hunter;
  const suggestions = hunter?.ruleSuggestions ?? [];
  const usingRecommended = isSetAwareRules(globalDupeRules);
  const matchStyleLabel = dupeMatchStyleLabel(globalDupeRules);
  const matchStyleHeadline = dupeMatchStyleCardHeadline(globalDupeRules);
  const matchStyleDescription = dupeMatchStyleCardDescription(globalDupeRules);

  const hunterImpact = useMemo(() => {
    if (!hunter) return null;
    const buckets = groupIntoBuckets(hunter.items, globalDupeRules);
    return {
      buckets: dupeBucketCount(buckets),
      review: itemsToReview(buckets),
    };
  }, [hunter, globalDupeRules]);

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
      <div className="max-w-xl mx-auto py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="ui-heading text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            How should duplicates match?
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-md">
            We group similar armor rolls so you can pick a keeper and tag the rest in DIM. You can
            change this anytime in Settings.
          </p>
        </header>

        {vaultRefreshing && (
          <p className="mb-6 text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
            Refreshing… {vaultStatus}
          </p>
        )}

        {hunter && hunter.profile.totalT5 === 0 && !vaultLoading && !vaultRefreshing && (
          <p className="mb-6 text-sm text-muted border border-border rounded-lg px-4 py-3 bg-surface-2">
            No tiered armor in scope at your minimum tier
            {lastParsedCount !== null ? ` (${lastParsedCount} tiered pieces imported)` : ''}. Only
            in-game tiered gear (T1–T5) is included. Lower the minimum tier in Settings if needed.
          </p>
        )}

        <section className="mb-6" aria-labelledby="recommended-preset">
          <h2 id="recommended-preset" className="sr-only">
            Recommended preset
          </h2>
          <div
            className={`rounded-xl border p-4 transition-colors ${
              usingRecommended
                ? 'border-accent/50 bg-surface-2/80'
                : 'border-border bg-surface-2/50'
            }`}
          >
            <p className="text-sm font-medium text-white">{matchStyleHeadline}</p>
            <p className="mt-1 text-sm text-muted leading-relaxed">{matchStyleDescription}</p>
            {hunterImpact && (
              <p className="mt-3 text-sm text-muted">
                {formatImpactLine(hunterImpact.buckets, hunterImpact.review)}
              </p>
            )}
            {!usingRecommended && (
              <button
                type="button"
                onClick={() => applyPreset(RECOMMENDED_PRESET_ID)}
                className="mt-3 text-sm text-accent-dim hover:text-white transition-colors"
              >
                Use recommended
              </button>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 mb-8">
          <button
            type="button"
            onClick={handleContinue}
            className="ui-btn-primary w-full py-3 text-sm font-semibold"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="text-sm text-muted hover:text-white transition-colors self-center"
            aria-expanded={showCustomize}
          >
            {showCustomize ? 'Hide customization' : 'Customize rules'}
          </button>
        </div>

        {showCustomize && (
          <section className="mb-10 space-y-6 border-t border-border/60 pt-8">
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Tighten or loosen what counts as a duplicate. Presets in Settings set these in one
                click.
              </p>
              <p className="text-xs text-muted">
                Match style:{' '}
                <span className="text-white/90 font-medium">{matchStyleLabel}</span>
              </p>
              <div className="flex flex-col gap-3 text-sm" role="group" aria-label="Dupe rules">
                {DUPE_GROUPING_TOGGLES.map(({ key, label }) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={globalDupeRules[key]}
                    onChange={(v) => setGlobalDupeRules({ [key]: v })}
                  />
                ))}
                <Toggle
                  label={DUPE_RESPECT_KEEP_FAVORITE_LABEL}
                  checked={respectDimKeepFavoriteChecked(globalDupeRules)}
                  onChange={(v) => setGlobalDupeRules(respectDimKeepFavoritePatch(v))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-2/50 p-4 min-h-[9.5rem]">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                Preview by class
              </h3>
              <DupeRulesImpactTabs rules={globalDupeRules} plainLanguage />
            </div>

            <div className="min-h-[6.5rem] space-y-3" aria-live="polite">
              {suggestions.length > 0 && (
                <>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                    Suggestions
                  </h3>
                  {suggestions.map((s, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 bg-surface-2/50">
                      <p className="text-sm text-white/90">{s.reason}</p>
                      {s.presetId && (
                        <button
                          type="button"
                          onClick={() => applyPreset(s.presetId!)}
                          className="mt-3 text-xs text-accent-dim hover:text-white transition-colors"
                        >
                          Use {DUPE_PRESETS[s.presetId]?.label ?? s.presetId}
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        <div className="pt-6 border-t border-border/60">
          <OnboardingBackButton onClick={handleBack} label="Sign out" />
        </div>
      </div>
    </Layout>
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
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span className="text-muted">{label}</span>
    </label>
  );
}
