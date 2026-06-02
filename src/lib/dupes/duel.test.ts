import { describe, expect, it } from 'vitest';
import type { ArmorPiece, PendingTag } from '@/types';
import {
  advanceAfterKeepSide,
  advanceAfterPreferLoss,
  advanceAfterResolve,
  coerceTournamentToPool,
  filterDuelItems,
  findStrandedPreferLosers,
  initTournament,
  initTournamentSkippingResolved,
  makePairKey,
  pairKeyFromPieces,
  restoreTournament,
  rotatePairToBack,
  countUnresolvedPairs,
  hasUnresolvedPairs,
  noMoreDuelPairs,
  skipResolvedPairs,
  resolveBucketJunkIds,
  splitBucketTags,
} from '@/lib/dupes/duel';
function piece(id: string, score = 0): ArmorPiece {
  return {
    instanceId: id,
    name: `Piece ${id}`,
    classType: 'hunter',
    wantScore: score,
    isIgnored: false,
  } as ArmorPiece;
}

describe('filterDuelItems', () => {
  it('excludes junked, keep-both, keep-side, and pending junk from the duel pool', () => {
    const items = [
      piece('a'),
      { ...piece('b'), dimTag: 'junk' as const },
      piece('c'),
    ];
    const pending: PendingTag[] = [
      {
        instanceId: 'c',
        tag: 'junk',
        itemName: 'Piece c',
        classType: 'hunter',
      },
    ];
    expect(filterDuelItems(items, [], [], pending, [], ['b']).map((i) => i.instanceId)).toEqual(['a']);
  });
});

describe('noMoreDuelPairs', () => {
  it('completes early when every remaining pair is already recorded', () => {
    const items = [piece('a', 9), piece('b', 7), piece('c', 5)];
    const resolved = [
      pairKeyFromPieces(items[0], items[1]),
      pairKeyFromPieces(items[0], items[2]),
      pairKeyFromPieces(items[1], items[2]),
    ];
    expect(noMoreDuelPairs(items, resolved)).toBe(true);
    expect(initTournamentSkippingResolved(items, resolved)).toBeNull();
  });

  it('does not complete early when an unresolved pair remains', () => {
    const items = [piece('a', 9), piece('b', 7), piece('c', 5)];
    const resolved = [pairKeyFromPieces(items[0], items[1])];
    expect(noMoreDuelPairs(items, resolved)).toBe(false);
    const next = initTournamentSkippingResolved(items, resolved);
    expect(next?.champion?.instanceId).toBe('a');
    expect(next?.challengerQueue[0]?.instanceId).toBe('c');
  });
});

describe('skipResolvedPairs', () => {
  it('skips a recorded pair and surfaces the next challenger', () => {
    const items = [piece('a', 9), piece('b', 7), piece('c', 5)];
    const initial = initTournament(items);
    const resolved = [pairKeyFromPieces(items[0], items[1])];
    const next = skipResolvedPairs(items, resolved, initial);
    expect(next?.champion?.instanceId).toBe('a');
    expect(next?.challengerQueue[0]?.instanceId).toBe('c');
  });

  it('returns null when pass rotation would only show recorded pairs', () => {
    const items = [piece('a', 9), piece('b', 7)];
    const resolved = [pairKeyFromPieces(items[0], items[1])];
    const rotated = rotatePairToBack(items[0], items[1], [items[1]]);
    expect(skipResolvedPairs(items, resolved, rotated)).toBeNull();
  });

});

describe('prefer pair deduplication', () => {
  it('completes a two-item bucket after one recorded prefer without rematching', () => {
    const items = [piece('a', 9), piece('b', 7)];
    const resolved = [pairKeyFromPieces(items[0], items[1])];
    expect(initTournamentSkippingResolved(items, resolved)).toBeNull();
    expect(noMoreDuelPairs(items, resolved)).toBe(true);
    expect(findStrandedPreferLosers(items, { b: 1 }, resolved)).toEqual(['b']);
  });

});

