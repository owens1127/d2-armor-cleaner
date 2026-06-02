import type { ArmorPiece, ClassType, PendingTag, TagValue } from '@/types';
import { rollProfileParts, type RollProfileParts } from '@/lib/armor/uniqueRoll';
import { LS_REVIEW_TAGS } from '@/lib/storage/keys';

const TAG_VALUES: TagValue[] = ['keep', 'junk', 'favorite', 'infuse', 'archive'];
const CLASS_TYPES: ClassType[] = ['titan', 'hunter', 'warlock'];

function isPendingTag(value: unknown): value is PendingTag {
  if (!value || typeof value !== 'object') return false;
  const t = value as PendingTag;
  return (
    typeof t.instanceId === 'string' &&
    t.instanceId.length > 0 &&
    (t.tag === null || TAG_VALUES.includes(t.tag)) &&
    typeof t.itemName === 'string' &&
    CLASS_TYPES.includes(t.classType)
  );
}

export function parseReviewTags(raw: string): PendingTag[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const tags = parsed.filter(isPendingTag);
    return tags;
  } catch {
    return null;
  }
}

export function loadReviewTags(): PendingTag[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(LS_REVIEW_TAGS);
  if (!raw) return [];
  return parseReviewTags(raw) ?? [];
}

export function saveReviewTags(tags: PendingTag[]): void {
  if (typeof localStorage === 'undefined') return;
  if (tags.length === 0) {
    localStorage.removeItem(LS_REVIEW_TAGS);
    return;
  }
  localStorage.setItem(LS_REVIEW_TAGS, JSON.stringify(tags));
}

export function clearReviewTags(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LS_REVIEW_TAGS);
}

/** Prefer durable localStorage; migrate from in-tab session blob when needed. */
export function hydrateReviewTags(sessionFallback?: PendingTag[]): PendingTag[] {
  const stored = loadReviewTags();
  if (stored.length > 0) return normalizePendingTags(stored);
  const fallback = sessionFallback?.filter(isPendingTag) ?? [];
  if (fallback.length > 0) {
    saveReviewTags(fallback);
    return normalizePendingTags(fallback);
  }
  return [];
}

export function pendingTagFromPiece(item: ArmorPiece, tag: TagValue): PendingTag {
  return {
    instanceId: item.instanceId,
    tag,
    itemName: item.name,
    classType: item.classType,
    archetype: item.archetype,
    tertiaryStat: item.tertiaryStat,
    tuningStat: item.tuningStat,
  };
}

/** Roll profile for a pending tag, using stored fields or live vault lookup. */
export function resolveTagRollProfile(
  tag: PendingTag,
  itemsById: Map<string, ArmorPiece>,
): RollProfileParts | null {
  if (tag.archetype && tag.tertiaryStat) {
    return rollProfileParts({
      archetype: tag.archetype,
      tertiaryStat: tag.tertiaryStat,
      tuningStat: tag.tuningStat,
    });
  }
  const piece = itemsById.get(tag.instanceId);
  return piece ? rollProfileParts(piece) : null;
}

/** One row per instance; later entries win (matches replace-on-retag). */
export function normalizePendingTags(tags: PendingTag[]): PendingTag[] {
  const byId = new Map<string, PendingTag>();
  for (const tag of tags) {
    byId.set(tag.instanceId, tag);
  }
  return [...byId.values()];
}

/** @deprecated Use normalizePendingTags */
export const dedupeReviewTags = normalizePendingTags;

export function dimTagMatchesPending(
  piece: Pick<ArmorPiece, 'dimTag' | 'dimFavorite'>,
  tag: TagValue | null,
): boolean {
  if (tag === null) {
    return piece.dimTag == null && !piece.dimFavorite;
  }
  if (tag === 'favorite') {
    return piece.dimFavorite || piece.dimTag === 'favorite';
  }
  return piece.dimTag === tag;
}

/** Drop pending rows already reflected in vault/DIM (e.g. after refresh or direct apply). */
export function reconcilePendingTagsWithVault(
  pending: PendingTag[],
  items: Iterable<Pick<ArmorPiece, 'instanceId' | 'dimTag' | 'dimFavorite'>>,
): PendingTag[] {
  const byId = new Map(
    [...items].map((item) => [item.instanceId, item] as const),
  );
  return normalizePendingTags(pending).filter((t) => {
    const piece = byId.get(t.instanceId);
    if (!piece) return true;
    return !dimTagMatchesPending(piece, t.tag);
  });
}
