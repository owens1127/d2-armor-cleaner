import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TransitionFlash } from '@/components/TransitionFlash';
import { comparePieces } from '@/components/duel/ArmorCard';
import { BucketSwitcher } from '@/components/duel/BucketSwitcher';
import { BucketWrapUpPanel } from '@/components/duel/BucketWrapUpPanel';
import { DuelComparePanel } from '@/components/duel/DuelComparePanel';
import { DuelKeyboardHints, DuelPageCenter } from '@/components/duel/DuelPageShell';
import { PendingTagsFootnote } from '@/components/duel/PendingTagsFootnote';
import { hasActiveSession } from '@/lib/bungie/loadVault';
import {
  advanceAfterPreferLoss,
  advanceAfterResolve,
  advanceAfterKeepSide,
  advanceTournamentSkippingActed,
  filterDuelItems,
  initTournament,
  initTournamentSkippingResolved,
  preferLossCount,
  restoreTournament,
  rotatePairToBack,
} from '@/lib/dupes/duel';
import { CLASS_LABELS, ARCHETYPE_LABELS, SLOT_LABELS, STAT_LABELS } from '@/lib/constants';
import {
  activeBucketItemCount,
  bucketKeyString,
  findBucketByKey,
  formatDupeBucketLabel,
} from '@/lib/dupes/queue';
import {
  duelInBucketProgress,
  duelSessionBucketCounts,
  formatDuelInBucketProgress,
} from '@/lib/duel/progress';
import { getClassPrefs, updateClassPrefs } from '@/lib/prefs/profile';
import { classFromRouteParam, parseClassRouteParam } from '@/lib/session/cleanRoute';
import {
  hasInBucketProgress,
  planCleanMount,
  showCleanEmptyState,
  vaultHasDuelableBuckets,
} from '@/lib/session/cleanSession';
import {
  buildBucketWrapUpReport,
  isBucketReadyForWrapUp,
} from '@/lib/session/bucketWrapUp';
import {
  buildCleanSearchParams,
  parseCleanSearchParams,
  searchParamsMatchCleanState,
} from '@/lib/session/cleanUrl';
import { learnFromCleanPick } from '@/lib/scoring/learn';
import { handleDuelKeyDown } from '@/lib/duel/keyboard';
import {
  captureBucketDuelSnapshot,
  MAX_DUEL_UNDO_DEPTH,
  tournamentFromSnapshot,
  type BucketDuelUndoSnapshot,
} from '@/lib/duel/undo';
import {
  useAuthStore,
  usePrefsStore,
  useSessionStore,
  useVaultStore,
  ensureVaultHydrated,
} from '@/stores';
import type { ArmorPiece, DupeBucket, DupeBucketKey } from '@/types';

