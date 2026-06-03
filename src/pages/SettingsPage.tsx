import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DupeRulesImpact } from '@/components/DupeRulesImpact';
import { Layout } from '@/components/Layout';
import { desiredBuildsEditorPath, settingsPath } from '@/lib/nav';
import {
  COMBOS_SECTION_ID,
  DUPE_RULES_SECTION_ID,
  normalizeHashTargetId,
} from '@/lib/nav/hashScroll';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
import { DUPE_MIN_TIER_VALUES, DUPE_PRESETS, formatDupeMinTierLabel } from '@/lib/constants';
import {
  DUPE_EXCLUDE_JUNK_LABEL,
  DUPE_GROUPING_TOGGLES,
  DUPE_RESPECT_KEEP_FAVORITE_HELP,
  DUPE_RESPECT_KEEP_FAVORITE_LABEL,
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
import { ARCHETYPE_LABELS, CLASS_LABELS, CLASSES, STAT_LABELS, STATS } from '@/lib/constants';
import { parseImportedPrefs } from '@/lib/prefs/storage';
import { useEffect, useRef, useState } from 'react';
import type { ClassType } from '@/types';

export function SettingsPage() {
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

  const classPrefs = getClassPrefs(profile, classType);
  const topStats = [...STATS]
    .sort((a, b) => (classPrefs.statWeights[b] ?? 0) - (classPrefs.statWeights[a] ?? 0))
    .slice(0, 3);
  const topArchetypes = (Object.entries(classPrefs.archetypeWeights) as [import('@/types').Archetype, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (!membership) return <Navigate to="/" replace />;

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
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">Account</h2>
        <p className="text-sm mb-3">
          Signed in as <span className="text-accent-dim">{membership.displayName}</span>
        </p>
        {lastParsedCount !== null && (
          <p className="text-xs text-muted mb-3">
            {lastParsedCount} tiered armor pieces parsed (vault, all characters, postmaster)
          </p>
        )}
        <p className="text-xs text-muted mb-2">
          Sign out clears Bungie and DIM tokens from this browser session (session storage
          only). Preferences stay in local storage.
        </p>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-danger hover:underline"
        >
          Sign out and clear tokens
        </button>
      </section>

      {isDevBuild() && (
        <section className="mb-10 max-w-xl">
          <h2 className="text-sm font-semibold uppercase text-muted mb-3">Developer</h2>
          <ul className="text-sm space-y-1 text-muted">
            <li>Bungie: {isBungieConfigured() ? 'configured' : 'not configured'}</li>
            <li>DIM Sync: {getDimApiKey() ? 'configured' : 'not configured'}</li>
          </ul>
          {!getDimApiKey() && (
            <p className="text-xs text-muted mt-2">
              Local DIM key: POST to api.destinyitemmanager.com/new_app with origin{' '}
              {typeof window !== 'undefined' ? window.location.origin : 'this site'}.
            </p>
          )}
        </section>
      )}

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">Review tags</h2>
        <p className="text-sm text-muted mb-3">
          {pendingTagCount > 0
            ? `${pendingTagCount} tag${pendingTagCount === 1 ? '' : 's'} queued to apply in DIM.`
            : 'No pending tags.'}
        </p>
        {pendingTagCount > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/review" className="text-sm text-white hover:underline">
              Open review page
            </Link>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `Clear all ${pendingTagCount} pending tags? They will not be applied to DIM.`,
                  )
                ) {
                  clearPendingTags();
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
            >
              Clear pending tags
            </button>
          </div>
        )}
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {CLASS_LABELS[classType]} preferences
        </h2>
        <p className="text-xs text-muted mb-3">
          Using {CLASS_LABELS[classType]} (change class in header). Per-class stat and
          archetype weights from calibration. Dupe rules are shared unless overridden per class.
        </p>
        <p className="text-sm text-muted mb-3">
          {getCalibrationChoiceCount(classPrefs)} calibrations · confidence{' '}
          {getCalibrationConfidence(classPrefs)}
        </p>
        <div className="text-sm space-y-2">
          <p>
            <span className="text-muted">Top stats:</span>{' '}
            {topStats.map((s) => STAT_LABELS[s]).join(', ')}
          </p>
          <p>
            <span className="text-muted">Top archetypes:</span>{' '}
            {topArchetypes.map(([a]) => ARCHETYPE_LABELS[a]).join(', ')}
          </p>
        </div>
        <Link
          to={`/onboarding/calibrate?class=${classType}`}
          className="inline-block mt-3 text-sm text-accent-dim hover:underline"
        >
          Recalibrate {CLASS_LABELS[classType]}
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
            Export prefs
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
          >
            Import prefs
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
                setImportMsg('Preferences imported.');
              } catch {
                setImportMsg('Invalid prefs file.');
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
                  `Reset ${CLASS_LABELS[classType]} preferences to defaults? Stat weights, calibration choices, and learned weights for this class will be cleared.`,
                )
              ) {
                updateProfile((p) => resetClassPrefs(p, classType));
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
          >
            Reset {CLASS_LABELS[classType]} preferences
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  'Reset preferences for all classes to defaults? Stat weights, calibration choices, and learned weights will be cleared for Hunter, Titan, and Warlock. Dupe rules and other settings are kept.',
                )
              ) {
                updateProfile(resetAllClassPrefs);
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
          >
            Reset all classes
          </button>
        </div>
        {importMsg && <p className="text-xs text-muted mt-2">{importMsg}</p>}
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">
          {CLASS_LABELS[classType]} dupe rules
        </h2>
        <p className="text-xs text-muted mb-3">
          Using {CLASS_LABELS[classType]} (change class in header). Classes share global rules
          by default. Apply a preset to one class without changing others.
        </p>
        {classRuleOverrides[classType] && (
          <p className="text-xs text-accent-dim mb-2">
            {CLASS_LABELS[classType]} uses custom rules ·{' '}
            <button
              type="button"
              onClick={() => resetClassDupeRules(classType)}
              className="underline hover:text-white"
            >
              reset to global
            </button>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {Object.entries(DUPE_PRESETS).map(([id, { label }]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id, classType)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-white/5"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">Dupe presets</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DUPE_PRESETS).map(([id, { label }]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className="px-3 py-1.5 rounded-full border border-border text-sm hover:bg-white/5"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section id={DUPE_RULES_SECTION_ID} className="mb-10 max-w-xl space-y-4 scroll-mt-24">
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted mb-2">Dupe rules</h2>
          <p className="text-sm text-muted max-w-lg">
            Shared rules for heatmap, compare, browse, and redundant-roll lists.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Scope: which pieces count
          </h3>
          <label className="flex flex-col gap-1 text-sm">
            <span>Minimum gear tier</span>
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
            <span className="text-xs text-muted">
              Vault import still loads tiers 1 through 5. Only pieces at or above this tier enter dupe
              buckets and redundant-roll checks.
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Grouping: what counts as a &quot;dupe&quot;
          </h3>
          <p className="text-xs text-muted -mt-2">
            Pieces always match on class, slot, archetype, and tertiary stat. These options add
            stricter splits, and they apply to redundant-roll comparisons too.
          </p>
          {DUPE_GROUPING_TOGGLES.map(({ key, label, help }) => (
            <label key={key} className="flex gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={globalDupeRules[key]}
                onChange={(e) => setGlobalDupeRules({ [key]: e.target.checked })}
                className="accent-accent mt-0.5"
              />
              <span>
                <span className="block">{label}</span>
                <span className="block text-xs text-muted mt-0.5">{help}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            DIM tags when counting dupes
          </h3>
          <p className="text-xs text-muted -mt-2">
            Tagged pieces stay visible but can be left out of dupe bucket sizes and review counts.
          </p>
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
              <span className="block">{DUPE_RESPECT_KEEP_FAVORITE_LABEL}</span>
              <span className="block text-xs text-muted mt-0.5">
                {DUPE_RESPECT_KEEP_FAVORITE_HELP}
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
            {DUPE_EXCLUDE_JUNK_LABEL}
          </label>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted mb-2">Live impact (global rules, Hunter vault)</p>
          <DupeRulesImpact rules={globalDupeRules} classType="hunter" />
        </div>
      </section>

      <Link to="/dashboard/hunter" className="block mt-8 text-sm text-muted hover:text-white">
        Dashboard
      </Link>
    </Layout>
  );
}
