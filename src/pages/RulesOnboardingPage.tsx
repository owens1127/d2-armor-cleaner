import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DupeRulesImpactTabs } from '@/components/DupeRulesImpactTabs';
import { Layout } from '@/components/Layout';
import { OnboardingBackButton } from '@/components/onboarding/OnboardingBackButton';
import { DUPE_PRESETS } from '@/lib/constants';
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
import type { DupeRuleConfig, DupeRuleSuggestion } from '@/types';

const RECOMMENDED_PRESET_ID = 'setAware';

function isSetAwareRules(rules: DupeRuleConfig): boolean {
  return (
    rules.sameArmorSet &&
    !rules.sameTuningStat &&
    rules.ignoreTaggedKeep &&
    rules.ignoreTaggedFavorite
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

function formatSuggestionImpact(impact: DupeRuleSuggestion['impact']): string {
  const groupWord = impact.buckets === 1 ? 'group' : 'groups';
  const rollWord = impact.itemsToReview === 1 ? 'roll' : 'rolls';
  return `About ${impact.buckets} duplicate ${groupWord} · roughly ${impact.itemsToReview} ${rollWord} to compare`;
}

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
            <p className="text-sm font-medium text-white">Start with Set-aware</p>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Groups duplicates by armor set · works well for most vaults. DIM keep and favorite
              tags are ignored when picking junk.
            </p>
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
          <section className="mb-10 space-y-8 border-t border-border/60 pt-8">
            {hunter && (
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <SecondaryStat label="Tier 5 armor" value={hunter.profile.totalT5} />
                <SecondaryStat
                  label="Duplicate groups"
                  value={hunter.buckets.filter((b) => b.hasDupes).length}
                />
                <SecondaryStat
                  label="Large groups (5+)"
                  value={hunter.profile.totalT5 > 0 ? hunter.profile.heavyBuckets : 0}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted block mb-2">
                Match strictness: {strictness}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={strictness}
                onChange={(e) => setStrictness(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                {Object.entries(DUPE_PRESETS).map(([id, { label }]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyPreset(id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      id === RECOMMENDED_PRESET_ID && usingRecommended
                        ? 'border-accent/40 bg-white/5 text-white'
                        : 'border-border hover:bg-white/5 text-muted hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                  Suggestions
                </h3>
                {suggestions.map((s, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 bg-surface-2/50">
                    <p className="text-sm text-white/90">{s.reason}</p>
                    <p className="text-xs text-muted mt-2">{formatSuggestionImpact(s.impact)}</p>
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
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm">
              <Toggle
                label="Only compare same armor set"
                checked={globalDupeRules.sameArmorSet}
                onChange={(v) => setGlobalDupeRules({ sameArmorSet: v })}
              />
              <Toggle
                label="Only compare same tuning stat"
                checked={globalDupeRules.sameTuningStat}
                onChange={(v) => setGlobalDupeRules({ sameTuningStat: v })}
              />
              <Toggle
                label="Ignore DIM keep and favorite tags"
                checked={globalDupeRules.ignoreTaggedKeep}
                onChange={(v) =>
                  setGlobalDupeRules({ ignoreTaggedKeep: v, ignoreTaggedFavorite: v })
                }
              />
            </div>

            <div className="rounded-xl border border-border bg-surface-2/50 p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                Preview by class
              </h3>
              <DupeRulesImpactTabs rules={globalDupeRules} plainLanguage />
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

function SecondaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border/80 rounded-lg px-3 py-2 bg-surface-2/30">
      <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
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
