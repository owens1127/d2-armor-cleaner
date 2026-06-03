import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { classLabel, statLabel, archetypeLabel } from '@/i18n/gameCopy';
import { Trans, useTranslation } from 'react-i18next';
import { DupeRulesImpact } from '@/components/DupeRulesImpact';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Layout } from '@/components/Layout';
import { desiredBuildsEditorPath, settingsPath } from '@/lib/nav';
import {
  COMBOS_SECTION_ID,
  DUPE_RULES_SECTION_ID,
  normalizeHashTargetId,
} from '@/lib/nav/hashScroll';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
import { CLASSES, DUPE_MIN_TIER_VALUES, DUPE_PRESETS, STATS, formatDupeMinTierLabel } from '@/lib/constants';
import { dupePresetLabel } from '@/lib/dupes/rules';
import {
  DUPE_GROUPING_TOGGLE_KEYS,
  dupeExcludeJunkLabel,
  dupeGroupingToggleHelp,
  dupeGroupingToggleLabel,
  dupeRespectKeepFavoriteHelp,
  dupeRespectKeepFavoriteLabel,
  respectDimKeepFavoriteChecked,
  respectDimKeepFavoritePatch,
} from '@/lib/dupes/ruleUi';
import { isBungieConfigured } from '@/lib/bungie/auth';
import { getDimApiKey } from '@/lib/dim/tags';
import { isDevBuild } from '@/lib/env';
import { clearSession } from '@/lib/bungie/loadVault';
import { clearOnboardingProgress } from '@/lib/onboarding/storage';
import { useAuthStore, useSessionStore, useVaultStore, resetVaultStore } from '@/stores';
import { usePrefsStore } from '@/stores';
import { getClassPrefs, resetAllClassPrefs, resetClassPrefs } from '@/lib/prefs/profile';
import {
  getCalibrationChoiceCount,
  getCalibrationConfidence,
} from '@/lib/prefs/calibrationChoices';
import { parseImportedPrefs } from '@/lib/prefs/storage';
import { useEffect, useRef, useState } from 'react';
import type { ClassType } from '@/types';