describe('restoreTournament with resolved pairs', () => {
  it('skips stored champion/challenger when that pair was already recorded', () => {
    const items = [piece('10', 10), piece('20', 20), piece('30', 5)];
    const duelItems = filterDuelItems(items, [], [], [], []);
    const resolved = [makePairKey('10', '20')];
    const tournament = restoreTournament(duelItems, '10', ['20'], resolved);
    expect(tournament?.champion?.instanceId).toBe('10');
    expect(tournament?.challengerQueue[0]?.instanceId).toBe('30');
  });

});

describe('advanceAfterPreferLoss', () => {
  it('keeps winner as champion and re-queues loser behind remaining challengers', () => {
    const champion = piece('a', 9);
    const loser = piece('b', 5);
    const c = piece('c', 3);
    const next = advanceAfterPreferLoss(champion, loser, [loser, c]);
    expect(next.champion?.instanceId).toBe('a');
    expect(next.challengerQueue.map((i) => i.instanceId)).toEqual(['c', 'b']);
  });
});

describe('advanceAfterResolve', () => {
  it('keeps the winner as champion when challengers remain', () => {
    const champion = piece('a', 9);
    const challenger = piece('b', 5);
    const queue = [piece('c', 3)];
    const next = advanceAfterResolve(champion, challenger, queue);
    expect(next.champion?.instanceId).toBe('a');
    expect(next.challengerQueue.map((i) => i.instanceId)).toEqual(['c']);
  });

  it('signals completion when no challengers remain and pool is below two', () => {
    const next = advanceAfterResolve(piece('a'), piece('b'), []);
    expect(next.champion).toBeNull();
    expect(next.challengerQueue).toEqual([]);
  });

  it('re-seeds tournament when queue empties but other pieces remain in the pool', () => {
    const items = [piece('a', 9), piece('b', 7), piece('c', 5), piece('d', 3)];
    const next = advanceAfterResolve(items[0], items[3], [items[3]], items);
    expect(next.champion?.instanceId).toBe('a');
    expect(next.challengerQueue.map((i) => i.instanceId)).toEqual(['b', 'c']);
    expect(hasUnresolvedPairs(items.filter((i) => i.instanceId !== 'd'), [])).toBe(true);
  });
});

describe('junk both from duel pool', () => {
  it('removes junked pairs, completes bucket, and re-seeds tournament', () => {
    const duo = [piece('a'), piece('b')];
    expect(noMoreDuelPairs(filterDuelItems(duo, ['a', 'b'], []))).toBe(true);

    const items = [piece('low', 1), piece('high', 9), piece('mid', 5), piece('junk-a', 8), piece('junk-b', 7)];
    const remaining = filterDuelItems(items, ['junk-a', 'junk-b'], []);
    expect(remaining.map((i) => i.instanceId).sort()).toEqual(['high', 'low', 'mid']);
    const next = initTournament(remaining);
    expect(next.champion?.instanceId).toBe('high');
    expect(next.challengerQueue.map((i) => i.instanceId)).toEqual(['mid', 'low']);
  });
});

describe('resolveBucketJunkIds', () => {
  it('merges explicit junk with tournament losers at bucket end', () => {
    expect(resolveBucketJunkIds(['explicit'], ['loser-a', 'loser-b'], [])).toEqual([
      'explicit',
      'loser-a',
      'loser-b',
    ]);
  });

  it('does not auto-junk eliminated items that were kept both', () => {
    expect(resolveBucketJunkIds([], ['a', 'b'], ['a'])).toEqual(['b']);
  });
});

