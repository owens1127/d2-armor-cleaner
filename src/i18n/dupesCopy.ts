import { i18n } from '@/i18n';
import type { DupePresetId } from '@/lib/dupes/rules';
import type { DupeRuleConfig } from '@/types';

export type DupeGroupingToggleKey = 'sameArmorSet' | 'sameTuningStat';

export const DUPE_GROUPING_TOGGLE_KEYS: DupeGroupingToggleKey[] = [
  'sameArmorSet',
  'sameTuningStat',
];

export function dupePresetLabel(presetId: string): string {
  return i18n.t(`dupes:presets.${presetId}.label`, { defaultValue: presetId });
}

export function dupeGroupingToggleLabel(key: DupeGroupingToggleKey): string {
  return i18n.t(`dupes:grouping.${key}.label`);
}

export function dupeGroupingToggleHelp(key: DupeGroupingToggleKey): string {
  return i18n.t(`dupes:grouping.${key}.help`);
}

export function dupeRespectKeepFavoriteLabel(): string {
  return i18n.t('dupes:respectKeepFavorite.label');
}

export function dupeRespectKeepFavoriteHelp(): string {
  return i18n.t('dupes:respectKeepFavorite.help');
}

export function dupeExcludeJunkLabel(): string {
  return i18n.t('dupes:excludeJunk.label');
}

export function dupeMatchStyleLabelCopy(presetId: DupePresetId | null): string {
  if (!presetId) return i18n.t('dupes:matchStyle.custom');
  return dupePresetLabel(presetId);
}

export function dupeMatchStyleCardHeadlineCopy(label: string): string {
  if (label === i18n.t('dupes:matchStyle.custom')) {
    return i18n.t('dupes:matchStyle.usingCustomRules');
  }
  return i18n.t('dupes:matchStyle.usingPreset', { label });
}

export type DupeSuggestionReasonKey =
  | 'setAwareHeavy'
  | 'looseSmallVault'
  | 'ignoreTaggedKeep'
  | 'standardDefault';

export function dupeSuggestionReason(
  key: DupeSuggestionReasonKey,
  params?: Record<string, string | number>,
): string {
  return i18n.t(`dupes:suggestions.${key}`, params);
}

export function dupeMatchStyleCardBodyCopy(
  presetId: DupePresetId | null,
  rules: DupeRuleConfig,
): string {
  const body = presetId
    ? i18n.t(`dupes:matchStyle.cardBody.${presetId}`)
    : i18n.t('dupes:matchStyle.customMix', {
        armorSet: rules.sameArmorSet
          ? i18n.t('dupes:matchStyle.armorSetSame')
          : i18n.t('dupes:matchStyle.armorSetAny'),
        tuningStat: rules.sameTuningStat
          ? i18n.t('dupes:matchStyle.tuningStatSame')
          : i18n.t('dupes:matchStyle.tuningStatAny'),
      });
  const tagLine =
    !rules.ignoreTaggedKeep && !rules.ignoreTaggedFavorite
      ? i18n.t('dupes:matchStyle.dimTagsRespect')
      : i18n.t('dupes:matchStyle.dimTagsIgnore');
  return `${body} ${tagLine}`;
}
