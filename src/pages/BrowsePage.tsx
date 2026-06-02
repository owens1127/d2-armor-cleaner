import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ArmorCard } from '@/components/duel/ArmorCard';
import {
  ARCHETYPE_LABELS,
  ARCHETYPES,
  CLASS_LABELS,
  CLASSES,
  ARMOR_SLOTS,
  SLOT_LABELS,
} from '@/lib/constants';
import { allDismantleCandidates } from '@/lib/dupes/dismantle';
import { sortBrowseItems, type BrowseSortOrder } from '@/lib/armor/sort';
import { BROWSE_REDUNDANT_QUERY } from '@/lib/nav';
import { buildFitTotal, getDesiredBuilds, resolveDesiredBuild } from '@/lib/coverage/analyze';
import { resolveDesiredBuildFromParam } from '@/lib/coverage/builds';
import { getClassPrefs } from '@/lib/prefs/profile';
import { redundantPeerScopeFromDupeRules } from '@/lib/scoring/peerScope';
import { scoreItem } from '@/lib/scoring/score';
import { wantScoreLabel } from '@/lib/scoring/learn';
import { findDominatorsMap } from '@/lib/scoring/dominance';
import {
  findTuningRedundantMap,
  tuningCoverageToDominatorResult,
} from '@/lib/scoring/tuningEquivalence';
import { DominatorPopover } from '@/components/dominance/DominatorPopover';
import { tagJunkLinkClass, tagKeepLinkClass } from '@/lib/dim/tagConfig';
import { dimIdQuery } from '@/lib/session/persist';
import {
  getOnboardingResumePath,
  needsOnboardingRedirect,
} from '@/lib/onboarding/storage';
import { SS_BROWSE_SORT } from '@/lib/storage/keys';
import { useVaultFocusRefresh } from '@/lib/vault/useVaultFocusRefresh';
import { useAuthStore, usePrefsStore, useSessionStore, useVaultStore } from '@/stores';
import type { Archetype, ArmorPiece, ArmorSlot, ClassType, TagValue } from '@/types';

function readBrowseSort(): BrowseSortOrder {
  if (typeof sessionStorage === 'undefined') return 'match-desc';
  const stored = sessionStorage.getItem(SS_BROWSE_SORT);
  if (
    stored === 'match-desc' ||
    stored === 'match-asc' ||
    stored === 'preference' ||
    stored === 'build-fit-desc'
  ) {
    return stored;
  }
  return 'match-desc';
}

function browseSortLabel(order: BrowseSortOrder): string {
  if (order === 'match-desc') return 'sorted by match % (most compatible first)';
  if (order === 'match-asc') return 'sorted by match % (least compatible first)';
  if (order === 'build-fit-desc') return 'sorted by combo fit';
  return 'sorted by preference';
}

