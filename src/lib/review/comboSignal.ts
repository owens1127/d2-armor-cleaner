import type { BuildOptimalLookup } from '@/lib/coverage/buildOptimal';
import type { ArmorPiece, ClassType, PendingTag } from '@/types';

export interface ReviewComboSignal {
  count: number;
  title: string;
  variant: 'default' | 'sole';
}

export function buildReviewComboSignalMap(
  reviewTags: readonly PendingTag[],
  itemsById: ReadonlyMap<string, ArmorPiece>,
  buildOptimalLookups: ReadonlyMap<ClassType, BuildOptimalLookup>,
): Map<string, ReviewComboSignal> {
  const signalMap = new Map<string, ReviewComboSignal>();
  for (const tag of reviewTags) {
    const item = itemsById.get(tag.instanceId);
    const lookup = buildOptimalLookups.get(tag.classType);
    if (!lookup) continue;
    const rollIdentity =
      tag.archetype && tag.tertiaryStat
        ? {
            archetype: tag.archetype,
            tertiaryStat: tag.tertiaryStat,
            tuningStat: tag.tuningStat,
          }
        : item;
    if (!rollIdentity) continue;
    const count = lookup.buildCount(rollIdentity);
    if (count <= 0) continue;
    signalMap.set(tag.instanceId, {
      count,
      title:
        lookup.tooltip(rollIdentity) ??
        (count === 1 ? 'Optimal for 1 combo' : `Optimal for ${count} combos`),
      variant: lookup.indicatorVariant(tag.instanceId),
    });
  }
  return signalMap;
}
