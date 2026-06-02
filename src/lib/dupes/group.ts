import type {
  ArmorPiece,
  DupeBucket,
  DupeBucketKey,
  DupeRuleConfig,
  VaultProfile,
  ClassType,
  ArmorSlot,
} from '@/types';
import { ARMOR_SLOTS } from '@/lib/constants';
import { armorHasDimFavorite, armorIsDimKeepOrFavorite } from '@/lib/dim/parseTags';

export function isIgnoredByDupeRules(item: ArmorPiece, rules: DupeRuleConfig): boolean {
  if (armorHasDimFavorite(item)) return rules.ignoreTaggedFavorite;
  if (!item.dimTag) return false;
  const map: Record<string, boolean> = {
    infuse: rules.ignoreTaggedInfuse,
    junk: rules.ignoreTaggedJunk,
    keep: rules.ignoreTaggedKeep,
    archive: rules.ignoreTaggedArchive,
  };
  return map[item.dimTag] ?? false;
}

export function bucketKeyForItem(
  item: ArmorPiece,
  rules: DupeRuleConfig,
): string {
  const parts: string[] = [
    item.classType,
    item.armorSlot,
    item.archetype,
    item.tertiaryStat,
  ];
  if (rules.sameArmorSet) parts.push(String(item.armorSet?.hash ?? 0));
  if (rules.sameTuningStat) parts.push(String(item.tuningStat ?? 'none'));
  return parts.join('|');
}

function parseBucketKey(keyStr: string): DupeBucketKey {
  const parts = keyStr.split('|');
  const key: DupeBucketKey = {
    classType: parts[0] as ClassType,
    armorSlot: parts[1] as ArmorSlot,
    archetype: parts[2] as DupeBucketKey['archetype'],
    tertiaryStat: parts[3] as DupeBucketKey['tertiaryStat'],
  };
  if (parts.length > 4 && parts[4] !== '0') key.armorSetHash = Number(parts[4]);
  if (parts.length > 5 && parts[5] !== 'none')
    key.tuningStat = parts[5] as DupeBucketKey['tertiaryStat'];
  return key;
}

function isDupePair(
  a: ArmorPiece,
  b: ArmorPiece,
  rules: DupeRuleConfig,
): boolean {
  if (a.instanceId === b.instanceId) return false;
  if (a.classType !== b.classType) return false;
  if (a.armorSlot !== b.armorSlot) return false;
  if (a.archetype !== b.archetype) return false;
  if (a.tertiaryStat !== b.tertiaryStat) return false;

  if (rules.sameArmorSet && a.armorSet?.hash !== b.armorSet?.hash) return false;

  if (rules.sameTuningStat && a.tuningStat !== b.tuningStat) return false;

  if (
    rules.filterArmorSetHashes.length > 0 &&
    a.armorSet &&
    !rules.filterArmorSetHashes.includes(a.armorSet.hash)
  ) {
    return false;
  }

  return true;
}

export function applyIgnoreFlags(
  items: ArmorPiece[],
  rules: DupeRuleConfig,
): ArmorPiece[] {
  return items.map((item) => ({
    ...item,
    isIgnored: isIgnoredByDupeRules(item, rules),
  }));
}

export function markDupes(
  items: ArmorPiece[],
  rules: DupeRuleConfig,
): ArmorPiece[] {
  const withIgnore = applyIgnoreFlags(items, rules);
  return withIgnore.map((item) => {
    if (item.isIgnored) return { ...item, isDupe: false };
    const hasDupe = withIgnore.some(
      (other) =>
        !other.isIgnored &&
        other.instanceId !== item.instanceId &&
        isDupePair(item, other, rules),
    );
    return { ...item, isDupe: hasDupe };
  });
}

export function groupIntoBuckets(
  items: ArmorPiece[],
  rules: DupeRuleConfig,
): DupeBucket[] {
  const filtered = items.filter((i) => (i.tier ?? 0) >= rules.minTier);
  const marked = markDupes(filtered, rules);
  const map = new Map<string, ArmorPiece[]>();

  for (const item of marked) {
    const key = bucketKeyForItem(item, rules);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  return [...map.entries()].map(([keyStr, bucketItems]) => {
    const active = bucketItems.filter((i) => !i.isIgnored);
    return {
      key: parseBucketKey(keyStr),
      items: bucketItems.sort(
        (a, b) =>
          (a.isDupe ? 0 : 1) - (b.isDupe ? 0 : 1) ||
          (a.isIgnored ? 1 : 0) - (b.isIgnored ? 1 : 0) ||
          (b.tier ?? 0) - (a.tier ?? 0) ||
          b.power - a.power,
      ),
      hasDupes: active.length >= 2,
    };
  });
}

export function computeVaultProfile(
  items: ArmorPiece[],
  buckets: DupeBucket[],
): VaultProfile {
  const t5 = items.filter((i) => (i.tier ?? 0) >= 5);
  const dupeBuckets = buckets.filter((b) => b.hasDupes);
  const heavyBuckets = dupeBuckets.filter(
    (b) => b.items.filter((i) => !i.isIgnored).length >= 5,
  ).length;

  const largest = dupeBuckets.reduce<DupeBucket | null>(
    (best, b) => {
      const count = b.items.filter((i) => !i.isIgnored).length;
      const bestCount = best
        ? best.items.filter((i) => !i.isIgnored).length
        : 0;
      return count > bestCount ? b : best;
    },
    null,
  );

  const totalBySlot = Object.fromEntries(
    ARMOR_SLOTS.map((slot) => [
      slot,
      t5.filter((i) => i.armorSlot === slot).length,
    ]),
  ) as Record<ArmorSlot, number>;

  return {
    totalT5: t5.length,
    totalBySlot,
    dupeBucketCount: {},
    heavyBuckets,
    taggedKeepInDupes: dupeBuckets.reduce(
      (n, b) =>
        n + b.items.filter((i) => armorIsDimKeepOrFavorite(i)).length,
      0,
    ),
    uniqueBucketRatio: buckets.length > 0 ? t5.length / buckets.length : 1,
    largestBucket: largest
      ? {
          key: largest.key,
          count: largest.items.filter((i) => !i.isIgnored).length,
        }
      : null,
  };
}

export function itemsToReview(buckets: DupeBucket[]): number {
  return buckets
    .filter((b) => b.hasDupes)
    .reduce((sum, b) => {
      const active = b.items.filter((i) => !i.isIgnored).length;
      return sum + Math.max(0, active - 1);
    }, 0);
}

export function dupeBucketCount(buckets: DupeBucket[]): number {
  return buckets.filter((b) => b.hasDupes).length;
}
