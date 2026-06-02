import { duelExcludedIds } from '@/lib/dupes/duel';
import { ARCHETYPES, ARCHETYPE_LABELS, ARMOR_SLOTS, SLOT_LABELS, STAT_LABELS, STATS } from '@/lib/constants';
import type { ArmorPiece, Archetype, ArmorSlot, ClassType, DupeBucket, DupeBucketKey, PendingTag, Stat } from '@/types';

function slotOrder(slot: ArmorSlot): number {
  const i = ARMOR_SLOTS.indexOf(slot);
  return i === -1 ? 99 : i;
}

function archetypeOrder(archetype: Archetype): number {
  const i = ARCHETYPES.indexOf(archetype);
  return i === -1 ? 99 : i;
}

function statOrder(stat: Stat): number {
  const i = STATS.indexOf(stat);
  return i === -1 ? 99 : i;
}

/** Picker order: helmet → arms → chest → legs → class, then archetype, tertiary, tuning, set. */
export function compareDupeBucketKeys(a: DupeBucketKey, b: DupeBucketKey): number {
  const slot = slotOrder(a.armorSlot) - slotOrder(b.armorSlot);
  if (slot !== 0) return slot;

  const arch = archetypeOrder(a.archetype) - archetypeOrder(b.archetype);
  if (arch !== 0) return arch;

  const tert = statOrder(a.tertiaryStat) - statOrder(b.tertiaryStat);
  if (tert !== 0) return tert;

  const tuneA = a.tuningStat ?? '';
  const tuneB = b.tuningStat ?? '';
  if (tuneA !== tuneB) return statOrder(tuneA as Stat) - statOrder(tuneB as Stat);

  return (a.armorSetHash ?? 0) - (b.armorSetHash ?? 0);
}

export function compareDupeBuckets(a: DupeBucket, b: DupeBucket): number {
  return compareDupeBucketKeys(a.key, b.key);
}

export function sortBucketsForPicker(buckets: DupeBucket[]): DupeBucket[] {
  return [...buckets].sort(compareDupeBuckets);
}

export function activeBucketItemCount(bucket: DupeBucket): number {
  return bucket.items.filter((i) => !i.isIgnored).length;
}

export function bucketKeyString(b: DupeBucket['key']): string {
  return [
    b.classType,
    b.armorSlot,
    b.archetype,
    b.tertiaryStat,
    b.armorSetHash ?? '',
    b.tuningStat ?? '',
  ].join('|');
}

/** Human-readable bucket identity: slot · archetype · tertiary stat. */
export function formatDupeBucketLabel(key: DupeBucket['key']): string {
  return `${SLOT_LABELS[key.armorSlot]} · ${ARCHETYPE_LABELS[key.archetype]} · ${STAT_LABELS[key.tertiaryStat]}`;
}

/** Compact primary line for bucket pickers: archetype · tertiary stat. */
export function dupeBucketPrimaryLine(key: DupeBucket['key']): string {
  return `${ARCHETYPE_LABELS[key.archetype]} · ${STAT_LABELS[key.tertiaryStat]}`;
}

/** Secondary line for bucket pickers: slot · item count. */
export function dupeBucketSecondaryLine(key: DupeBucket['key'], itemCount: number): string {
  const itemLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;
  return `${SLOT_LABELS[key.armorSlot]} · ${itemLabel}`;
}

export function findBucketByKey(
  buckets: DupeBucket[],
  keyStr: string,
): DupeBucket | undefined {
  return buckets.find((b) => bucketKeyString(b.key) === keyStr);
}

/** Tournament order: highest wantScore first as initial champion */
export function sortForTournament(items: ArmorPiece[]): ArmorPiece[] {
  return [...items].sort((a, b) => (b.wantScore ?? 0) - (a.wantScore ?? 0));
}

export function activeBucketItems(
  bucket: DupeBucket,
  excludedIds?: Set<string>,
): ArmorPiece[] {
  const excluded = excludedIds ?? new Set<string>();
  return bucket.items.filter((i) => !i.isIgnored && !excluded.has(i.instanceId));
}

