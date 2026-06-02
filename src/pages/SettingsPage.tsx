import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
import { DupeRulesImpact } from '@/components/DupeRulesImpact';
import { DesiredBuildsSection } from '@/components/settings/DesiredBuildsSection';
import { ClassSwitcher } from '@/components/ClassSwitcher';
import { Layout } from '@/components/Layout';
import { DUPE_MIN_TIER_VALUES, DUPE_PRESETS, formatDupeMinTierLabel } from '@/lib/constants';
import { isBungieConfigured } from '@/lib/bungie/auth';
import { getDimApiKey } from '@/lib/dim/tags';
import { clearSession } from '@/lib/bungie/loadVault';
import { clearOnboardingProgress } from '@/lib/onboarding/storage';
import { useAuthStore, useSessionStore, useVaultStore, resetVaultStore } from '@/stores';
import { usePrefsStore } from '@/stores';
import { getClassPrefs, resetAllClassPrefs, resetClassPrefs } from '@/lib/prefs/profile';
import {
  getCalibrationChoiceCount,
  getCalibrationConfidence,
} from '@/lib/prefs/calibrationChoices';
import { ARCHETYPE_LABELS, STAT_LABELS, STATS } from '@/lib/constants';
import type { ClassType } from '@/types';
import { parseImportedPrefs } from '@/lib/prefs/storage';
import { useRef, useState } from 'react';

const DUPE_GROUPING_TOGGLES = [
  {
    key: 'sameArmorSet' as const,
    label: 'Require same armor set',
    help: 'Only group or compare pieces from the same set. Off: same slot + archetype + tertiary across all sets.',
  },
  {
    key: 'sameTuningStat' as const,
    label: 'Require same tuning stat',
    help: 'Split by tuning stat (e.g. Weapons vs Grenade). Off: mixed tuning stats in one bucket.',
  },
] as const;

const DUPE_TAG_TOGGLES = [
  { key: 'ignoreTaggedKeep' as const, label: 'Ignore DIM keep / favorite' },
  { key: 'ignoreTaggedJunk' as const, label: 'Ignore DIM junk' },
] as const;

export function SettingsPage() {
  useScrollToLocationHash();
  const navigate = useNavigate();
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
  const [prefsClass, setPrefsClass] = useState<ClassType>('hunter');
  const [dupeOverrideClass, setDupeOverrideClass] = useState<ClassType>('hunter');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const classPrefs = getClassPrefs(profile, prefsClass);
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

      <section className="mb-10 max-w-xl">
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">API status</h2>
        <ul className="text-sm space-y-1 text-muted">
          <li>Bungie: {isBungieConfigured() ? 'configured' : 'missing .env keys'}</li>
          <li>DIM Sync: {getDimApiKey() ? 'configured' : 'missing key'}</li>
        </ul>
        {!getDimApiKey() && (
          <p className="text-xs text-muted mt-2">
            Get a DIM key: POST to api.destinyitemmanager.com/new_app with origin
            https://localhost:5173
          </p>
        )}
      </section>

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
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">Preferences</h2>
        <p className="text-xs text-muted mb-3">
          Each class has its own stat and archetype weights from calibration. Dupe rules below stay
          shared unless overridden per class.
        </p>
        <ClassSwitcher
          mode="button"
          active={prefsClass}
          onSelect={setPrefsClass}
          className="mb-4"
        />
        <p className="text-sm text-muted mb-3 capitalize">
          {prefsClass}: {getCalibrationChoiceCount(classPrefs)} calibrations · confidence{' '}
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
          to={`/onboarding/calibrate?class=${prefsClass}`}
          className="inline-block mt-3 text-sm text-accent-dim hover:underline"
        >
          Recalibrate {prefsClass}
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
                  `Reset ${prefsClass} preferences to defaults? Stat weights, calibration choices, and learned weights for this class will be cleared.`,
                )
              ) {
                updateProfile((p) => resetClassPrefs(p, prefsClass));
              }
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 text-danger/80"
          >
            Reset {prefsClass} preferences
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
        <h2 className="text-sm font-semibold uppercase text-muted mb-3">Per-class dupe rules</h2>
        <p className="text-xs text-muted mb-3">
          Classes share global rules by default. Apply a preset to one class without changing others.
        </p>
        <ClassSwitcher
          mode="button"
          active={dupeOverrideClass}
          onSelect={setDupeOverrideClass}
          className="mb-3"
        />
        {classRuleOverrides[dupeOverrideClass] && (
          <p className="text-xs text-accent-dim mb-2">
            {dupeOverrideClass} uses custom rules ·{' '}
            <button
              type="button"
              onClick={() => resetClassDupeRules(dupeOverrideClass)}
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
              onClick={() => applyPreset(id, dupeOverrideClass)}
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

      <section className="mb-10 max-w-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted mb-2">Dupe rules</h2>
          <p className="text-sm text-muted max-w-lg">
            One set of rules for finding similar armor everywhere: dashboard heatmap buckets,
            compare/duel, browse filters, and the redundant rolls dismantle list.
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
            DIM tags: exclude from dupe counts
          </h3>
          <p className="text-xs text-muted -mt-2">
            Tagged pieces stay visible but do not inflate dupe bucket sizes or review counts.
          </p>
          {DUPE_TAG_TOGGLES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={globalDupeRules[key]}
                onChange={(e) => setGlobalDupeRules({ [key]: e.target.checked })}
                className="accent-accent"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted mb-2">Live impact (global rules, Hunter vault)</p>
          <DupeRulesImpact rules={globalDupeRules} classType="hunter" />
        </div>
      </section>

      <DesiredBuildsSection />

      <Link to="/dashboard/hunter" className="block mt-8 text-sm text-muted hover:text-white">
        Dashboard
      </Link>
    </Layout>
  );
}
