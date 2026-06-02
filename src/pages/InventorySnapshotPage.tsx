import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { OnboardingStepActions } from '@/components/onboarding/OnboardingBackButton';
import { SlotIcon } from '@/components/SlotIcon';
import {
  ARMOR_SLOTS,
  CLASS_LABELS,
  CLASSES,
  SLOT_LABELS,
} from '@/lib/constants';
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
import type { ClassType, VaultKeepPreference } from '@/types';

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
  const maxClassCount = Math.max(...CLASSES.map((c) => snapshot.byClass[c]), 1);

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
      <h1 className="text-2xl font-bold mb-2">Your armor vault</h1>
      <p className="text-muted mb-8 max-w-2xl">
        Tier 5 armor counts (default dupe scope) across all characters. Use this to spot gaps before
        trimming dupes.
      </p>

      {vaultRefreshing && (
        <div className="mb-4 text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
          Refreshing… {vaultStatus}
        </div>
      )}

      {snapshot.totalT5 === 0 && !vaultLoading && !vaultRefreshing && (
        <p className="mb-6 text-muted border border-border rounded-lg px-4 py-3 text-sm bg-surface-2">
          No Tier 5 armor found
          {lastParsedCount !== null ? ` (imported ${lastParsedCount} tiered pieces total)` : ''}.
          We import any tiered armor (Tier 1-5); legacy and never-tiered pieces are skipped.
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8 max-w-3xl">
        <StatCard label="Total Tier 5" value={snapshot.totalT5} />
        {CLASSES.map((c) => (
          <StatCard key={c} label={CLASS_LABELS[c]} value={snapshot.byClass[c]} />
        ))}
      </div>

      <section className="mb-8 max-w-3xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">
          Coverage by class
        </h2>
        <div className="space-y-6">
          {CLASSES.map((classType) => (
            <ClassCoverageBlock
              key={classType}
              classType={classType}
              total={snapshot.byClass[classType]}
              maxClassCount={maxClassCount}
              bySlot={snapshot.byClassSlot[classType]}
            />
          ))}
        </div>
      </section>

      {snapshot.gaps.length > 0 && (
        <section className="mb-8 max-w-3xl p-4 border border-border rounded-xl bg-surface-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
            Gaps to watch
          </h2>
          <ul className="text-sm space-y-2 text-muted">
            {snapshot.gaps.slice(0, 8).map((gap, i) => (
              <li key={i}>
                <span className="text-white">{CLASS_LABELS[gap.classType]}</span>
                {gap.armorSlot && ` · ${SLOT_LABELS[gap.armorSlot]}`}: {gap.message}
              </li>
            ))}
            {snapshot.gaps.length > 8 && (
              <li className="text-xs">+{snapshot.gaps.length - 8} more thin slots</li>
            )}
          </ul>
        </section>
      )}

      <section className="mb-8 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">
          How much do you want to keep?
        </h2>
        <p className="text-sm text-muted mb-4">
          Sets a rough target per class. D2 Armor Cleaner uses this to estimate how much trimming makes sense.
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
            At this target: ~{trim.totalTarget} pieces total
            {trim.excess > 0 ? (
              <>
                {' '}
               , roughly{' '}
                <span className="text-white">{trim.excess}</span> above target
              </>
            ) : (
              <>; you're at or below target</>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface-2">
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function ClassCoverageBlock({
  classType,
  total,
  maxClassCount,
  bySlot,
}: {
  classType: ClassType;
  total: number;
  maxClassCount: number;
  bySlot: Record<(typeof ARMOR_SLOTS)[number], number>;
}) {
  const barWidth = maxClassCount > 0 ? Math.round((total / maxClassCount) * 100) : 0;
  const maxSlot = Math.max(...ARMOR_SLOTS.map((s) => bySlot[s]), 1);

  return (
    <div className="border border-border rounded-xl p-4 bg-surface-2">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-semibold text-white">{CLASS_LABELS[classType]}</span>
        <span className="text-sm text-muted tabular-nums">{total} pieces</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-white/40 transition-all"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="grid grid-cols-5 gap-2">
        {ARMOR_SLOTS.map((slot) => {
          const count = bySlot[slot];
          const slotBar = maxSlot > 0 ? Math.round((count / maxSlot) * 100) : 0;
          const thin = count < 3;
          return (
            <div key={slot} className="text-center">
              <div className="flex justify-center mb-1">
                <SlotIcon slot={slot} size="md" />
              </div>
              <div
                className={`text-sm font-semibold tabular-nums ${thin ? 'text-neutral-400' : 'text-white'}`}
              >
                {count}
              </div>
              <div className="h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${thin ? 'bg-white/20' : 'bg-white/50'}`}
                  style={{ width: `${slotBar}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
