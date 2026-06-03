import type { DupeRuleConfig } from '@/types';

export {
  DUPE_GROUPING_TOGGLE_KEYS,
  dupeExcludeJunkLabel,
  dupeGroupingToggleHelp,
  dupeGroupingToggleLabel,
  dupeRespectKeepFavoriteHelp,
  dupeRespectKeepFavoriteLabel,
} from '@/i18n/dupesCopy';
export type { DupeGroupingToggleKey } from '@/i18n/dupesCopy';

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
