import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Heatmap, type HeatmapViewMode } from '@/components/heatmap/Heatmap';
import { BucketPanel } from '@/components/heatmap/BucketPanel';
import { DupeRulesImpact } from '@/components/DupeRulesImpact';
import { BuildPageLinkCard } from '@/components/dashboard/BuildPageLinkCard';
import { VaultInsights } from '@/components/dashboard/VaultInsights';
import {
  CLASS_LABELS,
  CLASSES,
  ARCHETYPE_LABELS,
  ARCHETYPES,
  ARMOR_SLOTS,
  SLOT_LABELS,
  formatDupeMinTierLabel,
} from '@/lib/constants';
import { formatParseSkipReason, type ParseSkipReasons } from '@/lib/armor/parse';
import { countDismantleCandidates } from '@/lib/dupes/dismantle';
import { countDashboardItems } from '@/lib/dashboard/items';
import { getClassPrefs } from '@/lib/prefs/profile';
import { browseRedundantPath } from '@/lib/nav';
import { redundantPeerScopeFromDupeRules } from '@/lib/scoring/peerScope';
import {
  getOnboardingResumePath,
  needsOnboardingRedirect,
} from '@/lib/onboarding/storage';
import { useVaultFocusRefresh } from '@/lib/vault/useVaultFocusRefresh';
import { useAuthStore, usePrefsStore, useSessionStore, useVaultStore, vaultSummary } from '@/stores';
import type { Archetype, ArmorSlot, ClassType, DupeBucket } from '@/types';

