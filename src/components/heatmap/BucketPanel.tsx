import { useMemo } from 'react';
import { statLabel, archetypeLabel, slotLabel } from '@/i18n/gameCopy';
import { useVaultInteractionHold } from '@/hooks/useVaultRefreshGuard';
import type { ArmorPiece, ClassPreferenceProfile, DupeBucket } from '@/types';
import { ArmorCard } from '@/components/duel/ArmorCard';
import { dimInstanceIdsQuery } from '@/lib/dim/query';
import { getClassPrefs } from '@/lib/prefs/profile';
import { redundantPeerScopeFromDupeRules } from '@/lib/scoring/peerScope';
import { scoreItem } from '@/lib/scoring/score';
import { sortBucketItems } from '@/lib/armor/sort';
import { autoJunkCandidates, findDominatorsMap, type DominatorResult } from '@/lib/scoring/dominance';
import {
  findTuningRedundantMap,
  intrinsicRollComparisonKey,
  tuningCoverageToDominatorResult,
} from '@/lib/scoring/tuningEquivalence';
import { DominatorPopover } from '@/components/dominance/DominatorPopover';
import {
  filterDashboardItems,
  shouldCloseDashboardBucketPanel,
} from '@/lib/dashboard/items';
import {
  tagJunkBtnActiveClass,
  tagJunkBtnClass,
  tagKeepBtnActiveClass,
  tagKeepBtnClass,
} from '@/lib/dim/tagConfig';
import { usePrefsStore, useSessionStore, useVaultStore } from '@/stores';

interface BucketPanelProps {
  bucket: DupeBucket;
  onClose: () => void;
  onClean?: () => void;
}

interface BucketDisplayRow {
  item: ArmorPiece;
  copyCount: number;
  dominatorResult?: DominatorResult;
  tuningMutual: boolean;
  reason?: 'stat-lower' | 'tuning-equivalent';
}

