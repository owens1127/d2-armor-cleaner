import type { DupeRuleConfig } from '@/types';

/** Grouping toggles: checked means the stored flag is true (stricter matching). */
export const DUPE_GROUPING_TOGGLES = [
  {
    key: 'sameArmorSet' as const,
    label: 'Require same armor set',
    help: 'Only group or compare pieces from the same set. Off: same slot + archetype + tertiary across all sets.',
  },
  {
    key: 'sameTuningStat' as const,
    label: 'Require same tuning stat',
    help: 'Split by tuning stat (e.g. Weapons vs Grenade). Off: mixed tuning stats in one bucket.',
  },
] as const;

export const DUPE_RESPECT_KEEP_FAVORITE_LABEL =
  'Respect DIM keep and favorite when picking junk';

export const DUPE_RESPECT_KEEP_FAVORITE_HELP =
  'When on, keep- and favorite-tagged pieces are not suggested as junk in dupe flows.';

/** UI checked = respect tags; storage uses ignoreTaggedKeep (favorite follows on toggle). */
export function respectDimKeepFavoriteChecked(rules: DupeRuleConfig): boolean {
  return !rules.ignoreTaggedKeep;
}

export function respectDimKeepFavoritePatch(
  checked: boolean,
): Pick<DupeRuleConfig, 'ignoreTaggedKeep' | 'ignoreTaggedFavorite'> {
  return {
    ignoreTaggedKeep: !checked,
    ignoreTaggedFavorite: !checked,
  };
}

export const DUPE_EXCLUDE_JUNK_LABEL = 'Exclude junk-tagged pieces from dupe counts';
