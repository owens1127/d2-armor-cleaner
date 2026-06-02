import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ArmorCard } from '@/components/duel/ArmorCard';
import {
  allDismantleCandidates,
  countByReason,
  findDismantleBySlot,
  groupDismantleCandidatesForDisplay,
  type DismantleReason,
} from '@/lib/dupes/dismantle';
import { DominatorPopover } from '@/components/dominance/DominatorPopover';
import { tuningCoverageToDominatorResult } from '@/lib/scoring/tuningEquivalence';
import { CLASS_LABELS, CLASSES, SLOT_LABELS } from '@/lib/constants';
import {
  getOnboardingResumePath,
  needsOnboardingRedirect,
} from '@/lib/onboarding/storage';
import { getClassPrefs } from '@/lib/prefs/profile';
import { redundantPeerScopeFromDupeRules } from '@/lib/scoring/peerScope';
import { scoreItem } from '@/lib/scoring/score';
import { useAuthStore, usePrefsStore, useSessionStore, useVaultStore } from '@/stores';
import type { ClassType, ArmorSlot } from '@/types';

const REASON_LABEL: Record<DismantleReason, string> = {
  'stat-lower': 'Stat-lower',
  'tuning-duplicate': 'Same after tuning',
};

const REASON_HELP: Record<DismantleReason, string> = {
  'stat-lower': 'Another piece in the same set beats every tuning layout on all stats',
  'tuning-duplicate':
    'Another piece in the same set can match every tuning layout (same roll)',
};

type ReasonFilter = 'all' | DismantleReason;