export function SettingsPage() {
  const { t } = useTranslation(['settings', 'common']);
  useScrollToLocationHash();
  const { class: classParam } = useParams<{ class: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const classType = (classParam ?? 'hunter') as ClassType;
  const validClass = CLASSES.includes(classType);
  const { membership, setMembership } = useAuthStore();
  const {
    globalDupeRules,
    setGlobalDupeRules,
    applyPreset,
    lastParsedCount,
    resetClassDupeRules,
    classRuleOverrides,
  } = useVaultStore();
  const { profile, updateProfile, setProfile } = usePrefsStore();
  const pendingTagCount = useSessionStore((s) => s.pendingTags.length);
  const clearPendingTags = useSessionStore((s) => s.clearPendingTags);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!location.hash) return;
    if (normalizeHashTargetId(location.hash) === COMBOS_SECTION_ID) {
      navigate(desiredBuildsEditorPath(classType), { replace: true });
    }
  }, [location.hash, classType, navigate]);

  if (!validClass) return <Navigate to={settingsPath('hunter')} replace />;
  if (!membership) return null;

  const classPrefs = getClassPrefs(profile, classType);
  const topStats = [...STATS]
    .sort((a, b) => (classPrefs.statWeights[b] ?? 0) - (classPrefs.statWeights[a] ?? 0))
    .slice(0, 3);
  const topArchetypes = (Object.entries(classPrefs.archetypeWeights) as [import('@/types').Archetype, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  function logout() {
    clearSession();
    useSessionStore.getState().clearSession();
    clearOnboardingProgress();
    useVaultStore.getState().setOnboardingComplete(false);
    setMembership(null);
    resetVaultStore();
    navigate('/');
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {t('language.heading')}
        </h2>
        <LanguageSwitcher id="settings-language" />
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {t('account.heading')}
        </h2>
        <p className="text-sm mb-3">
          <Trans
            i18nKey="account.signedInAs"
            ns="settings"
            values={{ name: membership.displayName }}
            components={{ 1: <span className="text-accent-dim" /> }}
          />
        </p>
        {lastParsedCount !== null && (
          <p className="text-xs text-muted mb-3">
            {t('account.parsedCount', { count: lastParsedCount })}
          </p>
        )}
        <p className="text-xs text-muted mb-2">{t('account.signOutNote')}</p>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-danger hover:underline"
        >
          {t('account.signOutButton')}
        </button>
      </section>

      {isDevBuild() && (
        <section className="mb-10 max-w-xl">
          <h2 className="text-sm font-semibold uppercase text-muted mb-3">{t('developer.heading')}</h2>
          <ul className="text-sm space-y-1 text-muted">
            <li>
              {t('developer.bungie', {
                status: isBungieConfigured() ? t('common:configured') : t('common:notConfigured'),
              })}
            </li>
            <li>
              {t('developer.dimSync', {
                status: getDimApiKey() ? t('common:configured') : t('common:notConfigured'),
              })}
            </li>
          </ul>
          {!getDimApiKey() && (
            <p className="text-xs text-muted mt-2">
              {t('common:dev.dimKeyHint', {
                origin: typeof window !== 'undefined' ? window.location.origin : 'this site',
              })}
            </p>
          )}
        </section>
      )}

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">{t('reviewTags.heading')}</h2>
        <p className="text-sm text-muted mb-3">
          {pendingTagCount > 0
            ? t('classPrefs.queued', { count: pendingTagCount })
            : t('classPrefs.nonePending')}
        </p>
        {pendingTagCount > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/review" className="text-sm text-white hover:underline">
              {t('classPrefs.openReview')}
            </Link>
            <button
              type="button"
              onClick={() => {
                if (confirm(t('classPrefs.confirmClearPending', { count: pendingTagCount }))) {
                  clearPendingTags();
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
            >
              {t('classPrefs.clearPending')}
            </button>
          </div>
        )}
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {t('classPrefs.heading', { class: classLabel(classType) })}
        </h2>
        <p className="text-xs text-muted mb-3">
          {t('classPrefs.usingClass', { class: classLabel(classType) })}
        </p>
        <p className="text-sm text-muted mb-3">
          {t('classPrefs.calibrations', {
            count: getCalibrationChoiceCount(classPrefs),
            confidence: getCalibrationConfidence(classPrefs),
          })}
        </p>
        <div className="text-sm space-y-2">
          <p>
            <span className="text-muted">{t('classPrefs.topStats')}</span>{' '}
            {topStats.map((s) => statLabel(s)).join(', ')}
          </p>
          <p>
            <span className="text-muted">{t('classPrefs.topArchetypes')}</span>{' '}
            {topArchetypes.map(([a]) => archetypeLabel(a)).join(', ')}
          </p>
        </div>
        <Link
          to={`/onboarding/calibrate?class=${classType}`}
          className="inline-block mt-3 text-sm text-accent-dim hover:underline"
        >
          {t('classPrefs.recalibrate', { class: classLabel(classType) })}
        </Link>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(profile, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'd2-armor-cleaner-prefs.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
          >
            {t('classPrefs.exportPrefs')}
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
          >
            {t('classPrefs.importPrefs')}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                setProfile(parseImportedPrefs(text));
                setImportMsg(t('classPrefs.imported'));
              } catch {
                setImportMsg(t('classPrefs.invalidFile'));
              }
              e.target.value = '';
              setTimeout(() => setImportMsg(null), 3000);
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  t('classPrefs.confirmResetClass', { class: classLabel(classType) }),
                )
              ) {
                updateProfile((p) => resetClassPrefs(p, classType));
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
          >
            {t('classPrefs.resetClass', { class: classLabel(classType) })}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(t('classPrefs.confirmResetAll'))) {
                updateProfile(resetAllClassPrefs);
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
          >
            {t('classPrefs.resetAll')}
          </button>
        </div>
        {importMsg && <p className="text-xs text-muted mt-2">{importMsg}</p>}
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {t('classDupeRules.heading', { class: classLabel(classType) })}
        </h2>
        <p className="text-xs text-muted mb-3">
          {t('classDupeRules.usingClass', { class: classLabel(classType) })}
        </p>
        {classRuleOverrides[classType] && (
          <p className="text-xs text-accent-dim mb-2">
            {t('classDupeRules.customRules', { class: classLabel(classType) })}{' '}
            <button
              type="button"
              onClick={() => resetClassDupeRules(classType)}
              className="underline hover:text-white"
            >
              {t('classDupeRules.resetToGlobal')}
            </button>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {Object.keys(DUPE_PRESETS).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id, classType)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-white/5"
            >
              {dupePresetLabel(id)}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {t('dupePresets.heading')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(DUPE_PRESETS).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className="px-3 py-1.5 rounded-full border border-border text-sm hover:bg-white/5"
            >
              {dupePresetLabel(id)}
            </button>
          ))}
        </div>
      </section>

      <section id={DUPE_RULES_SECTION_ID} className="mb-10 max-w-xl space-y-4 scroll-mt-24">
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted mb-2">
            {t('dupeRules.heading')}
          </h2>
          <p className="text-sm text-muted max-w-lg">{t('dupeRules.intro')}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('dupeRules.scopeHeading')}
          </h3>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('dupeRules.minTierLabel')}</span>
            <select
              value={globalDupeRules.minTier}
              onChange={(e) => setGlobalDupeRules({ minTier: Number(e.target.value) })}
              className="bg-surface border border-border rounded-md px-2 py-1.5 max-w-[140px]"
            >
              {DUPE_MIN_TIER_VALUES.map((tier) => (
                <option key={tier} value={tier}>
                  {formatDupeMinTierLabel(tier)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">{t('dupeRules.minTierHelp')}</span>
          </label>
        </div>

        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('dupeRules.groupingHeading')}
          </h3>
          <p className="text-xs text-muted -mt-2">{t('dupeRules.groupingIntro')}</p>
          {DUPE_GROUPING_TOGGLE_KEYS.map((key) => (
            <label key={key} className="flex gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={globalDupeRules[key]}
                onChange={(e) => setGlobalDupeRules({ [key]: e.target.checked })}
                className="accent-accent mt-0.5"
              />
              <span>
                <span className="block">{dupeGroupingToggleLabel(key)}</span>
                <span className="block text-xs text-muted mt-0.5">
                  {dupeGroupingToggleHelp(key)}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('dupeRules.dimTagsHeading')}
          </h3>
          <p className="text-xs text-muted -mt-2">{t('dupeRules.dimTagsIntro')}</p>
          <label className="flex gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={respectDimKeepFavoriteChecked(globalDupeRules)}
              onChange={(e) =>
                setGlobalDupeRules(respectDimKeepFavoritePatch(e.target.checked))
              }
              className="accent-accent mt-0.5"
            />
            <span>
              <span className="block">{dupeRespectKeepFavoriteLabel()}</span>
              <span className="block text-xs text-muted mt-0.5">
                {dupeRespectKeepFavoriteHelp()}
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={globalDupeRules.ignoreTaggedJunk}
              onChange={(e) => setGlobalDupeRules({ ignoreTaggedJunk: e.target.checked })}
              className="accent-accent"
            />
            {dupeExcludeJunkLabel()}
          </label>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted mb-2">{t('dupeRules.liveImpact')}</p>
          <DupeRulesImpact rules={globalDupeRules} classType="hunter" />
        </div>
      </section>

      <Link to="/dashboard/hunter" className="block mt-8 text-sm text-muted hover:text-white">
        {t('dashboardLink')}
      </Link>
    </Layout>
  );
}
