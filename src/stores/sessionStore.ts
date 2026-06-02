import { create } from 'zustand';
import type {
  ArmorPiece,
  ClassType,
  DupeBucket,
  PendingTag,
  TagValue,
} from '@/types';
import {
  bucketKeyString,
  buildDuelQueueKeys,
  findBucketByKey,
  prioritizeQueueHead,
  rebuildDuelQueueKeys,
} from '@/lib/dupes/queue';
import {
  duelExcludedIds,
  filterDuelItems,
  findStrandedPreferLosers,
  makePairKey,
  recordPreferLossIncrement,
  resolveBucketJunkIds,
  splitBucketTags,
  type BucketLossCounts,
} from '@/lib/dupes/duel';
import type { BucketDuelUndoSnapshot } from '@/lib/duel/undo';
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
} from '@/lib/session/persist';
import { emptyBucketSessionFields } from '@/lib/session/bucketSession';
import {
  clearReviewTags,
  hydrateReviewTags,
  normalizePendingTags,
  pendingTagFromPiece,
  reconcilePendingTagsWithVault,
  saveReviewTags,
} from '@/lib/session/reviewTags';
import { applyTagsDirect } from '@/lib/dim/applyDirect';
import type { DimApplySummary } from '@/lib/dim/tags';
import { useVaultStore } from '@/stores/vaultStore';

function duelQueueAfterAdvance(
  classType: ClassType,
  currentQueue: string[],
  pendingTags: PendingTag[],
): string[] {
  let queue = currentQueue.slice(1);
  if (queue.length > 0) return queue;
  const vault = useVaultStore.getState().classStates[classType];
  if (!vault) return [];
  const excluded = duelExcludedIds(
    [],
    [],
    pendingTags,
    vault.buckets.flatMap((b) => b.items),
  );
  return buildDuelQueueKeys(classType, vault.buckets, excluded);
}

interface SessionStore {
  cleanClassType: ClassType | null;
  activeNavClass: ClassType;
  pendingTags: PendingTag[];
  duelQueue: string[];
  bucketJunkedIds: string[];
  bucketEliminatedIds: string[];
  bucketLossCounts: BucketLossCounts;
  bucketKeptBothIds: string[];
  bucketKeptSideIds: string[];
  bucketChampionId: string | null;
  bucketChallengerIds: string[];
  actedPairKeys: string[];
  setActiveNavClass: (classType: ClassType) => void;
  initDuelQueue: (classType: ClassType) => void;
  restartClassDuels: (classType: ClassType) => void;
  clearClassCleanSession: (classType: ClassType) => void;
  restoreCleanProgress: (payload: {
    classType: ClassType;
    duelQueue: string[];
    bucketJunkedIds: string[];
    bucketEliminatedIds: string[];
    bucketLossCounts?: BucketLossCounts;
    bucketKeptBothIds: string[];
    bucketKeptSideIds: string[];
    bucketChampionId?: string | null;
    bucketChallengerIds?: string[];
    actedPairKeys?: string[];
  }) => void;
  setBucketTournament: (championId: string | null, challengerIds: string[]) => void;
  rebuildDuelQueue: (classType: ClassType) => void;
  initSingleBucket: (classType: ClassType, key: DupeBucket['key']) => void;
  getCurrentBucket: (classType: ClassType) => DupeBucket | null;
  recordPreferLoss: (loser: ArmorPiece) => { lossCount: number; eliminated: boolean };
  recordPairJunk: (loser: ArmorPiece) => void;
  recordJunkBoth: (a: ArmorPiece, b: ArmorPiece) => void;
  recordKeepBoth: (a: ArmorPiece, b: ArmorPiece) => void;
  recordKeepSide: (piece: ArmorPiece) => void;
  recordActedPair: (a: ArmorPiece, b: ArmorPiece) => void;
  restoreBucketDuelSnapshot: (snapshot: BucketDuelUndoSnapshot) => void;
  advanceToNextBucket: (classType: ClassType, allInBucket: ArmorPiece[]) => void;
  skipCurrentBucket: () => void;
  switchToBucket: (targetKey: string) => void;
  resetCurrentBucket: () => void;
  /** Queue tags for Review page (duel/compare and auto triage only). */
  queueForReview: (items: ArmorPiece[], tag: TagValue) => void;
  /** @deprecated Use queueForReview or applyTagDirect. */
  queueItemTags: (items: ArmorPiece[], tag: TagValue) => void;
  /** Apply tags to DIM immediately (browse, heatmap, build picker). */
  applyTagDirect: (
    items: ArmorPiece[],
    tag: TagValue | null,
  ) => Promise<DimApplySummary>;
  /** Queue junk for review (auto triage). */
  junkItems: (items: ArmorPiece[]) => void;
  removePendingTag: (instanceId: string) => void;
  clearPendingTags: () => void;
  /** Drop pending rows that already match vault/DIM after refresh or direct apply. */
  reconcilePendingWithVault: () => void;
  clearSession: () => void;
}