export function DismantlePage() {
  const { class: classParam } = useParams<{ class: string }>();
  const classType = (classParam ?? 'hunter') as ClassType;
  const { membership } = useAuthStore();
  const { allItems, classStates, globalDupeRules, classRuleOverrides } = useVaultStore();
  const { profile } = usePrefsStore();
  const classPrefs = getClassPrefs(profile, classType);
  const classDupeRules =
    classRuleOverrides[classType] ??
    classStates[classType]?.activeDupeRules ??
    globalDupeRules;
  const redundantPeerScope = redundantPeerScopeFromDupeRules(classDupeRules);
  const { applyTagDirect, pendingTags, bucketJunkedIds, bucketKeptBothIds } = useSessionStore();
  const dismantleExclusions = useMemo(
    () => ({ bucketJunkedIds, bucketKeptBothIds, pendingTags }),
    [bucketJunkedIds, bucketKeptBothIds, pendingTags],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');

  const bySlot = useMemo(
    () =>
      findDismantleBySlot(
        allItems,
        classType,
        redundantPeerScope,
        classPrefs,
        dismantleExclusions,
      ),
    [allItems, classType, redundantPeerScope, classPrefs, dismantleExclusions],
  );
  const allCandidates = useMemo(
    () =>
      allDismantleCandidates(
        allItems,
        classType,
        redundantPeerScope,
        classPrefs,
        dismantleExclusions,
      ),
    [allItems, classType, redundantPeerScope, classPrefs, dismantleExclusions],
  );
  const reasonCounts = useMemo(() => countByReason(allCandidates), [allCandidates]);
  const filteredBySlot = useMemo(() => {
    if (reasonFilter === 'all') return bySlot;
    const next = new Map<ArmorSlot, typeof allCandidates>();
    for (const [slot, list] of bySlot.entries()) {
      const filtered = list.filter((c) => c.reason === reasonFilter);
      if (filtered.length > 0) next.set(slot, filtered);
    }
    return next;
  }, [bySlot, reasonFilter]);
  const displayBySlot = useMemo(() => {
    const next = new Map<
      ArmorSlot,
      ReturnType<typeof groupDismantleCandidatesForDisplay>
    >();
    for (const [slot, list] of filteredBySlot.entries()) {
      next.set(slot, groupDismantleCandidatesForDisplay(list, redundantPeerScope));
    }
    return next;
  }, [filteredBySlot, redundantPeerScope]);
  const visibleCandidates = useMemo(() => {
    if (reasonFilter === 'all') return allCandidates;
    return allCandidates.filter((c) => c.reason === reasonFilter);
  }, [allCandidates, reasonFilter]);
  const classItems = allItems.filter((i) => i.classType === classType);

  if (!CLASSES.includes(classType)) return <Navigate to="/dismantle/hunter" replace />;
  if (!membership) return <Navigate to="/" replace />;
  if (needsOnboardingRedirect()) {
    return <Navigate to={getOnboardingResumePath(false)} replace />;
  }

  function toggleGroup(instanceIds: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = instanceIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of instanceIds) next.delete(id);
      } else {
        for (const id of instanceIds) next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(visibleCandidates.map((c) => c.item.instanceId)));
  }

  function selectSlot(slot: ArmorSlot) {
    const items = filteredBySlot.get(slot);
    if (!items) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const entry of items) next.add(entry.item.instanceId);
      return next;
    });
  }

  function markSelectedJunk() {
    const items = visibleCandidates
      .filter((c) => selected.has(c.item.instanceId))
      .map((c) => c.item);
    void applyTagDirect(items, 'junk').catch((error: unknown) => {
      console.error(error);
    });
    setSelected(new Set());
  }

  const queuedCount = pendingTags.length;

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Redundant rolls: {CLASS_LABELS[classType]}</h1>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Pieces where another item in the same slot can match or beat every tuning layout ·{' '}
            {allCandidates.length} candidates. Review before dismantling: armor sets, fashion, and
            tags still matter.
          </p>
        </div>
        <Link to={`/dashboard/${classType}`} className="text-sm text-muted hover:text-white">
          Dashboard
        </Link>
      </div>

      <p className="text-xs text-muted mb-6 max-w-2xl">
        Comparison scope follows your{' '}
        <Link to="/settings" className="text-accent-dim hover:underline">
          dupe rules
        </Link>
        {classDupeRules.sameArmorSet || classDupeRules.sameTuningStat ? (
          <>
            :{' '}
            {[
              classDupeRules.sameArmorSet && 'same armor set',
              classDupeRules.sameTuningStat && 'same tuning stat',
            ]
              .filter(Boolean)
              .join(' · ')}
          </>
        ) : (
          <> (any set and tuning in the same slot roll family)</>
        )}
        .
      </p>

      {allCandidates.length === 0 && (
        <p className="text-muted py-12 text-center border border-border rounded-xl bg-surface-2">
          No redundant rolls found for this class.
        </p>
      )}

      {allCandidates.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                ['all', `All (${allCandidates.length})`],
                ['tuning-duplicate', `Same after tuning (${reasonCounts['tuning-duplicate']})`],
                ['stat-lower', `Stat-lower (${reasonCounts['stat-lower']})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setReasonFilter(id)}
                className={`text-sm px-3 py-1.5 rounded-lg border ${
                  reasonFilter === id
                    ? 'border-white/25 bg-white/10 text-white'
                    : 'border-border hover:bg-white/5 text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              onClick={selectAll}
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
            >
              Select all ({visibleCandidates.length})
            </button>
            {[...filteredBySlot.entries()].map(([slot, items]) => (
              <button
                key={slot}
                type="button"
                onClick={() => selectSlot(slot)}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-white/5"
              >
                {SLOT_LABELS[slot]} ({displayBySlot.get(slot)?.length ?? items.length})
              </button>
            ))}
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={markSelectedJunk}
              className="text-sm px-4 py-1.5 rounded-lg bg-danger/20 text-danger border border-danger/30 disabled:opacity-40"
            >
              Mark {selected.size || ''} as junk
            </button>
            {queuedCount > 0 && (
              <Link
                to="/review"
                className="text-sm px-4 py-1.5 rounded-lg bg-accent text-surface font-medium"
              >
                Review {queuedCount} tags
              </Link>
            )}
          </div>

          {visibleCandidates.length === 0 && (
            <p className="text-muted py-8 text-center border border-border rounded-xl bg-surface-2 mb-6">
              No pieces in this category.
            </p>
          )}

          <div className="space-y-8">
            {[...displayBySlot.entries()].map(([slot, entries]) => (
              <section key={slot}>
                <h2 className="text-sm font-semibold uppercase text-muted mb-3">
                  {SLOT_LABELS[slot]}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 armor-card-grid">
                  {entries.map(({ item, reason, dominatorResult, peer, tuningCoverage, copyCount, instanceIds }) => {
                    const isSelected = instanceIds.every((id) => selected.has(id));
                    const selectedCardClass = isSelected
                      ? 'shadow-[inset_3px_0_0_rgba(255,255,255,0.22)] bg-white/[0.04] rounded-xl'
                      : '';
                    const popoverResult =
                      reason === 'stat-lower' && dominatorResult
                        ? dominatorResult
                        : reason === 'tuning-duplicate' && tuningCoverage
                          ? tuningCoverageToDominatorResult(item, tuningCoverage)
                          : null;
                    const cardInner = (
                      <div
                        className={`armor-card-grid-cell__card relative flex flex-col flex-1 h-full min-h-0 ${selectedCardClass}`}
                      >
                        <ArmorCard
                          piece={item}
                          breakdown={scoreItem(item, classPrefs, classItems)}
                          variant="browse"
                          static={Boolean(popoverResult)}
                          copyCount={copyCount}
                          copyCountTitle={`${copyCount} identical redundant copies`}
                          className="flex-1 h-full"
                        />
                      </div>
                    );
                    return (
                      <div key={instanceIds.join('-')} className="armor-card-grid-cell relative h-full">
                        <label className="cursor-pointer flex flex-col h-full min-h-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleGroup(instanceIds)}
                            className="absolute top-3 left-3 z-10 accent-accent"
                          />
                          <div className="relative flex flex-col flex-1 min-h-0">
                            {popoverResult ? (
                              <DominatorPopover
                                candidate={item}
                                result={popoverResult}
                                classPrefs={classPrefs}
                                classItems={classItems}
                                reason={
                                  reason === 'tuning-duplicate' ? 'tuning-equivalent' : 'stat-lower'
                                }
                                tuningMutual={tuningCoverage?.mutual ?? false}
                              >
                                {cardInner}
                              </DominatorPopover>
                            ) : (
                              <div title={`${REASON_HELP[reason]}: see ${peer.name}`}>
                                {cardInner}
                              </div>
                            )}
                            <div className="mt-2 px-1 flex flex-wrap items-center gap-2 text-[10px] shrink-0">
                              <span
                                className={`uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                  reason === 'stat-lower'
                                    ? 'bg-danger/15 text-danger'
                                    : 'bg-white/10 text-white/80'
                                }`}
                                title={REASON_HELP[reason]}
                              >
                                {REASON_LABEL[reason]}
                              </span>
                              <span className="text-muted truncate" title={peer.name}>
                                vs {peer.name}
                              </span>
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
