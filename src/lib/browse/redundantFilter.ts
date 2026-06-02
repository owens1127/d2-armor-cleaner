import { BROWSE_REDUNDANT_QUERY } from '@/lib/nav';
import type { ArmorPiece } from '@/types';

export function isBrowseRedundantActive(search: URLSearchParams | string): boolean {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get(BROWSE_REDUNDANT_QUERY) === '1';
}

export function setBrowseRedundantInParams(
  params: URLSearchParams,
  active: boolean,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (active) {
    next.set(BROWSE_REDUNDANT_QUERY, '1');
  } else {
    next.delete(BROWSE_REDUNDANT_QUERY);
  }
  return next;
}

/** Browse grid filter: redundant dismantle candidates only. */
export function filterBrowseRedundantOnly(
  items: ArmorPiece[],
  redundantOnly: boolean,
  redundantRollIds: ReadonlySet<string>,
): ArmorPiece[] {
  if (!redundantOnly) return items;
  return items.filter((i) => redundantRollIds.has(i.instanceId));
}