describe('keep one side vs prefer', () => {
  it('first prefer loss keeps loser in duel pool until threshold', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    const afterFirstLoss = filterDuelItems(items, [], [], [], []);
    expect(afterFirstLoss.map((i) => i.instanceId)).toEqual(['a', 'b', 'c']);
    expect(resolveBucketJunkIds([], [], [])).toEqual([]);
  });

  it('prefer path defers junk until bucket completion via eliminated ids', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    const afterEliminated = filterDuelItems(items, [], [], [], ['b']);
    expect(afterEliminated.map((i) => i.instanceId)).toEqual(['a', 'c']);
    expect(resolveBucketJunkIds([], ['b'], [])).toEqual(['b']);
  });

  it('keep side removes kept piece from duel pool and protects it from auto-junk', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    const afterKeepSide = filterDuelItems(items, [], [], [], [], ['a']);
    expect(afterKeepSide.map((i) => i.instanceId)).toEqual(['b', 'c']);
    expect(resolveBucketJunkIds([], ['b'], [], ['a'])).toEqual(['b']);
    expect(resolveBucketJunkIds([], ['a'], [], ['a'])).toEqual([]);
  });

  it('keep side advances bracket with other as champion and kept out of pool', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    const sorted = initTournament(items);
    const next = advanceAfterKeepSide(sorted.champion!, sorted.challengerQueue[0], sorted.challengerQueue.slice(1));
    expect(next.champion?.instanceId).toBe('b');
    expect(next.challengerQueue.map((i) => i.instanceId)).toEqual(['c']);
  });

  it('coerceTournamentToPool drops keep-sided ids and re-seeds when champion left', () => {
    const items = [piece('b', 5), piece('c', 3)];
    const coerced = coerceTournamentToPool(items, {
      champion: piece('a', 9),
      challengerQueue: [piece('a', 9), items[0], items[1]],
    });
    expect(coerced.champion?.instanceId).toBe('b');
    expect(coerced.challengerQueue.map((i) => i.instanceId)).toEqual(['c']);
  });

  it('restoreTournament after keep side skips the recorded pair', () => {
    const items = [piece('a', 75), piece('b', 75), piece('c', 50), piece('d', 40)];
    const remaining = filterDuelItems(items, [], [], [], [], ['b']);
    const resolved = [pairKeyFromPieces(items[0], items[1])];
    const tournament = restoreTournament(remaining, 'a', ['b', 'c', 'd'], resolved);
    expect(tournament?.champion?.instanceId).toBe('a');
    expect(tournament?.challengerQueue[0]?.instanceId).toBe('c');
  });

  it('keep side does not junk the non-kept piece', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    filterDuelItems(items, [], [], [], [], ['a']);
    expect(resolveBucketJunkIds([], [], [], ['a'])).toEqual([]);
    expect(resolveBucketJunkIds([], ['b'], [], ['a'])).toEqual(['b']);
  });

  it('keep-both removes both from duel pool', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    const afterKeepBoth = filterDuelItems(items, [], ['a', 'b'], [], []);
    expect(afterKeepBoth.map((i) => i.instanceId)).toEqual(['c']);
  });

  it('junk one side re-seeds without granting bracket credit to the survivor', () => {
    const items = [piece('a', 9), piece('b', 5), piece('c', 3)];
    const afterJunkLeft = filterDuelItems(items, ['a'], [], [], []);
    expect(afterJunkLeft.map((i) => i.instanceId)).toEqual(['b', 'c']);
    const next = initTournament(afterJunkLeft);
    expect(next.champion?.instanceId).toBe('b');
    expect(next.challengerQueue.map((i) => i.instanceId)).toEqual(['c']);
  });

  it('completes bucket when keep side leaves one duel item', () => {
    const items = [piece('a', 9), piece('b', 5)];
    expect(noMoreDuelPairs(filterDuelItems(items, [], [], [], [], ['a']))).toBe(true);
  });
});