export function DashboardPage() {
  const { class: classParam } = useParams<{ class: string }>();
  const navigate = useNavigate();
  const { membership } = useAuthStore();
  const {
    allItems,
    classStates,
    loadLiveVault,
    vaultLoading,
    vaultRefreshing,
    vaultStatus,
    lastParsedCount,
    vaultParseDiagnostics,
    vaultFetchDiagnostics,
    globalDupeRules,
    classRuleOverrides,
  } = useVaultStore();
  const pendingTags = useSessionStore((s) => s.pendingTags);
  const bucketJunkedIds = useSessionStore((s) => s.bucketJunkedIds);
  const bucketKeptBothIds = useSessionStore((s) => s.bucketKeptBothIds);
  const { initSingleBucket } = useSessionStore();
  const { profile } = usePrefsStore();
  const [selectedBucket, setSelectedBucket] = useState<DupeBucket | null>(null);
  const [slotFilter, setSlotFilter] = useState<ArmorSlot | 'all'>('all');
  const [heatmapView, setHeatmapView] = useState<HeatmapViewMode>('armor');
  const [focusArchetype, setFocusArchetype] = useState<Archetype>('gunner');
  useVaultFocusRefresh();

  const classType = (classParam ?? 'hunter') as ClassType;
  const validClass = CLASSES.includes(classType);
  const state = validClass ? classStates[classType] : undefined;

  if (!validClass) return <Navigate to="/dashboard/hunter" replace />;
  if (!membership) return <Navigate to="/" replace />;
  if (needsOnboardingRedirect()) {
    return <Navigate to={getOnboardingResumePath(false)} replace />;
  }

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
        <p className="text-muted mb-4">No vault data yet.</p>
        <button
          type="button"
          onClick={() => loadLiveVault()}
          className="px-4 py-2 rounded-lg bg-accent text-surface font-medium"
        >
          Load vault
        </button>
      </Layout>
    );
  }

  const summary = vaultSummary(classType);
  const classTieredCount = state.items.length;
  const classDupeScopeCount = state.items.filter(
    (i) => (i.tier ?? 0) >= globalDupeRules.minTier,
  ).length;
  const accountParsedCount = allItems.length;
  const classRules = classRuleOverrides[classType] ?? state.activeDupeRules;
  const redundantRollCount = countDismantleCandidates(
    allItems,
    classType,
    redundantPeerScopeFromDupeRules(classRules),
    getClassPrefs(profile, classType),
    { bucketJunkedIds, bucketKeptBothIds, pendingTags },
  );
  const hasCustomRules = Boolean(classRuleOverrides[classType]);

  return (
    <Layout>
      <div
        className="mb-4 min-h-[2.75rem]"
        aria-live="polite"
        aria-busy={vaultRefreshing || undefined}
      >
        {vaultRefreshing && (
          <div className="text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
            Refreshing… {vaultStatus}
          </div>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{CLASS_LABELS[classType]} vault</h1>
        <p className="text-muted text-sm mt-1">
          {classTieredCount} tiered {CLASS_LABELS[classType]} armor · {classDupeScopeCount}{' '}
          {formatDupeMinTierLabel(globalDupeRules.minTier)} in dupe scope · {summary.dupes} dupe
          buckets · ~{summary.review}{' '}
          decisions
          {hasCustomRules && (
            <span className="ml-2 text-muted">· custom dupe rules</span>
          )}
          {lastParsedCount !== null && (
            <span
              className="ml-2 text-muted"
              title="Armor you tiered in-game (Tier 1-5). Legacy gear and never-tiered pieces are excluded from import. Dupe scope uses your minimum tier setting."
            >
              · {accountParsedCount} tiered armor (account)
            </span>
          )}
        </p>
        {vaultFetchDiagnostics && vaultParseDiagnostics && (
          <p className="text-[11px] text-muted/80 mt-1 font-mono leading-relaxed">
            API {vaultFetchDiagnostics.totalUnique} instanced (
            {vaultFetchDiagnostics.vaultItems} vault +{' '}
            {vaultFetchDiagnostics.characterInventoryItems} char inv +{' '}
            {vaultFetchDiagnostics.equipmentItems} equipped
            {vaultFetchDiagnostics.enrichedItemCount > 0
              ? ` · ${vaultFetchDiagnostics.enrichedItemCount} detail fetches`
              : ''}
            {vaultFetchDiagnostics.enrichmentFailedCount > 0
              ? ` · ${vaultFetchDiagnostics.enrichmentFailedCount} detail fetch failed`
              : ''}
            ) → parsed {vaultParseDiagnostics.parsed}
            {vaultParseDiagnostics.legendaryArmor !== vaultParseDiagnostics.parsed && (
              <> / {vaultParseDiagnostics.legendaryArmor} legendary armor</>
            )}
            {Object.values(vaultParseDiagnostics.skipped).some((n) => n > 0) && (
              <>
                {' '}
                · skipped{' '}
                {Object.entries(vaultParseDiagnostics.skipped)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) =>
                    `${formatParseSkipReason(k as keyof ParseSkipReasons)}:${n}`,
                  )
                  .join(' ')}
              </>
            )}
          </p>
        )}
      </div>

      {hasCustomRules && (
        <div className="mb-4 p-3 border border-border rounded-lg bg-surface-2 text-sm">
          <p className="text-xs text-muted mb-1 capitalize">{classType} uses custom dupe rules</p>
          <DupeRulesImpact rules={classRules} classType={classType} />
        </div>
      )}
      <VaultInsights
        classState={state}
        classType={classType}
        prefs={getClassPrefs(profile, classType)}
        redundantRollCount={redundantRollCount}
        autoFilterRules={profile.autoFilterRules}
      />
      <BuildPageLinkCard classType={classType} prefs={getClassPrefs(profile, classType)} />

      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8 text-sm text-muted">
        <Link to={`/browse/${classType}`} className="hover:text-white">
          Browse all armor
        </Link>
        {redundantRollCount > 0 && (
          <Link
            to={browseRedundantPath(classType)}
            className="touch-manipulation hover:text-danger text-danger/80"
            onClick={() => setSelectedBucket(null)}
          >
            Redundant rolls ({redundantRollCount})
          </Link>
        )}
        <button
          type="button"
          disabled={vaultLoading || vaultRefreshing}
          onClick={() => loadLiveVault({ force: true, background: Boolean(state) })}
          className="hover:text-white disabled:opacity-50"
        >
          {vaultLoading || vaultRefreshing ? 'Refreshing…' : 'Refresh vault'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setHeatmapView('armor')}
            className={`px-3 py-1.5 ${heatmapView === 'armor' ? 'bg-white/10' : 'text-muted hover:text-white'}`}
          >
            Armor view
          </button>
          <button
            type="button"
            onClick={() => setHeatmapView('archetype')}
            className={`px-3 py-1.5 ${heatmapView === 'archetype' ? 'bg-white/10' : 'text-muted hover:text-white'}`}
          >
            Archetype view
          </button>
        </div>
        {heatmapView === 'archetype' && (
          <div className="flex flex-wrap gap-1">
            {ARCHETYPES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setFocusArchetype(a)}
                className={`px-2 py-1 rounded-md text-xs ${
                  focusArchetype === a ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
                }`}
              >
                {ARCHETYPE_LABELS[a]}
              </button>
            ))}
          </div>
        )}
        <label className="text-sm text-muted flex items-center gap-2">
          Heatmap slot
          <select
            value={slotFilter}
            onChange={(e) =>
              setSlotFilter(e.target.value === 'all' ? 'all' : (e.target.value as ArmorSlot))
            }
            className="bg-surface-2 border border-border rounded-md px-2 py-1 text-sm text-white"
          >
            <option value="all">All slots</option>
            {ARMOR_SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Heatmap
        classState={state}
        slotFilter={slotFilter}
        viewMode={heatmapView}
        focusArchetype={focusArchetype}
        onCellClick={(bucket) => {
          if (countDashboardItems(bucket.items, pendingTags, bucketJunkedIds) > 0) {
            setSelectedBucket(bucket);
          }
        }}
      />

      {selectedBucket && (
        <BucketPanel
          bucket={selectedBucket}
          onClose={() => setSelectedBucket(null)}
          onClean={
            selectedBucket.hasDupes
              ? () => {
                  initSingleBucket(classType, selectedBucket.key);
                  setSelectedBucket(null);
                  navigate(`/duel/${classType}`, {
                    state: { bucketKey: selectedBucket.key },
                  });
                }
              : undefined
          }
        />
      )}
    </Layout>
  );
}