/** Bucket still needs clean duels (≥2 eligible items after junk/keep-both exclusions). */
export function bucketHasDuelCandidates(
  bucket: DupeBucket,
  excludedIds?: Set<string>,
): boolean {
  return bucket.hasDupes && activeBucketItems(bucket, excludedIds).length >= 2;
}

export function findBucketKeyForInstanceIds(
  buckets: DupeBucket[],
  instanceIds: string[],
): DupeBucket['key'] | null {
  if (instanceIds.length === 0) return null;
  const idSet = new Set(instanceIds);
  for (const b of buckets) {
    if (b.items.some((i) => idSet.has(i.instanceId))) return b.key;
  }
  return null;
}

export function prioritizeQueueHead(duelQueue: string[], headKey: string | null): string[] {
  if (!headKey || duelQueue.length === 0) return duelQueue;
  if (duelQueue[0] === headKey) return duelQueue;
  return [headKey, ...duelQueue.filter((k) => k !== headKey)];
}

/** Duplicate buckets that still have ≥2 duel-eligible items for a class. */
export function duelableBucketsForClass(
  classType: ClassType,
  buckets: DupeBucket[],
  pendingTags: PendingTag[] = [],
): DupeBucket[] {
  const excluded = duelExcludedIds(
    [],
    [],
    pendingTags,
    buckets.flatMap((b) => b.items),
  );
  return sortBucketsForPicker(
    buckets.filter(
      (b) => b.key.classType === classType && bucketHasDuelCandidates(b, excluded),
    ),
  );
}

export function buildDuelQueueKeys(
  classType: ClassType,
  buckets: DupeBucket[],
  excludedIds?: Set<string>,
): string[] {
  return buckets
    .filter((b) => b.key.classType === classType && bucketHasDuelCandidates(b, excludedIds))
    .sort(
      (a, b) =>
        activeBucketItems(b, excludedIds).length - activeBucketItems(a, excludedIds).length,
    )
    .map((b) => bucketKeyString(b.key));
}

/** Find the bucket being cleaned when queue was lost but in-bucket progress remains. */
export function inferInProgressBucketKey(
  buckets: DupeBucket[],
  junkedIds: string[],
  keptBothIds: string[],
  eliminatedIds: string[] = [],
  keptSideIds: string[] = [],
): string | null {
  const progressIds = new Set([
    ...junkedIds,
    ...keptBothIds,
    ...keptSideIds,
    ...eliminatedIds,
  ]);
  if (progressIds.size === 0) return null;
  for (const bucket of buckets) {
    if (bucket.items.some((i) => progressIds.has(i.instanceId))) {
      return bucketKeyString(bucket.key);
    }
  }
  return null;
}

/** Rebuild queue keys after reload without dropping in-progress bucket work. */
export function rebuildDuelQueueKeys(
  classType: ClassType,
  buckets: DupeBucket[],
  completedBucketKeys: string[],
  currentQueue: string[],
  junkedIds: string[],
  keptBothIds: string[],
  pendingTags: PendingTag[] = [],
  eliminatedIds: string[] = [],
  keptSideIds: string[] = [],
): string[] {
  const done = new Set(completedBucketKeys);
  const excluded = duelExcludedIds(
    junkedIds,
    keptBothIds,
    pendingTags,
    buckets.flatMap((b) => b.items),
    eliminatedIds,
    keptSideIds,
  );
  let queue = buildDuelQueueKeys(classType, buckets, excluded).filter((k) => !done.has(k));

  const hasBucketProgress =
    junkedIds.length > 0 ||
    keptBothIds.length > 0 ||
    keptSideIds.length > 0 ||
    eliminatedIds.length > 0;
  if (!hasBucketProgress) {
    if (currentQueue.length > 0) {
      const valid = new Set(queue);
      const ordered = currentQueue.filter((k) => valid.has(k));
      const tail = queue.filter((k) => !ordered.includes(k));
      return [...ordered, ...tail];
    }
    return queue;
  }

  const head =
    (currentQueue[0] && findBucketByKey(buckets, currentQueue[0])
      ? currentQueue[0]
      : null) ?? inferInProgressBucketKey(buckets, junkedIds, keptBothIds, eliminatedIds, keptSideIds);

  if (head) {
    queue = [head, ...queue.filter((k) => k !== head)];
  }
  return queue;
}
