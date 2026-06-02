import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceAfterPreferLoss,
  advanceAfterResolve,
  initTournament,
  pairKeyFromPieces,
  recordPreferLossIncrement,
} from '@/lib/dupes/duel';
import {
  captureBucketDuelSnapshot,
  tournamentFromSnapshot,
} from '@/lib/duel/undo';
import { armorPiece } from '@/test/armorFixtures';

const { localStorageMock, local } = vi.hoisted(() => {
  const local = new Map<string, string>();
  return {
    local,
    localStorageMock: {
      getItem: (k: string) => local.get(k) ?? null,
      setItem: (k: string, v: string) => local.set(k, v),
      removeItem: (k: string) => local.delete(k),
      clear: () => local.clear(),
    },
  };
});

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
});

describe('duel bracket decisions → undo snapshot → restore', () => {
  let useSessionStore: typeof import('@/stores').useSessionStore;

  beforeAll(async () => {
    ({ useSessionStore } = await import('@/stores'));
  });

  beforeEach(() => {
    local.clear();
    useSessionStore.setState({
      pendingTags: [],
      duelQueue: ['hunter|helmet|gunner|super|101|weapons'],
      bucketJunkedIds: [],
      bucketEliminatedIds: [],
      bucketLossCounts: {},
      bucketKeptBothIds: [],
      bucketKeptSideIds: [],
      bucketChampionId: null,
      bucketChallengerIds: [],
      actedPairKeys: [],
    });
  });

  it('restores tournament and session state after undo snapshot', () => {
    const items = [
      armorPiece({ instanceId: 'high', wantScore: 0.9 }),
      armorPiece({ instanceId: 'mid', wantScore: 0.6 }),
      armorPiece({ instanceId: 'low', wantScore: 0.3 }),
    ];
    let tournament = initTournament(items);
    const champion = tournament.champion!;
    const challenger = tournament.challengerQueue[0]!;

    const before = captureBucketDuelSnapshot(
      {
        bucketJunkedIds: useSessionStore.getState().bucketJunkedIds,
        bucketEliminatedIds: useSessionStore.getState().bucketEliminatedIds,
        bucketLossCounts: useSessionStore.getState().bucketLossCounts,
        bucketKeptBothIds: useSessionStore.getState().bucketKeptBothIds,
        bucketKeptSideIds: useSessionStore.getState().bucketKeptSideIds,
        actedPairKeys: useSessionStore.getState().actedPairKeys,
        bucketChampionId: champion.instanceId,
        bucketChallengerIds: tournament.challengerQueue.map((p) => p.instanceId),
        pendingTags: useSessionStore.getState().pendingTags,
      },
      useSessionStore.getState().pendingTags,
    );

    useSessionStore.getState().recordPairJunk(challenger);
    useSessionStore.getState().recordActedPair(champion, challenger);
    tournament = advanceAfterResolve(champion, challenger, tournament.challengerQueue.slice(1), items);
    useSessionStore.getState().setBucketTournament(
      tournament.champion?.instanceId ?? null,
      tournament.challengerQueue.map((p) => p.instanceId),
    );

    expect(useSessionStore.getState().bucketJunkedIds).toContain(challenger.instanceId);
    expect(useSessionStore.getState().actedPairKeys).toContain(
      pairKeyFromPieces(champion, challenger),
    );

    useSessionStore.getState().restoreBucketDuelSnapshot(before);
    const restored = tournamentFromSnapshot(before, items);

    expect(useSessionStore.getState().bucketJunkedIds).toEqual([]);
    expect(useSessionStore.getState().pendingTags).toEqual([]);
    expect(restored.champion?.instanceId).toBe('high');
    expect(restored.challengerQueue.map((p) => p.instanceId)).toEqual(['mid', 'low']);
  });

  it('prefer-loss then undo preserves loss counts until restored', () => {
    const winner = armorPiece({ instanceId: 'winner', wantScore: 0.9 });
    const loser = armorPiece({ instanceId: 'loser', wantScore: 0.4 });
    const tournament = initTournament([winner, loser]);
    const before = captureBucketDuelSnapshot(
      {
        bucketJunkedIds: [],
        bucketEliminatedIds: [],
        bucketLossCounts: {},
        bucketKeptBothIds: [],
        bucketKeptSideIds: [],
        actedPairKeys: [],
        bucketChampionId: tournament.champion!.instanceId,
        bucketChallengerIds: tournament.challengerQueue.map((p) => p.instanceId),
        pendingTags: [],
      },
      [],
    );

    const { lossCounts, eliminated } = recordPreferLossIncrement({}, loser.instanceId);
    expect(eliminated).toBe(false);
    useSessionStore.getState().recordPreferLoss(loser);
    useSessionStore.getState().recordActedPair(winner, loser);
    advanceAfterPreferLoss(winner, loser, tournament.challengerQueue);

    expect(useSessionStore.getState().bucketLossCounts).toEqual(lossCounts);

    useSessionStore.getState().restoreBucketDuelSnapshot(before);
    expect(useSessionStore.getState().bucketLossCounts).toEqual({});
  });
});