function mergePendingTags(
  existing: PendingTag[],
  ...additions: PendingTag[]
): PendingTag[] {
  return normalizePendingTags([...existing, ...additions]);
}

const restoredSession = loadPersistedSession();
const initialPendingTags = hydrateReviewTags(restoredSession?.pendingTags);

export const useSessionStore = create<SessionStore>((set, get) => ({
  cleanClassType: restoredSession?.cleanClassType ?? null,
  activeNavClass: restoredSession?.activeNavClass ?? restoredSession?.cleanClassType ?? 'hunter',
  pendingTags: initialPendingTags,
  duelQueue: restoredSession?.duelQueue ?? [],
  bucketJunkedIds: restoredSession?.bucketJunkedIds ?? [],
  bucketEliminatedIds: restoredSession?.bucketEliminatedIds ?? [],
  bucketLossCounts: restoredSession?.bucketLossCounts ?? {},
  bucketKeptBothIds: restoredSession?.bucketKeptBothIds ?? [],
  bucketKeptSideIds: restoredSession?.bucketKeptSideIds ?? [],
  bucketChampionId: restoredSession?.bucketChampionId ?? null,
  bucketChallengerIds: restoredSession?.bucketChallengerIds ?? [],
  actedPairKeys: restoredSession?.actedPairKeys ?? [],

  setActiveNavClass: (classType) => set({ activeNavClass: classType }),

  restoreCleanProgress: ({
    classType,
    duelQueue,
    bucketJunkedIds,
    bucketEliminatedIds,
    bucketLossCounts = {},
    bucketKeptBothIds,
    bucketKeptSideIds = [],
    bucketChampionId = null,
    bucketChallengerIds = [],
    actedPairKeys = [],
  }) =>
    set({
      cleanClassType: classType,
      activeNavClass: classType,
      duelQueue,
      bucketJunkedIds,
      bucketEliminatedIds,
      bucketLossCounts,
      bucketKeptBothIds,
      bucketKeptSideIds,
      bucketChampionId,
      bucketChallengerIds,
      actedPairKeys,
    }),

  setBucketTournament: (championId, challengerIds) =>
    set({ bucketChampionId: championId, bucketChallengerIds: challengerIds }),

  initDuelQueue: (classType) => {
    const state = useVaultStore.getState().classStates[classType];
    if (!state) return;
    const session = get();
    const excluded = duelExcludedIds(
      [],
      [],
      session.pendingTags,
      state.buckets.flatMap((b) => b.items),
    );
    const allKeys = buildDuelQueueKeys(classType, state.buckets, excluded);
    set({
      cleanClassType: classType,
      activeNavClass: classType,
      duelQueue: allKeys,
      ...emptyBucketSessionFields(),
    });
  },

  restartClassDuels: (classType) => {
    set(emptyBucketSessionFields());
    get().initDuelQueue(classType);
  },

  clearClassCleanSession: (classType) => {
    set((s) => ({
      pendingTags: s.pendingTags.filter((t) => t.classType !== classType),
      ...emptyBucketSessionFields(),
    }));
    get().initDuelQueue(classType);
  },

  rebuildDuelQueue: (classType) => {
    const vault = useVaultStore.getState().classStates[classType];
    if (!vault) return;
    set((s) => ({
      cleanClassType: classType,
      activeNavClass: classType,
      duelQueue: rebuildDuelQueueKeys(
        classType,
        vault.buckets,
        [],
        s.duelQueue,
        s.bucketJunkedIds,
        s.bucketKeptBothIds,
        s.pendingTags,
        s.bucketEliminatedIds,
        s.bucketKeptSideIds,
      ),
    }));
  },

  initSingleBucket: (classType, key) => {
    set({
      cleanClassType: classType,
      activeNavClass: classType,
      duelQueue: [bucketKeyString(key)],
      ...emptyBucketSessionFields(),
    });
  },

  getCurrentBucket: (classType) => {
    const { duelQueue } = get();
    const state = useVaultStore.getState().classStates[classType];
    if (!state || duelQueue.length === 0) return null;
    return findBucketByKey(state.buckets, duelQueue[0]) ?? null;
  },

  recordPreferLoss: (loser) => {
    const s = get();
    const { lossCounts, lossCount, eliminated } = recordPreferLossIncrement(
      s.bucketLossCounts,
      loser.instanceId,
    );
    set({
      bucketLossCounts: lossCounts,
      ...(eliminated && !s.bucketEliminatedIds.includes(loser.instanceId)
        ? { bucketEliminatedIds: [...s.bucketEliminatedIds, loser.instanceId] }
        : {}),
    });
    return { lossCount, eliminated };
  },

  recordPairJunk: (loser) => {
    set((s) => ({
      bucketJunkedIds: [...s.bucketJunkedIds, loser.instanceId],
      pendingTags: mergePendingTags(
        s.pendingTags.filter((t) => t.instanceId !== loser.instanceId),
        pendingTagFromPiece(loser, 'junk'),
      ),
    }));
  },

  recordJunkBoth: (a, b) => {
    set((s) => ({
      bucketJunkedIds: [...s.bucketJunkedIds, a.instanceId, b.instanceId],
      pendingTags: mergePendingTags(
        s.pendingTags.filter(
          (t) => t.instanceId !== a.instanceId && t.instanceId !== b.instanceId,
        ),
        pendingTagFromPiece(a, 'junk'),
        pendingTagFromPiece(b, 'junk'),
      ),
    }));
  },

  recordKeepBoth: (a, b) => {
    set((s) => ({
      bucketKeptBothIds: [...s.bucketKeptBothIds, a.instanceId, b.instanceId],
      pendingTags: s.pendingTags.filter(
        (t) => t.instanceId !== a.instanceId && t.instanceId !== b.instanceId,
      ),
    }));
  },

  recordKeepSide: (piece) => {
    set((s) => ({
      bucketKeptSideIds: [...s.bucketKeptSideIds, piece.instanceId],
      pendingTags: s.pendingTags.filter((t) => t.instanceId !== piece.instanceId),
    }));
  },

  recordActedPair: (a, b) => {
    if (a.instanceId === b.instanceId) return;
    const key = makePairKey(a.instanceId, b.instanceId);
    set((s) =>
      s.actedPairKeys.includes(key) ? s : { actedPairKeys: [...s.actedPairKeys, key] },
    );
  },

  restoreBucketDuelSnapshot: (snapshot) =>
    set({
      bucketJunkedIds: snapshot.bucketJunkedIds,
      bucketEliminatedIds: snapshot.bucketEliminatedIds,
      bucketLossCounts: snapshot.bucketLossCounts,
      bucketKeptBothIds: snapshot.bucketKeptBothIds,
      bucketKeptSideIds: snapshot.bucketKeptSideIds,
      actedPairKeys: snapshot.actedPairKeys,
      bucketChampionId: snapshot.bucketChampionId,
      bucketChallengerIds: snapshot.bucketChallengerIds,
      pendingTags: snapshot.pendingTags,
    }),

  advanceToNextBucket: (classType, allInBucket) => {
    const bucket = get().getCurrentBucket(classType);
    if (!bucket) return;

    const s = get();
    const duelItems = filterDuelItems(
      allInBucket.filter((i) => !i.isIgnored),
      s.bucketJunkedIds,
      s.bucketKeptBothIds,
      s.pendingTags,
      s.bucketEliminatedIds,
      s.bucketKeptSideIds,
    );
    const stranded = findStrandedPreferLosers(
      duelItems,
      s.bucketLossCounts,
      s.actedPairKeys,
    );
    const eliminatedIds = [...new Set([...s.bucketEliminatedIds, ...stranded])];
    const { bucketJunkedIds, bucketKeptBothIds, bucketKeptSideIds } = s;
    const resolvedJunkIds = resolveBucketJunkIds(
      bucketJunkedIds,
      eliminatedIds,
      bucketKeptBothIds,
      bucketKeptSideIds,
    );
    const { kept, junked } = splitBucketTags(allInBucket, resolvedJunkIds);
    const keptIds = kept.map((k) => k.instanceId);
    const junkedIds = junked.map((j) => j.instanceId);

    set((s) => {
      const nextPendingTags = mergePendingTags(
        s.pendingTags.filter(
          (t) => !keptIds.includes(t.instanceId) && !junkedIds.includes(t.instanceId),
        ),
        ...kept.map((k) => pendingTagFromPiece(k, 'keep')),
        ...junked.map((j) => pendingTagFromPiece(j, 'junk')),
      );
      return {
        pendingTags: nextPendingTags,
        duelQueue: duelQueueAfterAdvance(classType, s.duelQueue, nextPendingTags),
        ...emptyBucketSessionFields(),
      };
    });
  },

  skipCurrentBucket: () => {
    const classType = get().cleanClassType ?? 'hunter';
    set((s) => ({
      duelQueue: duelQueueAfterAdvance(classType, s.duelQueue, s.pendingTags),
      ...emptyBucketSessionFields(),
      pendingTags: s.pendingTags.filter(
        (t) => !s.bucketJunkedIds.includes(t.instanceId),
      ),
    }));
  },

  switchToBucket: (targetKey) => {
    set((s) => {
      if (!s.duelQueue.includes(targetKey)) return s;
      const junkedSet = new Set(s.bucketJunkedIds);
      return {
        duelQueue: prioritizeQueueHead(s.duelQueue, targetKey),
        ...emptyBucketSessionFields(),
        pendingTags: s.pendingTags.filter((t) => !junkedSet.has(t.instanceId)),
      };
    });
  },

  resetCurrentBucket: () => {
    set((s) => {
      const junkedSet = new Set(s.bucketJunkedIds);
      return {
        ...emptyBucketSessionFields(),
        pendingTags: s.pendingTags.filter((t) => !junkedSet.has(t.instanceId)),
      };
    });
  },

  queueForReview: (items, tag) => {
    if (items.length === 0) return;
    set((s) => {
      const ids = new Set(items.map((i) => i.instanceId));
      const newTags = items.map((j) => pendingTagFromPiece(j, tag));
      return {
        pendingTags: mergePendingTags(
          s.pendingTags.filter((t) => !ids.has(t.instanceId)),
          ...newTags,
        ),
      };
    });
  },

  queueItemTags: (items, tag) => {
    get().queueForReview(items, tag);
  },

  applyTagDirect: async (items, tag) => {
    if (items.length === 0) return { applied: [], allOk: true };
    const summary = await applyTagsDirect(
      items.map((item) => ({ instanceId: item.instanceId, tag })),
    );
    const okIds = new Set(
      summary.applied.filter((r) => r.ok).map((r) => r.instanceId),
    );
    if (okIds.size > 0) {
      set((s) => ({
        pendingTags: s.pendingTags.filter((t) => !okIds.has(t.instanceId)),
      }));
    }
    return summary;
  },

  reconcilePendingWithVault: () => {
    const items = useVaultStore.getState().allItems;
    set((s) => ({
      pendingTags: reconcilePendingTagsWithVault(s.pendingTags, items),
    }));
  },

  junkItems: (items) => {
    get().queueForReview(items, 'junk');
  },

  removePendingTag: (instanceId) => {
    set((s) => ({
      pendingTags: s.pendingTags.filter((t) => t.instanceId !== instanceId),
    }));
  },

  clearPendingTags: () => {
    clearReviewTags();
    set({ pendingTags: [] });
  },

  clearSession: () => {
    clearPersistedSession();
    clearReviewTags();
    set({
      cleanClassType: null,
      activeNavClass: 'hunter',
      pendingTags: [],
      duelQueue: [],
      ...emptyBucketSessionFields(),
    });
  },
}));

useSessionStore.subscribe((state) => {
  saveReviewTags(state.pendingTags);
  savePersistedSession({
    cleanClassType: state.cleanClassType,
    activeNavClass: state.activeNavClass,
    duelQueue: state.duelQueue,
    bucketJunkedIds: state.bucketJunkedIds,
    bucketEliminatedIds: state.bucketEliminatedIds,
    bucketLossCounts: state.bucketLossCounts,
    bucketKeptBothIds: state.bucketKeptBothIds,
    bucketKeptSideIds: state.bucketKeptSideIds,
    bucketChampionId: state.bucketChampionId,
    bucketChallengerIds: state.bucketChallengerIds,
    actedPairKeys: state.actedPairKeys,
  });
});
