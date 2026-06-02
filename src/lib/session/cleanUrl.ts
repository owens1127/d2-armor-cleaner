import type { ClassType } from '@/types';

export interface CleanUrlState {
  /** Active dupe bucket key (`bucketKeyString` format). */
  bucketKey: string | null;
}

/**
 * Parse clean URL search params.
 *
 * Schema (on `/duel/:class`):
 * - `bucket`: pipe-delimited dupe bucket key (`class|slot|archetype|tertiary|set|tuning`)
 *
 * Duel round progress is derived from persisted session (champion/challenger ids), not the URL.
 */
export function parseCleanSearchParams(params: URLSearchParams): Partial<CleanUrlState> | null {
  const bucketParam = params.get('bucket');

  if (!bucketParam) return null;

  return { bucketKey: bucketParam };
}

export function buildCleanSearchParams(state: CleanUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.bucketKey) {
    params.set('bucket', state.bucketKey);
  }

  return params;
}

export function searchParamsMatchCleanState(
  params: URLSearchParams,
  state: CleanUrlState,
): boolean {
  return buildCleanSearchParams(state).toString() === params.toString();
}

export function buildCleanPath(
  classType: ClassType,
  state?: CleanUrlState | null,
): string {
  if (!state?.bucketKey) {
    return `/duel/${classType}`;
  }
  const qs = buildCleanSearchParams(state).toString();
  return qs ? `/duel/${classType}?${qs}` : `/duel/${classType}`;
}
