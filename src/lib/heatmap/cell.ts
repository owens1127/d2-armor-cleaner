import { filterHeatmapItems } from '@/lib/heatmap/items';
import type {
  Archetype,
  ArmorPiece,
  ArmorSlot,
  DupeBucket,
  PendingTag,
  Stat,
} from '@/types';

/** All dupe buckets that share the heatmap cell identity (archetype × slot × tertiary). */
export function bucketsForHeatmapCell(
  buckets: DupeBucket[],
  archetype: Archetype,
  armorSlot: ArmorSlot,
  tertiaryStat: Stat,
): DupeBucket[] {
  return buckets.filter(
    (b) =>
      b.key.archetype === archetype &&
      b.key.armorSlot === armorSlot &&
      b.key.tertiaryStat === tertiaryStat,
  );
}

/** Visible dashboard items for a heatmap cell (all matching buckets, deduped). */
export function mergeHeatmapCellItems(
  cellBuckets: DupeBucket[],
  pendingTags: PendingTag[],
  bucketJunkedIds: string[],
): ArmorPiece[] {
  const seen = new Set<string>();
  const merged: ArmorPiece[] = [];
  for (const bucket of cellBuckets) {
    for (const item of filterHeatmapItems(
      bucket.items,
      pendingTags,
      bucketJunkedIds,
    )) {
      if (seen.has(item.instanceId)) continue;
      seen.add(item.instanceId);
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Single bucket for heatmap click / panel: merges items across every bucket in the cell.
 * `hasDupes` is true when any constituent dupe bucket still has dupes under active rules.
 */
export function mergedHeatmapBucket(
  cellBuckets: DupeBucket[],
): DupeBucket | undefined {
  if (cellBuckets.length === 0) return undefined;
  const base = cellBuckets[0]!;
  const byId = new Map<string, ArmorPiece>();
  for (const bucket of cellBuckets) {
    for (const item of bucket.items) {
      byId.set(item.instanceId, item);
    }
  }
  const items = [...byId.values()].sort(
    (a, b) =>
      (a.isDupe ? 0 : 1) - (b.isDupe ? 0 : 1) ||
      (a.isIgnored ? 1 : 0) - (b.isIgnored ? 1 : 0) ||
      (b.tier ?? 0) - (a.tier ?? 0) ||
      b.power - a.power,
  );
  return {
    key: {
      classType: base.key.classType,
      armorSlot: base.key.armorSlot,
      archetype: base.key.archetype,
      tertiaryStat: base.key.tertiaryStat,
    },
    items,
    hasDupes: cellBuckets.some((b) => b.hasDupes),
  };
}
