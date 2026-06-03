import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DupeRulesImpactTabs } from '@/components/DupeRulesImpactTabs';
import { Layout } from '@/components/Layout';
import { OnboardingBackButton } from '@/components/onboarding/OnboardingBackButton';
import {
  DUPE_GROUPING_TOGGLE_KEYS,
  dupeGroupingToggleLabel,
  dupeRespectKeepFavoriteLabel,
  respectDimKeepFavoriteChecked,
  respectDimKeepFavoritePatch,
} from '@/lib/dupes/ruleUi';
import {
  dupeMatchStyleCardDescription,
  dupeMatchStyleCardHeadline,
  dupeMatchStyleLabel,
  dupePresetLabel,
} from '@/lib/dupes/rules';
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
import { dupeSuggestionReason } from '@/i18n/dupesCopy';
import type { DupeSuggestionReasonKey } from '@/i18n/dupesCopy';
import { classLabel } from '@/i18n/gameCopy';
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

export function RulesOnboardingPage() {
  const { t } = useTranslation('rulesOnboarding');
  const { t: tc } = useTranslation('common');
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

  function formatImpactLine(buckets: number, review: number, className = classLabel('hunter')): string {
    if (buckets === 0) {
      return t('impact.none', { class: className });
    }
    return t('impact.summary', {
      buckets,
      review,
      class: className,
      groupWord: t('impact.group', { count: buckets }),
      rollWord: t('impact.roll', { count: review }),
    });
  }

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
            {mayRestore ? t('restoringSession') : t('redirectingLogin')}
          </p>
          <p className="text-sm text-muted">{tc('pleaseWait')}</p>
        </div>
      </Layout>
    );
  }

  if (vaultLoading && !classStates.hunter) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg mb-2">{t('loadingVault')}</p>
          <p className="text-sm text-muted">{vaultStatus ?? tc('pleaseWait')}</p>
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
            {vaultLoading || vaultRefreshing ? tc('retrying') : t('retryVaultLoad')}
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
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-md">{t('intro')}</p>
        </header>

        {vaultRefreshing && (
          <p className="mb-6 text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
            {t('refreshing')} {vaultStatus}
          </p>
        )}

        {hunter && hunter.profile.totalT5 === 0 && !vaultLoading && !vaultRefreshing && (
          <p className="mb-6 text-sm text-muted border border-border rounded-lg px-4 py-3 bg-surface-2">
            {t('noTieredArmor')}
            {lastParsedCount !== null
              ? ` ${t('tieredPiecesImported', { count: lastParsedCount })}`
              : ''}
            . {t('tieredArmorFootnote')}
          </p>
        )}

        <section className="mb-6" aria-labelledby="recommended-preset">
          <h2 id="recommended-preset" className="sr-only">
            {t('recommendedPresetSr')}
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
                {t('useRecommended')}
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
            {tc('continue')}
          </button>
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="text-sm text-muted hover:text-white transition-colors self-center"
            aria-expanded={showCustomize}
          >
            {showCustomize ? t('hideCustomization') : t('customizeRules')}
          </button>
        </div>

        {showCustomize && (
          <section className="mb-10 space-y-6 border-t border-border/60 pt-8">
            <div className="space-y-4">
              <p className="text-sm text-muted">{t('customizeIntro')}</p>
              <p className="text-xs text-muted">
                {t('matchStyleLabel')}{' '}
                <span className="text-white/90 font-medium">{matchStyleLabel}</span>
              </p>
              <div className="flex flex-col gap-3 text-sm" role="group" aria-label={t('aria.dupeRules')}>
                {DUPE_GROUPING_TOGGLE_KEYS.map((key) => (
                  <Toggle
                    key={key}
                    label={dupeGroupingToggleLabel(key)}
                    checked={globalDupeRules[key]}
                    onChange={(v) => setGlobalDupeRules({ [key]: v })}
                  />
                ))}
                <Toggle
                  label={dupeRespectKeepFavoriteLabel()}
                  checked={respectDimKeepFavoriteChecked(globalDupeRules)}
                  onChange={(v) => setGlobalDupeRules(respectDimKeepFavoritePatch(v))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-2/50 p-4 min-h-[9.5rem]">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                {t('previewByClass')}
              </h3>
              <DupeRulesImpactTabs rules={globalDupeRules} plainLanguage />
            </div>

            <div className="min-h-[6.5rem] space-y-3" aria-live="polite">
              {suggestions.length > 0 && (
                <>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t('suggestions')}
                  </h3>
                  {suggestions.map((s, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 bg-surface-2/50">
                      <p className="text-sm text-white/90">
                        {dupeSuggestionReason(
                          s.reasonKey as DupeSuggestionReasonKey,
                          s.reasonParams,
                        )}
                      </p>
                      {s.presetId && (
                        <button
                          type="button"
                          onClick={() => applyPreset(s.presetId!)}
                          className="mt-3 text-xs text-accent-dim hover:text-white transition-colors"
                        >
                          {t('usePreset', {
                            label: dupePresetLabel(s.presetId),
                          })}
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
          <OnboardingBackButton onClick={handleBack} label={tc('signOut')} />
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