function bucketDisplayRows(
  items: ArmorPiece[],
  dominatorsMap: Map<string, DominatorResult>,
  tuningMap: Map<string, { peer: ArmorPiece; mutual: boolean }>,
  redundantPeerScope: ReturnType<typeof redundantPeerScopeFromDupeRules>,
  classPrefs: ClassPreferenceProfile,
): BucketDisplayRow[] {
  const groups = new Map<string, ArmorPiece[]>();
  for (const item of items) {
    const key = intrinsicRollComparisonKey(item, redundantPeerScope);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return [...groups.values()].map((copies) => {
    const sorted = sortBucketItems(copies, classPrefs);
    const redundant = [...sorted]
      .reverse()
      .find(
        (copy) =>
          dominatorsMap.has(copy.instanceId) || tuningMap.has(copy.instanceId),
      );
    const item = redundant ?? sorted[0]!;
    const dominatorResult = dominatorsMap.get(item.instanceId);
    const tuningCoverage = tuningMap.get(item.instanceId);
    if (dominatorResult) {
      return {
        item,
        copyCount: copies.length,
        dominatorResult,
        tuningMutual: false,
        reason: 'stat-lower' as const,
      };
    }
    if (tuningCoverage) {
      return {
        item,
        copyCount: copies.length,
        dominatorResult: tuningCoverageToDominatorResult(item, tuningCoverage),
        tuningMutual: tuningCoverage.mutual,
        reason: 'tuning-equivalent' as const,
      };
    }
    return { item, copyCount: copies.length, tuningMutual: false };
  });
}

export function BucketPanel({ bucket, onClose, onClean }: BucketPanelProps) {
  useVaultInteractionHold(true);
  const { profile } = usePrefsStore();
  const { allItems, classStates, globalDupeRules, classRuleOverrides } = useVaultStore();
  const classType = bucket.key.classType;
  const classPrefs = getClassPrefs(profile, classType);
  const classDupeRules =
    classRuleOverrides[classType] ??
    classStates[classType]?.activeDupeRules ??
    globalDupeRules;
  const redundantPeerScope = redundantPeerScopeFromDupeRules(classDupeRules);
  const { applyTagDirect, pendingTags, bucketJunkedIds } = useSessionStore();
  const active = filterDashboardItems(bucket.items, pendingTags, bucketJunkedIds);
  const visible = useMemo(
    () => bucket.items.filter((i) => !i.isIgnored),
    [bucket.items],
  );

  const markJunkDirect = (items: ArmorPiece[]) => {
    void applyTagDirect(items, 'junk')
      .then(() => {
        if (
          shouldCloseDashboardBucketPanel(
            bucket.items,
            bucketJunkedIds,
            items.map((item) => item.instanceId),
          )
        ) {
          onClose();
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  };

  const toggleKeepDirect = (item: ArmorPiece) => {
    void applyTagDirect([item], item.dimTag === 'keep' ? null : 'keep').catch((error: unknown) => {
      console.error(error);
    });
  };

  const toggleJunkDirect = (item: ArmorPiece) => {
    if (item.dimTag === 'junk') {
      void applyTagDirect([item], null).catch((error: unknown) => {
        console.error(error);
      });
      return;
    }
    markJunkDirect([item]);
  };

  const dominated = useMemo(
    () => autoJunkCandidates(active, redundantPeerScope, classPrefs),
    [active, redundantPeerScope, classPrefs],
  );
  const dominatorsMap = useMemo(
    () => findDominatorsMap(active, redundantPeerScope, classPrefs),
    [active, redundantPeerScope, classPrefs],
  );
  const tuningMap = useMemo(() => {
    const statLowerIds = new Set(dominatorsMap.keys());
    return findTuningRedundantMap(active, statLowerIds, redundantPeerScope, classPrefs);
  }, [active, dominatorsMap, redundantPeerScope, classPrefs]);
  const displayRows = useMemo(
    () => bucketDisplayRows(visible, dominatorsMap, tuningMap, redundantPeerScope, classPrefs),
    [visible, dominatorsMap, tuningMap, redundantPeerScope, classPrefs],
  );
  const dominatedIds = useMemo(
    () => new Set(dominated.map((i) => i.instanceId)),
    [dominated],
  );
  const junkable = dominated;

  const dimDupeQuery = `is:t5 is:${bucket.key.classType} is:${bucket.key.armorSlot} dupe:${bucket.key.archetype}+${bucket.key.tertiaryStat}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bucket-panel-title"
    >
      <div className="absolute inset-0 bg-black/60 pointer-events-none" aria-hidden />
      <div className="relative bg-surface-2 border border-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl">
        <div className="p-4 border-b border-border flex justify-between items-start gap-2">
          <div>
            <h2 id="bucket-panel-title" className="font-semibold">
              {slotLabel(bucket.key.armorSlot)} · {archetypeLabel(bucket.key.archetype)}
            </h2>
            <p className="text-sm text-muted">
              + {statLabel(bucket.key.tertiaryStat)} · {active.length} items
              {bucket.hasDupes && (
                <span className="text-white/70 ml-2">dupe bucket</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {junkable.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-surface-3">
            <p className="text-sm text-muted mb-2">
              {junkable.length} piece{junkable.length === 1 ? '' : 's'} strictly worse on all stats
            </p>
            <button
              type="button"
              onClick={() => markJunkDirect(junkable)}
              className="w-full py-2 rounded-md border border-border text-sm text-white hover:bg-white/5"
            >
              Mark {junkable.length} as junk
            </button>
          </div>
        )}

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {displayRows.map(({ item, copyCount, dominatorResult, tuningMutual, reason }) => (
            <ItemRow
              key={item.instanceId}
              item={item}
              copyCount={copyCount}
              allItems={allItems}
              classPrefs={classPrefs}
              isDominated={dominatedIds.has(item.instanceId) || tuningMap.has(item.instanceId)}
              dominatorResult={dominatorResult}
              popoverReason={reason}
              tuningMutual={tuningMutual}
              isTaggedKeep={item.dimTag === 'keep'}
              isTaggedJunk={item.dimTag === 'junk'}
              onMarkKeep={() => toggleKeepDirect(item)}
              onMarkJunk={() => toggleJunkDirect(item)}
            />
          ))}
        </div>
        <div className="p-4 border-t border-border flex gap-2">
          {bucket.hasDupes && onClean && (
            <button
              type="button"
              onClick={onClean}
              className="ui-btn-primary flex-1 py-2 text-sm font-medium transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Compare this group
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(dimInstanceIdsQuery(bucket.items.map((i) => i.instanceId)));
            }}
            className="py-2 px-3 rounded-lg border border-border text-sm hover:bg-white/5"
          >
            Copy IDs
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(dimDupeQuery)}
            className="py-2 px-3 rounded-lg border border-border text-sm hover:bg-white/5"
            title={dimDupeQuery}
          >
            Copy DIM search
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  copyCount,
  allItems,
  classPrefs,
  isDominated,
  dominatorResult,
  popoverReason,
  tuningMutual,
  isTaggedKeep,
  isTaggedJunk,
  onMarkKeep,
  onMarkJunk,
}: {
  item: ArmorPiece;
  copyCount: number;
  allItems: ArmorPiece[];
  classPrefs: ClassPreferenceProfile;
  isDominated: boolean;
  dominatorResult?: DominatorResult;
  popoverReason?: 'stat-lower' | 'tuning-equivalent';
  tuningMutual?: boolean;
  isTaggedKeep: boolean;
  isTaggedJunk: boolean;
  onMarkKeep: () => void;
  onMarkJunk: () => void;
}) {
  const classItems = allItems.filter((i) => i.classType === item.classType);
  const breakdown = scoreItem(item, classPrefs, classItems);
  const card = (
    <div className="h-full w-full relative">
      <ArmorCard
        piece={item}
        breakdown={breakdown}
        static={isDominated && Boolean(dominatorResult)}
        copyCount={copyCount}
        copyCountTitle={`${copyCount} copies of this roll in bucket`}
        className="h-full"
      />
    </div>
  );

  return (
    <div className="relative space-y-2">
      {isDominated && dominatorResult ? (
        <DominatorPopover
          candidate={item}
          result={dominatorResult}
          classPrefs={classPrefs}
          classItems={classItems}
          reason={popoverReason ?? 'stat-lower'}
          tuningMutual={tuningMutual ?? false}
        >
          {card}
        </DominatorPopover>
      ) : (
        card
      )}
      <div className="flex gap-2 px-0.5">
        <button
          type="button"
          onClick={onMarkKeep}
          title={isTaggedKeep ? 'Remove keep tag in DIM' : 'Tag keep in DIM'}
          className={isTaggedKeep ? tagKeepBtnActiveClass : tagKeepBtnClass}
        >
          {isTaggedKeep ? 'Tagged keep' : 'Mark keep'}
        </button>
        <button
          type="button"
          onClick={onMarkJunk}
          title={isTaggedJunk ? 'Remove junk tag in DIM' : 'Tag junk in DIM'}
          className={isTaggedJunk ? tagJunkBtnActiveClass : tagJunkBtnClass}
        >
          {isTaggedJunk ? 'Tagged junk' : 'Mark junk'}
        </button>
      </div>
    </div>
  );
}