export function BrowsePage() {
  const { class: classParam } = useParams<{ class: string }>();
  useVaultFocusRefresh({ refreshOnMount: true });
  const [searchParams] = useSearchParams();
  const classType = (classParam ?? 'hunter') as ClassType;
  const { membership } = useAuthStore();
  const { allItems, classStates, globalDupeRules, classRuleOverrides } = useVaultStore();
  const { profile } = usePrefsStore();
  const classPrefs = getClassPrefs(profile, classType);
  const desiredBuilds = getDesiredBuilds(classPrefs, classType);
  const initialBuildFilter = searchParams.get('build') ?? 'all';
  const classDupeRules =
    classRuleOverrides[classType] ??
    classStates[classType]?.activeDupeRules ??
    globalDupeRules;
  const redundantPeerScope = redundantPeerScopeFromDupeRules(classDupeRules);
  const { applyTagDirect, pendingTags, bucketJunkedIds, bucketKeptBothIds } = useSessionStore();
  const redundantFromUrl = searchParams.get(BROWSE_REDUNDANT_QUERY) === '1';

  const [slot, setSlot] = useState<ArmorSlot | 'all'>('all');
  const [archetype, setArchetype] = useState<Archetype | 'all'>('all');
  const [setFilter, setSetFilter] = useState<number | 'all'>('all');
  const [dimTag, setDimTag] = useState<TagValue | 'all' | 'untagged'>('all');
  const [dupesOnly, setDupesOnly] = useState(false);
  const [strictlyLowerOnly, setStrictlyLowerOnly] = useState(false);
  const [redundantOnly, setRedundantOnly] = useState(redundantFromUrl);
  const [buildFilter, setBuildFilter] = useState<string>(initialBuildFilter);
  const [buildFitOnly, setBuildFitOnly] = useState(Boolean(searchParams.get('build')));
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<BrowseSortOrder>(readBrowseSort);
  const [copied, setCopied] = useState(false);

  function updateSortOrder(order: BrowseSortOrder) {
    setSortOrder(order);
    sessionStorage.setItem(SS_BROWSE_SORT, order);
  }

  const classItems = allItems.filter((i) => i.classType === classType);
  const armorSets = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of classItems) {
      if (item.armorSet) map.set(item.armorSet.hash, item.armorSet.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [classItems]);

  const runDirectTag = (item: ArmorPiece, tag: TagValue | null) => {
    void applyTagDirect([item], tag).catch((error: unknown) => {
      console.error(error);
    });
  };

  const dominatorsBySlot = useMemo(() => {
    const bySlot = new Map<ArmorSlot, ReturnType<typeof findDominatorsMap>>();
    for (const slot of ARMOR_SLOTS) {
      const slotItems = classItems.filter((i) => i.armorSlot === slot);
      bySlot.set(slot, findDominatorsMap(slotItems, redundantPeerScope, classPrefs));
    }
    return bySlot;
  }, [classItems, redundantPeerScope, classPrefs]);

  const dismantleExclusions = useMemo(
    () => ({ bucketJunkedIds, bucketKeptBothIds, pendingTags }),
    [bucketJunkedIds, bucketKeptBothIds, pendingTags],
  );

  const redundantRollIds = useMemo(() => {
    const candidates = allDismantleCandidates(
      allItems,
      classType,
      redundantPeerScope,
      classPrefs,
      dismantleExclusions,
    );
    return new Set(candidates.map((c) => c.item.instanceId));
  }, [allItems, classType, redundantPeerScope, classPrefs, dismantleExclusions]);

  const tuningRedundantBySlot = useMemo(() => {
    const bySlot = new Map<ArmorSlot, ReturnType<typeof findTuningRedundantMap>>();
    for (const slot of ARMOR_SLOTS) {
      const slotItems = classItems.filter((i) => i.armorSlot === slot);
      const statLowerIds = new Set(
        (dominatorsBySlot.get(slot) ?? new Map()).keys(),
      );
      bySlot.set(
        slot,
        findTuningRedundantMap(slotItems, statLowerIds, redundantPeerScope, classPrefs),
      );
    }
    return bySlot;
  }, [classItems, dominatorsBySlot, redundantPeerScope, classPrefs]);

  const activeBuildProfile = useMemo(() => {
    if (buildFilter === 'all') return null;
    const desired = resolveDesiredBuildFromParam(buildFilter, classType, desiredBuilds);
    return desired ? resolveDesiredBuild(desired, classPrefs) : null;
  }, [buildFilter, desiredBuilds, classPrefs, classType]);

  const buildFitTotals = useMemo(() => {
    if (!activeBuildProfile) return undefined;
    const targets = activeBuildProfile.statTargets;
    const totals = new Map<string, number>();
    for (const item of classItems) {
      totals.set(item.instanceId, buildFitTotal(item, targets));
    }
    return totals;
  }, [classItems, activeBuildProfile]);

  const matchTotals = useMemo(() => {
    if (sortOrder === 'preference' || sortOrder === 'build-fit-desc') return undefined;
    const totals = new Map<string, number>();
    for (const item of classItems) {
      totals.set(item.instanceId, scoreItem(item, classPrefs, classItems).total);
    }
    return totals;
  }, [classItems, classPrefs, sortOrder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = classItems
      .filter((i) => (i.tier ?? 0) >= globalDupeRules.minTier)
      .filter((i) => slot === 'all' || i.armorSlot === slot)
      .filter((i) => archetype === 'all' || i.archetype === archetype)
      .filter((i) => setFilter === 'all' || i.armorSet?.hash === setFilter)
      .filter((i) => {
        if (dimTag === 'all') return true;
        if (dimTag === 'untagged') return !i.dimTag && !i.dimFavorite;
        if (dimTag === 'favorite') return Boolean(i.dimFavorite || i.dimTag === 'favorite');
        return i.dimTag === dimTag;
      })
      .filter((i) => !dupesOnly || i.isDupe)
      .filter((i) => {
        if (!strictlyLowerOnly) return true;
        return dominatorsBySlot.get(i.armorSlot)?.has(i.instanceId) ?? false;
      })
      .filter((i) => !redundantOnly || redundantRollIds.has(i.instanceId))
      .filter((i) => {
        if (!buildFitOnly || !activeBuildProfile) return true;
        return buildFitTotal(i, activeBuildProfile.statTargets) > 0;
      })
      .filter((i) => !q || i.name.toLowerCase().includes(q));
    const effectiveSort =
      sortOrder === 'build-fit-desc' && !activeBuildProfile ? 'match-desc' : sortOrder;
    return sortBrowseItems(items, effectiveSort, matchTotals, buildFitTotals);
  }, [
    classItems,
    slot,
    archetype,
    setFilter,
    dimTag,
    dupesOnly,
    strictlyLowerOnly,
    redundantOnly,
    redundantRollIds,
    dominatorsBySlot,
    query,
    globalDupeRules.minTier,
    sortOrder,
    matchTotals,
    buildFitTotals,
    buildFitOnly,
    activeBuildProfile,
  ]);

  if (!CLASSES.includes(classType)) return <Navigate to="/browse/hunter" replace />;
  if (!membership) return <Navigate to="/" replace />;
  if (needsOnboardingRedirect()) {
    return <Navigate to={getOnboardingResumePath(false)} replace />;
  }

  const state = classStates[classType];

  async function copyFilteredIds() {
    await navigator.clipboard.writeText(
      dimIdQuery(
        filtered.map((i) => ({
          instanceId: i.instanceId,
          tag: null,
          itemName: i.name,
          classType: i.classType,
        })),
      ),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {redundantOnly
            ? `Redundant rolls: ${CLASS_LABELS[classType]}`
            : `Browse ${CLASS_LABELS[classType]} armor`}
        </h1>
        <p className="text-muted text-sm mt-1 max-w-2xl">
          {redundantOnly ? (
            <>
              Stat-lower or same-after-tuning vs another roll in the slot · {filtered.length} of{' '}
              {redundantRollIds.size} candidates · review before dismantling in-game
            </>
          ) : (
            <>
              {filtered.length} of{' '}
              {classItems.filter((i) => (i.tier ?? 0) >= globalDupeRules.minTier).length} pieces ·{' '}
              {browseSortLabel(sortOrder)}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 p-4 border border-border rounded-xl bg-surface-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Sort
          <select
            value={sortOrder}
            onChange={(e) => updateSortOrder(e.target.value as BrowseSortOrder)}
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          >
            <option value="match-desc">Match % (high → low)</option>
            <option value="match-asc">Match % (low → high)</option>
            <option value="preference">Preference</option>
            {activeBuildProfile && (
              <option value="build-fit-desc">Combo fit (high → low)</option>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted min-w-[140px]">
          Combo
          <select
            value={buildFilter}
            onChange={(e) => {
              const next = e.target.value;
              setBuildFilter(next);
              if (next !== 'all' && sortOrder === 'match-desc') {
                updateSortOrder('build-fit-desc');
              }
            }}
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          >
            <option value="all">Any combo</option>
            {desiredBuilds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Slot
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as ArmorSlot | 'all')}
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          >
            <option value="all">All slots</option>
            {ARMOR_SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Archetype
          <select
            value={archetype}
            onChange={(e) => setArchetype(e.target.value as Archetype | 'all')}
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          >
            <option value="all">All archetypes</option>
            {ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {ARCHETYPE_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted flex-1 min-w-[160px]">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Armor name…"
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted min-w-[140px]">
          Armor set
          <select
            value={setFilter === 'all' ? 'all' : String(setFilter)}
            onChange={(e) =>
              setSetFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          >
            <option value="all">All sets</option>
            {armorSets.map(([hash, name]) => (
              <option key={hash} value={hash}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          DIM tag
          <select
            value={dimTag}
            onChange={(e) => setDimTag(e.target.value as typeof dimTag)}
            className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm text-white"
          >
            <option value="all">Any</option>
            <option value="untagged">Untagged</option>
            <option value="keep">Keep</option>
            <option value="junk">Junk</option>
            <option value="favorite">Favorite</option>
            <option value="infuse">Infuse</option>
            <option value="archive">Archive</option>
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm pb-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={dupesOnly}
            onChange={(e) => setDupesOnly(e.target.checked)}
            className="rounded"
          />
          Dupes only
        </label>
        <label className="flex items-end gap-2 text-sm pb-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={strictlyLowerOnly}
            onChange={(e) => setStrictlyLowerOnly(e.target.checked)}
            className="rounded"
          />
          Strictly lower only
        </label>
        <label className="flex items-end gap-2 text-sm pb-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={redundantOnly}
            onChange={(e) => setRedundantOnly(e.target.checked)}
            className="rounded"
          />
          Redundant rolls only
        </label>
        {activeBuildProfile && (
          <label className="flex items-end gap-2 text-sm pb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={buildFitOnly}
              onChange={(e) => setBuildFitOnly(e.target.checked)}
              className="rounded"
            />
            Supports combo only
          </label>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={copyFilteredIds}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
          >
            {copied ? 'Copied!' : `Copy ${filtered.length} id: query`}
          </button>
          {pendingTags.length > 0 && (
            <Link to="/review" className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-white/5">
              Review compare/triage tags ({pendingTags.length})
            </Link>
          )}
        </div>
      )}

      {!state && (
        <p className="text-muted">Load your vault from the dashboard first.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 armor-card-grid">
        {filtered.map((item) => {
          const breakdown = scoreItem(item, classPrefs, classItems);
          const label = wantScoreLabel(item, classItems);
          const dominatorResult = dominatorsBySlot.get(item.armorSlot)?.get(item.instanceId);
          const tuningCoverage = tuningRedundantBySlot
            .get(item.armorSlot)
            ?.get(item.instanceId);
          const popoverResult = dominatorResult
            ? {
                result: dominatorResult,
                reason: 'stat-lower' as const,
                tuningMutual: false,
              }
            : tuningCoverage
              ? {
                  result: tuningCoverageToDominatorResult(item, tuningCoverage),
                  reason: 'tuning-equivalent' as const,
                  tuningMutual: tuningCoverage.mutual,
                }
              : null;
          return (
            <div key={item.instanceId} className="armor-card-grid-cell relative h-full">
              {popoverResult ? (
                <DominatorPopover
                  candidate={item}
                  result={popoverResult.result}
                  classPrefs={classPrefs}
                  classItems={classItems}
                  reason={popoverResult.reason}
                  tuningMutual={popoverResult.tuningMutual}
                >
                  <div className="armor-card-grid-cell__card relative flex flex-col flex-1 h-full min-h-0">
                    {item.isDupe && (
                      <span className="absolute top-2 right-2 z-10 text-[10px] bg-white/10 text-white/80 px-1.5 py-0.5 rounded-md">
                        dupe
                      </span>
                    )}
                    <ArmorCard
                      piece={item}
                      breakdown={breakdown}
                      wantLabel={label}
                      variant="browse"
                      static
                      className="flex-1 h-full"
                    />
                  </div>
                </DominatorPopover>
              ) : (
                <div className="armor-card-grid-cell__card relative flex flex-col flex-1 h-full min-h-0">
                  {item.isDupe && (
                    <span className="absolute top-2 right-2 z-10 text-[10px] bg-white/10 text-white/80 px-1.5 py-0.5 rounded-md">
                      dupe
                    </span>
                  )}
                  <ArmorCard
                    piece={item}
                    breakdown={breakdown}
                    wantLabel={label}
                    variant="browse"
                    className="flex-1 h-full"
                  />
                </div>
              )}
              <div className="flex gap-3 mt-2 px-1 shrink-0">
                <button
                  type="button"
                  onClick={() => runDirectTag(item, item.dimTag === 'keep' ? null : 'keep')}
                  className={tagKeepLinkClass(item.dimTag === 'keep')}
                >
                  {item.dimTag === 'keep' ? 'Tagged keep' : 'Mark keep'}
                </button>
                <button
                  type="button"
                  onClick={() => runDirectTag(item, item.dimTag === 'junk' ? null : 'junk')}
                  className={tagJunkLinkClass(item.dimTag === 'junk')}
                >
                  {item.dimTag === 'junk' ? 'Tagged junk' : 'Mark junk'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && state && (
        <p className="text-muted text-center py-12">No items match these filters.</p>
      )}

      <div className="mt-8">
        <Link to={`/dashboard/${classType}`} className="text-sm text-muted hover:text-white">
          Back to dashboard
        </Link>
      </div>
    </Layout>
  );
}
