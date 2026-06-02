import type { TagValue } from '@/types';

/** Non-favorite DIM tags shown alongside the heart when both are present. */
export type DimPrimaryTag = Exclude<TagValue, 'favorite'>;

export interface DimItemTagState {
  /** keep / junk / infuse / archive — never `favorite`. */
  dimTag: DimPrimaryTag | null;
  dimFavorite: boolean;
}

export const DIM_TAG_VALUES: TagValue[] = [
  'favorite',
  'keep',
  'junk',
  'infuse',
  'archive',
];

const TAG_VALUE_SET = new Set<string>(DIM_TAG_VALUES);

export function isTagValue(value: unknown): value is TagValue {
  return typeof value === 'string' && TAG_VALUE_SET.has(value);
}

/** Split a raw DIM Sync tag into overlay favorite + primary tag (DIM allows one stored tag). */
export function parseDimItemTag(raw: unknown): DimItemTagState {
  if (!isTagValue(raw)) {
    return { dimTag: null, dimFavorite: false };
  }
  if (raw === 'favorite') {
    return { dimTag: null, dimFavorite: true };
  }
  return { dimTag: raw, dimFavorite: false };
}

export interface DimTagAnnotation {
  id?: string;
  tag?: unknown;
}

export function parseDimTagsFromAnnotations(
  annotations: DimTagAnnotation[] | undefined,
): Record<string, DimItemTagState> {
  const tags: Record<string, DimItemTagState> = {};
  for (const ann of annotations ?? []) {
    if (ann.id) tags[ann.id] = parseDimItemTag(ann.tag);
  }
  return tags;
}

/** Migrate legacy caches that stored `favorite` inside `dimTag`. */
export function normalizeLegacyDimTagMap(
  legacy: Record<string, TagValue | null | undefined>,
): Record<string, DimItemTagState> {
  const out: Record<string, DimItemTagState> = {};
  for (const [id, tag] of Object.entries(legacy)) {
    out[id] = parseDimItemTag(tag);
  }
  return out;
}

export function armorHasDimFavorite(
  item: Pick<{ dimTag?: TagValue | null; dimFavorite?: boolean }, 'dimTag' | 'dimFavorite'>,
): boolean {
  return Boolean(item.dimFavorite || item.dimTag === 'favorite');
}

export function armorIsDimKeepOrFavorite(
  item: Pick<{ dimTag?: TagValue | null; dimFavorite?: boolean }, 'dimTag' | 'dimFavorite'>,
): boolean {
  return armorHasDimFavorite(item) || item.dimTag === 'keep';
}
