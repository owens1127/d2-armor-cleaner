/** Canonical key for an unordered pair of item ids. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface PairwiseRankOptions<T extends string | number> {
  /** Lower index = stronger prior preference (used for tie-breaks and pair selection). */
  priorOrder?: T[];
  /** Safety cap: defaults to n*(n-1)/2 for n items. */
  maxComparisons?: number;
  /**
   * Stop early when the top K items are ordered among themselves and each
   * beats every lower-ranked item. Default 3; set 0 to disable.
   */
  greedyTopK?: number;
}

export interface PairwiseRankState<T extends string | number> {
  readonly items: readonly T[];
  readonly decidedPairs: ReadonlySet<string>;
  readonly comparisonCount: number;
  readonly maxComparisons: number;
}

export interface PairwiseRank<T extends string | number> extends PairwiseRankState<T> {
  nextPair(): [T, T] | null;
  recordChoice(winner: T, loser: T): void;
  recordTie(a: T, b: T): void;
  isConfident(): boolean;
  /** True when the top greedyTopK preferences are separated from the rest. */
  isGreedyConfident(): boolean;
  getOrderedItems(): T[];
}

function defaultMaxComparisons(n: number): number {
  return n <= 1 ? 0 : (n * (n - 1)) / 2;
}

/** Min of full pairwise count and a per-step greedy cap. */
export function greedyPairwiseCap(itemCount: number, cap: number): number {
  return Math.min(defaultMaxComparisons(itemCount), cap);
}

function itemId<T extends string | number>(item: T): string {
  return String(item);
}

/** Convert a total or partial order into normalized weights (top = highest). */
export function orderToWeights<T extends string>(
  ordered: readonly T[],
  baseline = 0.5,
): Record<T, number> {
  const n = ordered.length;
  if (n === 0) return {} as Record<T, number>;
  const weights = {} as Record<T, number>;
  ordered.forEach((item, i) => {
    weights[item] = n === 1 ? 1 : (n - i) / n;
  });
  for (const item of ordered) {
    if (weights[item] === undefined) weights[item] = baseline;
  }
  return weights;
}

class PairwiseRankImpl<T extends string | number> implements PairwiseRank<T> {
  readonly items: readonly T[];
  readonly decidedPairs = new Set<string>();
  readonly maxComparisons: number;
  private readonly greedyTopK: number;

  private beats = new Map<string, Set<string>>();
  private wins = new Map<string, number>();
  private priorIndex = new Map<string, number>();

  constructor(items: readonly T[], options: PairwiseRankOptions<T> = {}) {
    const unique = [...new Set(items)];
    this.items = unique;
    this.maxComparisons =
      options.maxComparisons ?? defaultMaxComparisons(unique.length);
    this.greedyTopK = options.greedyTopK ?? 3;

    const prior = options.priorOrder ?? unique;
    prior.forEach((item, i) => {
      this.priorIndex.set(itemId(item), i);
    });
    unique.forEach((item, i) => {
      if (!this.priorIndex.has(itemId(item))) {
        this.priorIndex.set(itemId(item), prior.length + i);
      }
    });
  }

  get comparisonCount(): number {
    return this.decidedPairs.size;
  }

  private knowsWinner(a: T, b: T): T | null {
    const aId = itemId(a);
    const bId = itemId(b);
    if (this.beats.get(aId)?.has(bId)) return a;
    if (this.beats.get(bId)?.has(aId)) return b;
    return null;
  }

  private addBeat(winner: T, loser: T): void {
    const wId = itemId(winner);
    const lId = itemId(loser);
    if (this.beats.get(wId)?.has(lId)) return;

    if (!this.beats.has(wId)) this.beats.set(wId, new Set());
    this.beats.get(wId)!.add(lId);

    for (const beaten of this.beats.get(lId) ?? []) {
      this.addBeat(winner, beaten as T);
    }
    for (const [other, beaten] of this.beats) {
      if (beaten.has(wId)) {
        this.addBeat(other as T, loser);
      }
    }
  }

  recordChoice(winner: T, loser: T): void {
    const key = pairKey(itemId(winner), itemId(loser));
    if (this.decidedPairs.has(key)) return;
    this.decidedPairs.add(key);
    this.wins.set(itemId(winner), (this.wins.get(itemId(winner)) ?? 0) + 1);
    this.addBeat(winner, loser);
  }

  recordTie(a: T, b: T): void {
    const key = pairKey(itemId(a), itemId(b));
    this.decidedPairs.add(key);
  }

  isConfident(): boolean {
    if (this.items.length <= 1) return true;
    for (let i = 0; i < this.items.length; i++) {
      for (let j = i + 1; j < this.items.length; j++) {
        if (this.knowsWinner(this.items[i], this.items[j]) === null) return false;
      }
    }
    return true;
  }

