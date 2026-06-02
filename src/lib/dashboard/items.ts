import type { ArmorPiece, DupeBucket, PendingTag } from '@/types';

/** Junk instance IDs hidden from dashboard views (counts, lists, feeds, heatmap). */
export function dashboardJunkExcludedIds(
  pendingTags: PendingTag[] = [],
  bucketJunkedIds: string[] = [],
  items?: ArmorPiece[],
): Set<string> {
  const excluded = new Set(bucketJunkedIds);
  for (const t of pendingTags) {
    if (t.tag === 'junk') excluded.add(t.instanceId);
  }
  if (items) {
    for (const i of items) {
      if (i.dimTag === 'junk') excluded.add(i.instanceId);
    }
  }
  return excluded;
}

/** Whether an item should be omitted from dashboard surfaces (ignored or junk-tagged). */
export function isDashboardHiddenItem(
  item: ArmorPiece,
  pendingTags: PendingTag[] = [],
  bucketJunkedIds: string[] = [],
): boolean {
  if (item.isIgnored) return true;
  const excluded = dashboardJunkExcludedIds(pendingTags, bucketJunkedIds, [item]);
  return excluded.has(item.instanceId);
}

/**
 * Active armor visible on the dashboard. Respects dupe-rule ignores (`isIgnored`) and always
 * omits junk-tagged pieces (DIM junk, session bucket junk, pending review junk).
 */
export function filterDashboardItems(
  items: ArmorPiece[],
  pendingTags: PendingTag[] = [],
  bucketJunkedIds: string[] = [],
): ArmorPiece[] {
  const excluded = dashboardJunkExcludedIds(pendingTags, bucketJunkedIds, items);
  return items.filter((i) => !i.isIgnored && !excluded.has(i.instanceId));
}

export function countDashboardItems(
  items: ArmorPiece[],
  pendingTags: PendingTag[] = [],
  bucketJunkedIds: string[] = [],
): number {
  return filterDashboardItems(items, pendingTags, bucketJunkedIds).length;
}

/** Dupe buckets with at least two visible (non-hidden) items. */
export function dashboardDupeBuckets(
  buckets: DupeBucket[],
  pendingTags: PendingTag[] = [],
  bucketJunkedIds: string[] = [],
): DupeBucket[] {
  return buckets.filter(
    (b) => countDashboardItems(b.items, pendingTags, bucketJunkedIds) >= 2,
  );
}

/**
 * Whether the heatmap bucket panel should close after marking junk.
 * Stays open while more than two items remain visible on the dashboard (same threshold as dupe buckets).
 */
export function shouldCloseDashboardBucketPanel(
  items: ArmorPiece[],
  bucketJunkedIds: string[],
  newlyJunkedIds: string[],
): boolean {
  if (newlyJunkedIds.length === 0) return false;
  const added = new Set(newlyJunkedIds);
  const nextBucketJunked = [
    ...bucketJunkedIds,
    ...newlyJunkedIds.filter((id) => !bucketJunkedIds.includes(id)),
  ];
  const simulatedItems = items.map((item) =>
    added.has(item.instanceId) ? { ...item, dimTag: 'junk' as const } : item,
  );
  return countDashboardItems(simulatedItems, [], nextBucketJunked) <= 2;
}