describe('bucket completion resolution', () => {
  /** Simulates advanceToNextBucket tag split: every active item must be keep or junk. */
  function resolveBucket(allInBucket: ArmorPiece[], session: {
    bucketJunkedIds: string[];
    bucketEliminatedIds: string[];
    bucketKeptBothIds: string[];
    bucketKeptSideIds?: string[];
  }) {
    const junkedIds = resolveBucketJunkIds(
      session.bucketJunkedIds,
      session.bucketEliminatedIds,
      session.bucketKeptBothIds,
      session.bucketKeptSideIds ?? [],
    );
    return splitBucketTags(allInBucket, junkedIds);
  }

  it('resolves every active item to keep or junk after a full tournament', () => {
    const items = [piece('a', 9), piece('b', 7), piece('c', 5), piece('d', 3)];
    const { kept, junked } = resolveBucket(items, {
      bucketJunkedIds: [],
      bucketEliminatedIds: ['b', 'c', 'd'],
      bucketKeptBothIds: [],
    });
    expect([...kept, ...junked].map((i) => i.instanceId).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(kept.map((i) => i.instanceId)).toEqual(['a']);
    expect(junked.map((i) => i.instanceId).sort()).toEqual(['b', 'c', 'd']);
  });

  it('keeps keep-both pairs and junkes only tournament losers at completion', () => {
    const items = [piece('a'), piece('b'), piece('c'), piece('d')];
    const { kept, junked } = resolveBucket(items, {
      bucketJunkedIds: [],
      bucketEliminatedIds: ['b', 'd'],
      bucketKeptBothIds: ['a', 'c'],
    });
    expect(kept.map((i) => i.instanceId).sort()).toEqual(['a', 'c']);
    expect(junked.map((i) => i.instanceId).sort()).toEqual(['b', 'd']);
    expect(kept.length + junked.length).toBe(items.length);
  });

  it('keeps keep-side picks protected from tournament auto-junk at completion', () => {
    const items = [piece('a'), piece('b'), piece('c')];
    const { kept, junked } = resolveBucket(items, {
      bucketJunkedIds: [],
      bucketEliminatedIds: ['a', 'b'],
      bucketKeptBothIds: [],
      bucketKeptSideIds: ['a'],
    });
    expect(kept.map((i) => i.instanceId).sort()).toEqual(['a', 'c']);
    expect(junked.map((i) => i.instanceId)).toEqual(['b']);
  });

});

describe('self-pair prevention', () => {
  function duplicatePiece(id: string, score: number, suffix: string): ArmorPiece {
    return {
      ...piece(id, score),
      name: `Piece ${id} ${suffix}`,
    };
  }

  it('dedupes duplicate instanceIds in filterDuelItems', () => {
    const items = [duplicatePiece('a', 75, 'copy1'), duplicatePiece('a', 80, 'copy2'), piece('b')];
    expect(filterDuelItems(items, [], []).map((i) => i.instanceId)).toEqual(['a', 'b']);
    expect(filterDuelItems(items, [], [])[0].wantScore).toBe(80);
  });

  it('never surfaces champion vs same instanceId after initTournament', () => {
    const items = [
      duplicatePiece('stride-a', 75, 'copy1'),
      duplicatePiece('stride-a', 75, 'copy2'),
      piece('stride-b', 50),
      piece('stride-c', 40),
    ];
    const duelItems = filterDuelItems(items, [], []);
    const state = initTournamentSkippingResolved(duelItems, []);
    expect(state).not.toBeNull();
    expect(state!.champion?.instanceId).not.toBe(state!.challengerQueue[0]?.instanceId);
  });

  it('restoreTournament drops champion id duplicated at front of challenger queue', () => {
    const items = [piece('a', 75), piece('b', 50), piece('c', 40)];
    const duelItems = filterDuelItems(items, [], []);
    const tournament = restoreTournament(duelItems, 'a', ['a', 'b', 'c'], []);
    expect(tournament?.champion?.instanceId).toBe('a');
    expect(tournament?.challengerQueue[0]?.instanceId).toBe('b');
    expect(tournament?.champion?.instanceId).not.toBe(
      tournament?.challengerQueue[0]?.instanceId,
    );
  });

  it('findNextChampionWithWork never returns a self-pair', () => {
    const items = [
      duplicatePiece('a', 75, 'copy1'),
      duplicatePiece('a', 75, 'copy2'),
      piece('b', 50),
    ];
    const duelItems = filterDuelItems(items, [], []);
    const state = initTournamentSkippingResolved(duelItems, []);
    expect(state?.champion?.instanceId).toBe('a');
    expect(state?.challengerQueue[0]?.instanceId).toBe('b');
  });

  it('does not count self-pairs toward unresolved pair math', () => {
    const items = [
      duplicatePiece('a', 75, 'copy1'),
      duplicatePiece('a', 75, 'copy2'),
      piece('b', 50),
    ];
    expect(countUnresolvedPairs(items, [])).toBe(1);
  });
});