  isGreedyConfident(): boolean {
    if (this.items.length <= 1) return true;
    if (this.greedyTopK <= 0) return false;
    if (this.isConfident()) return true;

    const topK = Math.min(this.greedyTopK, this.items.length);
    const ranked = [...this.items].sort(
      (x, y) => this.estimatedRank(y) - this.estimatedRank(x),
    );
    const top = ranked.slice(0, topK);
    const rest = ranked.slice(topK);

    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        if (this.knowsWinner(top[i], top[j]) === null) return false;
      }
    }
    for (const leader of top) {
      for (const other of rest) {
        if (this.knowsWinner(leader, other) === null) return false;
      }
    }
    return true;
  }

  private estimatedRank(item: T): number {
    const id = itemId(item);
    const wins = this.wins.get(id) ?? 0;
    const prior = this.priorIndex.get(id) ?? 999;
    return wins * 1000 - prior;
  }

  nextPair(): [T, T] | null {
    if (this.items.length < 2) return null;
    if (this.comparisonCount >= this.maxComparisons) return null;
    if (this.isConfident() || this.isGreedyConfident()) return null;

    const undecided: [T, T][] = [];
    for (let i = 0; i < this.items.length; i++) {
      for (let j = i + 1; j < this.items.length; j++) {
        const a = this.items[i];
        const b = this.items[j];
        const key = pairKey(itemId(a), itemId(b));
        if (this.decidedPairs.has(key)) continue;
        if (this.knowsWinner(a, b) !== null) continue;
        undecided.push([a, b]);
      }
    }

    if (undecided.length === 0) return null;

    const ranked = [...this.items].sort(
      (x, y) => this.estimatedRank(y) - this.estimatedRank(x),
    );
    const rankOf = new Map<string, number>();
    ranked.forEach((item, idx) => rankOf.set(itemId(item), idx));

    undecided.sort((p1, p2) => {
      const gap1 = Math.abs(
        (rankOf.get(itemId(p1[0])) ?? 0) - (rankOf.get(itemId(p1[1])) ?? 0),
      );
      const gap2 = Math.abs(
        (rankOf.get(itemId(p2[0])) ?? 0) - (rankOf.get(itemId(p2[1])) ?? 0),
      );
      if (gap1 !== gap2) return gap1 - gap2;
      const priorGap1 = Math.abs(
        (this.priorIndex.get(itemId(p1[0])) ?? 0) -
          (this.priorIndex.get(itemId(p1[1])) ?? 0),
      );
      const priorGap2 = Math.abs(
        (this.priorIndex.get(itemId(p2[0])) ?? 0) -
          (this.priorIndex.get(itemId(p2[1])) ?? 0),
      );
      return priorGap1 - priorGap2;
    });

    return undecided[0];
  }

  getOrderedItems(): T[] {
    if (this.items.length <= 1) return [...this.items];

    const remaining = new Set(this.items.map(itemId));
    const ordered: T[] = [];
    const itemById = new Map(this.items.map((item) => [itemId(item), item]));

    while (remaining.size > 0) {
      const candidates = [...remaining].filter((id) => {
        for (const other of remaining) {
          if (other === id) continue;
          if (this.beats.get(other)?.has(id)) return false;
        }
        return true;
      });

      const pickFrom =
        candidates.length > 0 ? candidates : [...remaining];
      pickFrom.sort(
        (a, b) =>
          this.estimatedRank(itemById.get(b)! ) - this.estimatedRank(itemById.get(a)!),
      );
      const nextId = pickFrom[0];
      ordered.push(itemById.get(nextId)!);
      remaining.delete(nextId);
    }

    return ordered;
  }
}

export function createPairwiseRank<T extends string | number>(
  items: readonly T[],
  options?: PairwiseRankOptions<T>,
): PairwiseRank<T> {
  return new PairwiseRankImpl(items, options);
}

/** Replay decisions into a fresh ranker (resume / back navigation). */
export function replayPairwiseRank<T extends string | number>(
  items: readonly T[],
  decisions: ReadonlyArray<{ winner: T; loser: T } | { tie: [T, T] }>,
  options?: PairwiseRankOptions<T>,
): PairwiseRank<T> {
  const ranker = createPairwiseRank(items, options);
  for (const d of decisions) {
    if ('tie' in d && Array.isArray(d.tie)) {
      ranker.recordTie(d.tie[0], d.tie[1]);
    } else if ('winner' in d) {
      ranker.recordChoice(d.winner, d.loser);
    }
  }
  return ranker;
}

export function maxPairwiseComparisons(itemCount: number): number {
  return defaultMaxComparisons(itemCount);
}