export function DuelPage() {
  const { class: classParam } = useParams<{ class: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedClass = parseClassRouteParam(classParam);
  const classType = classFromRouteParam(classParam);
  const { membership } = useAuthStore();
  const {
    allItems,
    classStates,
    vaultLoading,
    vaultStatus,
    loadLiveVault,
    globalDupeRules,
  } = useVaultStore();
  const classVault = classStates[classType];
  const { profile, updateProfile } = usePrefsStore();
  const {
    initDuelQueue,
    restartClassDuels,
    clearClassCleanSession,
    restoreCleanProgress,
    setBucketTournament,
    getCurrentBucket,
    recordPreferLoss,
    recordPairJunk,
    recordJunkBoth,
    recordKeepBoth,
    recordKeepSide,
    recordActedPair,
    restoreBucketDuelSnapshot,
    advanceToNextBucket,
    skipCurrentBucket,
    switchToBucket,
    resetCurrentBucket,
    bucketJunkedIds,
    bucketEliminatedIds,
    bucketLossCounts,
    bucketKeptBothIds,
    bucketKeptSideIds,
    bucketChampionId,
    bucketChallengerIds,
    actedPairKeys,
    duelQueue,
    pendingTags,
    clearPendingTags,
  } = useSessionStore();

  const [champion, setChampion] = useState<ArmorPiece | null>(null);
  const [challengerQueue, setChallengerQueue] = useState<ArmorPiece[]>([]);
  const [resolving, setResolving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [bucketWrapUpKey, setBucketWrapUpKey] = useState<string | null>(null);
  const [choosingNextBucket, setChoosingNextBucket] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const hydratedRef = useRef<string | null>(null);
  const prevBucketKeyRef = useRef<string | null>(null);
  const prevDuelKeyRef = useRef<string | null>(null);
  const skipNextBucketFlashRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<BucketDuelUndoSnapshot[]>([]);

  function resetStageScroll() {
    stageRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }

  useEffect(() => {
    if (!classVault) {
      void ensureVaultHydrated();
      return;
    }

    const hydrateKey = `${classType}:${location.key}:${searchParams.toString()}`;
    if (hydratedRef.current === hydrateKey) return;

    const routeBucketKey = (location.state as { bucketKey?: DupeBucketKey } | null)?.bucketKey;
    const singleBucketKey = routeBucketKey ? bucketKeyString(routeBucketKey) : null;
    const urlPartial = parseCleanSearchParams(searchParams);
    const urlBucketKey = urlPartial?.bucketKey ?? null;

    const session = useSessionStore.getState();
    const plan = planCleanMount(
      classType,
      urlBucketKey,
      {
        cleanClassType: session.cleanClassType,
        duelQueue: session.duelQueue,
        bucketJunkedIds: session.bucketJunkedIds,
        bucketEliminatedIds: session.bucketEliminatedIds,
        bucketLossCounts: session.bucketLossCounts,
        bucketKeptBothIds: session.bucketKeptBothIds,
        bucketKeptSideIds: session.bucketKeptSideIds,
        bucketChampionId: session.bucketChampionId,
        bucketChallengerIds: session.bucketChallengerIds,
        actedPairKeys: session.actedPairKeys,
      },
      classVault,
      singleBucketKey,
      session.pendingTags,
    );

    if (plan.action === 'init') {
      initDuelQueue(classType);
    } else if (plan.action === 'restore') {
      restoreCleanProgress({
        classType,
        duelQueue: plan.duelQueue,
        bucketJunkedIds: plan.bucketJunkedIds,
        bucketEliminatedIds: plan.bucketEliminatedIds,
        bucketLossCounts: plan.bucketLossCounts,
        bucketKeptBothIds: plan.bucketKeptBothIds,
        bucketKeptSideIds: plan.bucketKeptSideIds,
        bucketChampionId: plan.bucketChampionId,
        bucketChallengerIds: plan.bucketChallengerIds,
        actedPairKeys: plan.actedPairKeys,
      });
    }

    hydratedRef.current = hydrateKey;
  }, [
    classType,
    classVault,
    location.key,
    location.state,
    searchParams,
    initDuelQueue,
    restoreCleanProgress,
  ]);

  const bucket = getCurrentBucket(classType);
  const currentBucketKey = duelQueue[0] ?? null;

  const nonIgnoredItems = useMemo(
    () => bucket?.items.filter((i) => !i.isIgnored) ?? [],
    [bucket],
  );

  const duelItems = useMemo(
    () =>
      filterDuelItems(
        nonIgnoredItems,
        bucketJunkedIds,
        bucketKeptBothIds,
        pendingTags,
        bucketEliminatedIds,
        bucketKeptSideIds,
      ),
    [
      nonIgnoredItems,
      bucketJunkedIds,
      bucketKeptBothIds,
      bucketEliminatedIds,
      bucketKeptSideIds,
      pendingTags,
    ],
  );

  const activeDupeRules = classVault?.activeDupeRules ?? globalDupeRules;

  const onlyRollExcludeIds = useMemo(
    () => [...new Set([...bucketJunkedIds, ...bucketEliminatedIds])],
    [bucketJunkedIds, bucketEliminatedIds],
  );

  const challenger = challengerQueue[0] ?? null;

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useLayoutEffect(() => {
    if (!bucket || !champion || !challenger || !currentBucketKey) return;

    const duelKey = `${champion.instanceId}:${challenger.instanceId}`;
    const bucketChanged =
      prevBucketKeyRef.current !== null && prevBucketKeyRef.current !== currentBucketKey;
    const duelChanged = prevDuelKeyRef.current !== null && prevDuelKeyRef.current !== duelKey;

    if (bucketChanged) {
      if (skipNextBucketFlashRef.current) {
        skipNextBucketFlashRef.current = false;
      } else {
        setFlash(`Next bucket · ${formatDupeBucketLabel(bucket.key)}`);
      }
      resetStageScroll();
      setResolving(false);
    } else if (duelChanged) {
      const inBucket = duelInBucketProgress(duelItems.length, challengerQueue.length);
      if (inBucket) {
        setFlash(formatDuelInBucketProgress(inBucket));
      }
      setResolving(false);
    }

    prevBucketKeyRef.current = currentBucketKey;
    prevDuelKeyRef.current = duelKey;
  }, [
    currentBucketKey,
    champion,
    challenger,
    bucket,
    duelItems.length,
    challengerQueue.length,
  ]);

  useEffect(() => {
    if (!resolving) return;
    const timer = window.setTimeout(() => setResolving(false), 500);
    return () => window.clearTimeout(timer);
  }, [resolving]);

  const empty =
    !bucket &&
    !!classVault &&
    showCleanEmptyState(classType, classVault, pendingTags);
  const queueExhausted =
    !bucket && !!classVault && !empty && pendingTags.length > 0;
  const tagKeepCount = pendingTags.filter((t) => t.tag === 'keep').length;
  const tagJunkCount = pendingTags.filter((t) => t.tag === 'junk').length;

  useEffect(() => {
    const nextState = { bucketKey: currentBucketKey };
    if (searchParamsMatchCleanState(searchParams, nextState)) return;
    setSearchParams(buildCleanSearchParams(nextState), { replace: true });
  }, [currentBucketKey, searchParams, setSearchParams]);

  useEffect(() => {
    if (!classVault || bucket || duelQueue.length > 0) return;
    if (showCleanEmptyState(classType, classVault, pendingTags)) return;
    if (!vaultHasDuelableBuckets(classType, classVault, pendingTags)) return;
    initDuelQueue(classType);
    hydratedRef.current = null;
  }, [classVault, bucket, duelQueue.length, classType, pendingTags, initDuelQueue]);

  function syncTournament(next: { champion: ArmorPiece | null; challengerQueue: ArmorPiece[] }) {
    setChampion(next.champion);
    setChallengerQueue(next.challengerQueue);
    setBucketTournament(
      next.champion?.instanceId ?? null,
      next.challengerQueue.map((i) => i.instanceId),
    );
  }

  function triggerBucketWrapUpIfReady(items: ArmorPiece[]): boolean {
    if (!bucket || !currentBucketKey) return false;
    const actedKeys = useSessionStore.getState().actedPairKeys;
    if (!isBucketReadyForWrapUp(items, actedKeys, true)) return false;
    if (bucketWrapUpKey === currentBucketKey) return true;
    setBucketWrapUpKey(currentBucketKey);
    setChoosingNextBucket(false);
    syncTournament({ champion: null, challengerQueue: [] });
    resetStageScroll();
    setResolving(false);
    return true;
  }

  function confirmBucketWrapUp(targetKey?: string) {
    if (!bucketWrapUpKey || !bucket) return;
    clearUndoStack();
    skipNextBucketFlashRef.current = true;
    advanceToNextBucket(classType, nonIgnoredItems);
    if (targetKey) {
      const nextHead = useSessionStore.getState().duelQueue[0];
      if (targetKey !== nextHead) {
        switchToBucket(targetKey);
      }
    }
    setBucketWrapUpKey(null);
    setChoosingNextBucket(false);
    syncTournament({ champion: null, challengerQueue: [] });
    resetStageScroll();
    hydratedRef.current = null;
  }

  useEffect(() => {
    if (!bucketWrapUpKey || !bucket) return;
    if (!isBucketReadyForWrapUp(duelItems, actedPairKeys, true)) {
      setBucketWrapUpKey(null);
      setChoosingNextBucket(false);
    }
  }, [
    bucketWrapUpKey,
    bucket,
    duelItems.length,
    actedPairKeys.join(','),
    bucketJunkedIds.join(','),
    bucketEliminatedIds.join(','),
  ]);

  useEffect(() => {
    if (currentBucketKey && bucketWrapUpKey && bucketWrapUpKey !== currentBucketKey) {
      setBucketWrapUpKey(null);
      setChoosingNextBucket(false);
    }
  }, [currentBucketKey, bucketWrapUpKey]);

  useEffect(() => {
    if (!bucket || resolving || bucketWrapUpKey) return;
    if (!isBucketReadyForWrapUp(duelItems, actedPairKeys, true)) return;
    triggerBucketWrapUpIfReady(duelItems);
  }, [
    bucket,
    currentBucketKey,
    duelItems.length,
    actedPairKeys.join(','),
    bucketJunkedIds.join(','),
    bucketEliminatedIds.join(','),
    resolving,
    bucketWrapUpKey,
  ]);

  useEffect(() => {
    if (!bucket || resolving || duelItems.length < 2) {
      if (!bucket || duelItems.length < 2) {
        setChampion(null);
        setChallengerQueue([]);
        if (bucketChampionId !== null || bucketChallengerIds.length > 0) {
          setBucketTournament(null, []);
        }
      }
      return;
    }

    const next = restoreTournament(
      duelItems,
      bucketChampionId,
      bucketChallengerIds,
      actedPairKeys,
    );
    if (!next) return;

    setChampion(next.champion);
    setChallengerQueue(next.challengerQueue);

    const championId = next.champion?.instanceId ?? null;
    const challengerIds = next.challengerQueue.map((i) => i.instanceId);
    if (
      championId !== bucketChampionId ||
      challengerIds.join(',') !== bucketChallengerIds.join(',')
    ) {
      setBucketTournament(championId, challengerIds);
    }
  }, [
    currentBucketKey,
    bucket,
    duelItems.length,
    bucketJunkedIds.join(','),
    bucketEliminatedIds.join(','),
    bucketKeptBothIds.join(','),
    bucketKeptSideIds.join(','),
    actedPairKeys.join(','),
    bucketChampionId,
    bucketChallengerIds.join(','),
    resolving,
  ]);

  useEffect(() => {
    if (!champion && !challenger) return;
    const activeIds = new Set(duelItems.map((i) => i.instanceId));
    const championStale = champion !== null && !activeIds.has(champion.instanceId);
    const challengerStale = challenger !== null && !activeIds.has(challenger.instanceId);
    const selfPair =
      champion !== null &&
      challenger !== null &&
      champion.instanceId === challenger.instanceId;
    if (!championStale && !challengerStale && !selfPair) return;

    if (duelItems.length < 2) {
      setChampion(duelItems[0] ?? null);
      setChallengerQueue([]);
      setBucketTournament(duelItems[0]?.instanceId ?? null, []);
      return;
    }
    const next = initTournamentSkippingResolved(duelItems, actedPairKeys);
    if (!next) return;
    setChampion(next.champion);
    setChallengerQueue(next.challengerQueue);
    setBucketTournament(
      next.champion?.instanceId ?? null,
      next.challengerQueue.map((i) => i.instanceId),
    );
  }, [duelItems, champion, challenger, actedPairKeys.join(',')]);

  const classPrefs = getClassPrefs(profile, classType);
  const comparison =
    champion && challenger
      ? comparePieces(champion, challenger, classPrefs, allItems, {
          dupeRules: activeDupeRules,
          excludeInstanceIds: onlyRollExcludeIds,
        })
      : null;

  function advanceTournament(
    raw: { champion: ArmorPiece | null; challengerQueue: ArmorPiece[] },
    items: ArmorPiece[],
    actedKeys = useSessionStore.getState().actedPairKeys,
  ) {
    if (triggerBucketWrapUpIfReady(items)) return;

    const next = advanceTournamentSkippingActed(
      items,
      { champion: raw.champion, challengerQueue: raw.challengerQueue },
      actedKeys,
    );
    if (!next) {
      triggerBucketWrapUpIfReady(items);
      return;
    }
    syncTournament(next);
  }

  function clearUndoStack() {
    undoStackRef.current = [];
  }

  function pushUndoSnapshot() {
    const s = useSessionStore.getState();
    undoStackRef.current.push(
      captureBucketDuelSnapshot(
        {
          bucketJunkedIds: s.bucketJunkedIds,
          bucketEliminatedIds: s.bucketEliminatedIds,
          bucketLossCounts: s.bucketLossCounts,
          bucketKeptBothIds: s.bucketKeptBothIds,
          bucketKeptSideIds: s.bucketKeptSideIds,
          actedPairKeys: s.actedPairKeys,
          bucketChampionId: s.bucketChampionId,
          bucketChallengerIds: s.bucketChallengerIds,
          pendingTags: s.pendingTags,
        },
        s.pendingTags,
      ),
    );
    if (undoStackRef.current.length > MAX_DUEL_UNDO_DEPTH) {
      undoStackRef.current.shift();
    }
  }

  function beginResolve(action: () => void) {
    if (resolving) return;
    pushUndoSnapshot();
    setResolving(true);
    action();
  }

  function undoLast() {
    if (resolving || bucketWrapUpKey) return;
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;

    restoreBucketDuelSnapshot(snapshot);
    setBucketWrapUpKey(null);
    setChoosingNextBucket(false);
    setResolving(false);

    const s = useSessionStore.getState();
    const restoredItems = filterDuelItems(
      nonIgnoredItems,
      s.bucketJunkedIds,
      s.bucketKeptBothIds,
      s.pendingTags,
      s.bucketEliminatedIds,
      s.bucketKeptSideIds,
    );
    syncTournament(tournamentFromSnapshot(snapshot, restoredItems));
  }

  function resolvePair(winner: ArmorPiece, loser: ArmorPiece) {
    if (!bucket || !champion) return;

    const { eliminated } = recordPreferLoss(loser);
    recordActedPair(winner, loser);

    updateProfile((p) =>
      updateClassPrefs(p, classType, (prefs) =>
        learnFromCleanPick(winner, loser, prefs, { allItems }),
      ),
    );

    const s = useSessionStore.getState();
    const nextDuelItems = filterDuelItems(
      nonIgnoredItems,
      s.bucketJunkedIds,
      s.bucketKeptBothIds,
      s.pendingTags,
      s.bucketEliminatedIds,
      s.bucketKeptSideIds,
    );

    const next = eliminated
      ? advanceAfterResolve(winner, loser, challengerQueue, nextDuelItems)
      : advanceAfterPreferLoss(winner, loser, challengerQueue);
    if (next.champion === null) {
      triggerBucketWrapUpIfReady(nextDuelItems);
    } else {
      advanceTournament(next, nextDuelItems);
    }
  }

  function pickLeft() {
    if (!champion || !challenger) return;
    beginResolve(() => resolvePair(champion, challenger));
  }

  function pickRight() {
    if (!champion || !challenger) return;
    beginResolve(() => resolvePair(challenger, champion));
  }

  function resolvePairKeepSide(kept: ArmorPiece, other: ArmorPiece) {
    if (!bucket || !champion) return;

    recordKeepSide(kept);
    recordActedPair(kept, other);

    updateProfile((p) =>
      updateClassPrefs(p, classType, (prefs) =>
        learnFromCleanPick(kept, other, prefs, { allItems }),
      ),
    );

    const nextKeptSideIds = useSessionStore.getState().bucketKeptSideIds;
    const nextDuelItems = filterDuelItems(
      nonIgnoredItems,
      bucketJunkedIds,
      bucketKeptBothIds,
      pendingTags,
      bucketEliminatedIds,
      nextKeptSideIds,
    );

    if (triggerBucketWrapUpIfReady(nextDuelItems)) return;

    const raw = advanceAfterKeepSide(kept, other, challengerQueue);
    const byId = new Map(nextDuelItems.map((i) => [i.instanceId, i]));
    const nextChampion = raw.champion ? byId.get(raw.champion.instanceId) ?? null : null;
    const nextQueue = raw.challengerQueue
      .map((c) => byId.get(c.instanceId))
      .filter((c): c is ArmorPiece => c != null);

    if (!nextChampion) {
      advanceTournament(initTournament(nextDuelItems), nextDuelItems);
      return;
    }

    advanceTournament({ champion: nextChampion, challengerQueue: nextQueue }, nextDuelItems);
  }

  function keepLeft() {
    if (!champion || !challenger) return;
    beginResolve(() => resolvePairKeepSide(champion, challenger));
  }

  function keepRight() {
    if (!champion || !challenger) return;
    beginResolve(() => resolvePairKeepSide(challenger, champion));
  }

  function keepBoth() {
    if (!bucket || !champion || !challenger) return;

    beginResolve(() => {
      recordKeepBoth(champion, challenger);
      recordActedPair(champion, challenger);
      const nextKeptBothIds = [...bucketKeptBothIds, champion.instanceId, challenger.instanceId];
      const nextDuelItems = filterDuelItems(
        nonIgnoredItems,
        bucketJunkedIds,
        nextKeptBothIds,
        pendingTags,
        bucketEliminatedIds,
        bucketKeptSideIds,
      );

      if (triggerBucketWrapUpIfReady(nextDuelItems)) return;
      advanceTournament(initTournament(nextDuelItems), nextDuelItems);
    });
  }

  function junkOne(junked: ArmorPiece) {
    if (!bucket || !champion || !challenger) return;

    beginResolve(() => {
      recordPairJunk(junked);
      recordActedPair(champion, challenger);
      const nextJunkedIds = [...bucketJunkedIds, junked.instanceId];
      const nextDuelItems = filterDuelItems(
        nonIgnoredItems,
        nextJunkedIds,
        bucketKeptBothIds,
        pendingTags,
        bucketEliminatedIds,
        bucketKeptSideIds,
      );

      if (triggerBucketWrapUpIfReady(nextDuelItems)) return;
      advanceTournament(initTournament(nextDuelItems), nextDuelItems);
    });
  }

  function junkLeftOnly() {
    if (!champion) return;
    junkOne(champion);
  }

  function junkRightOnly() {
    if (!challenger) return;
    junkOne(challenger);
  }

  function passPair() {
    if (!champion || !challenger) return;
    beginResolve(() => {
      recordActedPair(champion, challenger);
      advanceTournament(rotatePairToBack(champion, challenger, challengerQueue), duelItems);
    });
  }

  function junkBoth() {
    if (!bucket || !champion || !challenger) return;

    beginResolve(() => {
      recordJunkBoth(champion, challenger);
      recordActedPair(champion, challenger);
      const nextJunkedIds = [...bucketJunkedIds, champion.instanceId, challenger.instanceId];
      const nextDuelItems = filterDuelItems(
        nonIgnoredItems,
        nextJunkedIds,
        bucketKeptBothIds,
        pendingTags,
        bucketEliminatedIds,
        bucketKeptSideIds,
      );

      if (triggerBucketWrapUpIfReady(nextDuelItems)) return;
      advanceTournament(initTournament(nextDuelItems), nextDuelItems);
    });
  }

  function skipBucket() {
    if (resolving) return;
    clearUndoStack();
    setResolving(true);
    skipCurrentBucket();
    syncTournament({ champion: null, challengerQueue: [] });
  }

  const bucketInProgress = hasInBucketProgress({
    bucketJunkedIds,
    bucketEliminatedIds,
    bucketLossCounts,
    bucketKeptBothIds,
    bucketKeptSideIds,
    actedPairKeys,
    bucketChampionId,
  });

  const queueBuckets = useMemo(
    () =>
      classVault
        ? duelQueue
            .map((key) => findBucketByKey(classVault.buckets, key))
            .filter((b): b is DupeBucket => b != null)
        : [],
    [duelQueue, classVault],
  );

  const bucketWrapUpReport = useMemo(() => {
    if (!bucket || !bucketWrapUpKey) return null;
    return buildBucketWrapUpReport(nonIgnoredItems, {
      bucketJunkedIds,
      bucketEliminatedIds,
      bucketLossCounts,
      bucketKeptBothIds,
      bucketKeptSideIds,
      actedPairKeys,
      pendingTags,
    });
  }, [
    bucket,
    bucketWrapUpKey,
    nonIgnoredItems,
    bucketJunkedIds,
    bucketEliminatedIds,
    bucketLossCounts,
    bucketKeptBothIds,
    bucketKeptSideIds,
    actedPairKeys,
    pendingTags,
  ]);

  const wrapUpOtherBuckets = useMemo(
    () =>
      bucketWrapUpKey
        ? queueBuckets.filter((b) => bucketKeyString(b.key) !== bucketWrapUpKey)
        : [],
    [queueBuckets, bucketWrapUpKey],
  );

  function handleSwitchBucket(targetKey: string) {
    if (targetKey === currentBucketKey || resolving) return;
    if (
      bucketInProgress &&
      !window.confirm(
        'Switch bucket? In-progress picks and junk tags for the current bucket will be cleared.',
      )
    ) {
      return;
    }
    clearUndoStack();
    switchToBucket(targetKey);
    syncTournament({ champion: null, challengerQueue: [] });
    hydratedRef.current = null;
  }

  function handleResetBucket() {
    if (resolving || !currentBucketKey) return;
    if (
      !window.confirm(
        'Reset this bucket? All in-progress picks, junk tags, and compare progress will be cleared. The bucket stays in your queue.',
      )
    ) {
      return;
    }
    clearUndoStack();
    resetCurrentBucket();
    setBucketWrapUpKey(null);
    setChoosingNextBucket(false);
    syncTournament({ champion: null, challengerQueue: [] });
  }

  useEffect(() => {
    clearUndoStack();
  }, [currentBucketKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleDuelKeyDown(
        e,
        {
          pickLeft,
          pickRight,
          passPair,
          keepLeft,
          keepRight,
          keepBoth,
          junkLeft: junkLeftOnly,
          junkRight: junkRightOnly,
          junkBoth,
          skipBucket,
          undoLast,
        },
        { duelActive: !!(champion && challenger) && !bucketWrapUpKey, resolving: resolving || !!bucketWrapUpKey },
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (parsedClass === null && classParam !== undefined) {
    return <Navigate to="/duel/hunter" replace />;
  }
  if (!membership) {
    if (hasActiveSession()) {
      return (
        <DuelPageCenter>
          <p className="text-lg mb-2">Restoring session…</p>
        </DuelPageCenter>
      );
    }
    return <Navigate to="/" replace />;
  }

  if (vaultLoading && !classVault) {
    return (
      <DuelPageCenter>
        <p className="text-lg mb-2">Loading vault…</p>
        <p className="text-sm text-muted">{vaultStatus ?? 'Please wait'}</p>
      </DuelPageCenter>
    );
  }

  if (!classVault) {
    return (
      <DuelPageCenter>
        <p className="text-muted mb-4">No vault data yet.</p>
        <button
          type="button"
          onClick={() => loadLiveVault()}
          className="px-4 py-2 rounded-lg bg-accent text-surface font-medium"
        >
          Load vault
        </button>
      </DuelPageCenter>
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (resolving) return;
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx > 0) pickLeft();
    else pickRight();
  }

  function handleRestartQueue() {
    clearUndoStack();
    restartClassDuels(classType);
    syncTournament({ champion: null, challengerQueue: [] });
    hydratedRef.current = null;
  }

  function handleClearClassSession() {
    if (
      !window.confirm(
        `Clear all ${CLASS_LABELS[classType]} compare progress and queued tags for this class? This cannot be undone.`,
      )
    ) {
      return;
    }
    clearClassCleanSession(classType);
    syncTournament({ champion: null, challengerQueue: [] });
    hydratedRef.current = null;
  }

  const bucketCounts = duelSessionBucketCounts(duelQueue.length);
  const inBucketProgress =
    champion && challenger
      ? duelInBucketProgress(duelItems.length, challengerQueue.length)
      : null;
  const duelInitializing =
    !!bucket?.hasDupes && duelItems.length >= 2 && !champion && !challenger && !bucketWrapUpKey;

  const wrapUpNextBucket = queueBuckets.length > 1 ? queueBuckets[1] : null;

  const showingBucketWrapUp = !!(bucketWrapUpKey && bucket && bucketWrapUpReport);

  return (
    <Layout>
      <TransitionFlash message={flash} />
      <div className="clean-page">
        <div className="clean-page__chrome">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div>
              <h1 className="ui-heading text-3xl font-semibold tracking-tight">
                Compare {CLASS_LABELS[classType]} duplicates
              </h1>
              {showingBucketWrapUp ? (
                <p className="text-sm text-muted mt-1">Review this group, then continue</p>
              ) : bucket ? (
                <p className="text-sm text-muted mt-1">
                  {SLOT_LABELS[bucket.key.armorSlot]} · {ARCHETYPE_LABELS[bucket.key.archetype]} ·{' '}
                  {STAT_LABELS[bucket.key.tertiaryStat]}
                  {' · '}
                  {activeBucketItemCount(bucket)} items
                  {inBucketProgress && <> · {formatDuelInBucketProgress(inBucketProgress)}</>}
                </p>
              ) : empty ? (
                <p className="text-sm text-muted mt-1">No duplicate armor to compare for this class</p>
              ) : (
                <p className="text-sm text-muted mt-1">Starting next duplicate group…</p>
              )}
            </div>

            {queueBuckets.length > 0 && !showingBucketWrapUp && (
              <div className="flex flex-wrap items-end gap-2 shrink-0">
                <BucketSwitcher
                  buckets={queueBuckets}
                  currentKey={currentBucketKey}
                  onSelect={handleSwitchBucket}
                  disabled={resolving}
                  completedBuckets={0}
                  sessionTotal={bucketCounts.total}
                />
                {currentBucketKey && (
                  <button
                    type="button"
                    onClick={handleResetBucket}
                    disabled={resolving}
                    className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Reset bucket
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="clean-page__stage" ref={stageRef}>
          <div className="clean-page__center clean-page__center--duel">
            {showingBucketWrapUp && (
              <BucketWrapUpPanel
                bucket={bucket}
                report={bucketWrapUpReport}
                otherBuckets={wrapUpOtherBuckets}
                nextBucket={wrapUpNextBucket}
                groupsInQueue={queueBuckets.length}
                choosingBucket={choosingNextBucket}
                onContinue={() => confirmBucketWrapUp()}
                onStartChooseBucket={() => setChoosingNextBucket(true)}
                onSelectBucket={(key) => confirmBucketWrapUp(key)}
                onCancelChooseBucket={() => setChoosingNextBucket(false)}
              />
            )}

            {!showingBucketWrapUp && duelInitializing && (
              <p className="text-muted text-center">Preparing comparisons…</p>
            )}

            {!showingBucketWrapUp && queueExhausted && (
              <div className="text-center py-8 ui-card w-full max-w-md mx-auto">
                <p className="ui-heading text-xl font-medium mb-2">Queue empty</p>
                <p className="text-sm text-muted mb-4">
                  {tagKeepCount} keep · {tagJunkCount} junk queued. Review tags before applying to
                  DIM, or restart the queue to compare more duplicate groups.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/review" className="ui-btn-primary inline-block px-8 py-3">
                    Review tags
                  </Link>
                  <button
                    type="button"
                    onClick={handleRestartQueue}
                    className="ui-btn-secondary px-8 py-3"
                  >
                    Restart queue
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClearClassSession}
                  className="mt-4 text-xs text-muted hover:text-danger hover:underline underline-offset-2"
                >
                  Clear {CLASS_LABELS[classType]} session
                </button>
              </div>
            )}

            {!showingBucketWrapUp && empty && (
              <div className="text-center py-8 ui-card w-full max-w-md mx-auto">
                <p className="ui-heading text-xl font-medium mb-2">No duplicates to compare</p>
                <p className="text-sm text-muted mb-4">
                  No duplicate buckets match your rules for {CLASS_LABELS[classType]}. Try loosening
                  dupe rules in Settings or load a fresh vault snapshot.
                </p>
              </div>
            )}

            {!showingBucketWrapUp &&
              !empty &&
              !queueExhausted &&
              !duelInitializing &&
              !champion &&
              !challenger && (
              <p className="text-muted text-center">
                No duplicate groups in queue. Loosen dupe rules in Settings or restart the queue.
              </p>
            )}

            {!showingBucketWrapUp && champion && challenger && comparison && (
              <>
                <DuelComparePanel
                  key={`${currentBucketKey}:${champion.instanceId}:${challenger.instanceId}`}
                  left={champion}
                  right={challenger}
                  recommended={comparison.recommended}
                  suggestionSuppressed={comparison.suggestionSuppressed}
                  identicalRolls={comparison.identicalRolls}
                  breakdownLeft={comparison.breakdownA}
                  breakdownRight={comparison.breakdownB}
                  classPrefs={classPrefs}
                  allItems={allItems}
                  dupeRules={activeDupeRules}
                  excludeInstanceIds={onlyRollExcludeIds}
                  lossCountLeft={preferLossCount(bucketLossCounts, champion.instanceId)}
                  lossCountRight={preferLossCount(bucketLossCounts, challenger.instanceId)}
                  onPickLeft={pickLeft}
                  onPickRight={pickRight}
                  onKeepLeft={keepLeft}
                  onKeepRight={keepRight}
                  onKeepBoth={keepBoth}
                  onJunkLeft={junkLeftOnly}
                  onJunkRight={junkRightOnly}
                  onJunkBoth={junkBoth}
                  onPassPair={passPair}
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                  disabled={resolving}
                />
                <div className="mt-3 flex flex-col items-center gap-2">
                  <div className="flex gap-4 text-xs text-accent-dim uppercase tracking-wide">
                    <button
                      type="button"
                      onClick={skipBucket}
                      disabled={resolving}
                      className="hover:text-white disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Skip group (S)
                    </button>
                  </div>
                  <DuelKeyboardHints />
                </div>
              </>
            )}

            {pendingTags.length > 0 && (
              <PendingTagsFootnote count={pendingTags.length} onClearAll={clearPendingTags} />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
