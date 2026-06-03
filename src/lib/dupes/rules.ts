import type { DupeRuleConfig } from '@/types';
import { DEFAULT_DUPE_RULES, DUPE_MIN_TIER_VALUES, DUPE_PRESETS } from '@/lib/constants';

const PRESET_IDS = ['loose', 'standard', 'setAware', 'tuning', 'strict'] as const;
export type DupePresetId = (typeof PRESET_IDS)[number];

const PRESET_STRICTNESS: Record<DupePresetId, number> = {
  loose: 12,
  standard: 37,
  setAware: 62,
  tuning: 82,
  strict: 95,
};

const LEGACY_DUPE_RULE_KEYS = ['dupeModeBogOnMyDog', 'dupeModeMarruk'] as const;

function normalizeMinTier(value: unknown): number {
  const fallback = DEFAULT_DUPE_RULES.minTier;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < DUPE_MIN_TIER_VALUES[0] || rounded > DUPE_MIN_TIER_VALUES.at(-1)!) {
    return fallback;
  }
  return rounded;
}

export function mergeDupeRules(
  partial?: Partial<DupeRuleConfig> | DupeRuleConfig,
): DupeRuleConfig {
  if (!partial) return { ...DEFAULT_DUPE_RULES };
  const clean = { ...(partial as Record<string, unknown>) };
  for (const key of LEGACY_DUPE_RULE_KEYS) {
    delete clean[key];
  }
  const merged = { ...DEFAULT_DUPE_RULES, ...(clean as Partial<DupeRuleConfig>) };
  return { ...merged, minTier: normalizeMinTier(merged.minTier) };
}

export function strictnessToPreset(strictness: number): DupePresetId {
  if (strictness < 25) return 'loose';
  if (strictness < 50) return 'standard';
  if (strictness < 75) return 'setAware';
  if (strictness < 90) return 'tuning';
  return 'strict';
}

export function strictnessForPreset(presetId: string): number {
  if (PRESET_IDS.includes(presetId as DupePresetId)) {
    return PRESET_STRICTNESS[presetId as DupePresetId];
  }
  return PRESET_STRICTNESS.setAware;
}

function presetGroupingRules(rules: DupeRuleConfig): Pick<
  DupeRuleConfig,
  'sameArmorSet' | 'sameTuningStat' | 'ignoreTaggedKeep'
> {
  return {
    sameArmorSet: rules.sameArmorSet,
    sameTuningStat: rules.sameTuningStat,
    ignoreTaggedKeep: rules.ignoreTaggedKeep,
  };
}

/** User-facing label for current grouping rules (preset name or Custom). */
export function dupeMatchStyleLabel(rules: DupeRuleConfig): string {
  const presetId = presetIdForRules(rules);
  if (!presetId) return 'Custom';
  return DUPE_PRESETS[presetId]?.label ?? 'Custom';
}

function dimTagImpactLine(rules: DupeRuleConfig): string {
  const respectKeepFavorite =
    !rules.ignoreTaggedKeep && !rules.ignoreTaggedFavorite;
  return respectKeepFavorite
    ? 'DIM keep and favorite tags count when suggesting junk.'
    : 'Keep and favorite tags are not used when suggesting junk.';
}

const MATCH_STYLE_CARD_BODY: Record<DupePresetId, string> = {
  loose:
    'Compare pieces in the same slot without requiring the same armor set or tuning stat.',
  standard:
    'Compare by slot, archetype, and tertiary without requiring the same armor set.',
  setAware:
    'Groups duplicates by armor set · works well for most vaults.',
  tuning: 'Groups duplicates by tuning stat, even across different armor sets.',
  strict: 'Requires the same armor set and tuning stat for a duplicate match.',
};

/** Onboarding/settings card title for the active match style. */
export function dupeMatchStyleCardHeadline(rules: DupeRuleConfig): string {
  const label = dupeMatchStyleLabel(rules);
  if (label === 'Custom') return 'Using custom rules';
  return `Using ${label}`;
}

/** Short card description for the active match style. */
export function dupeMatchStyleCardDescription(rules: DupeRuleConfig): string {
  const presetId = presetIdForRules(rules);
  const body = presetId
    ? MATCH_STYLE_CARD_BODY[presetId]
    : `Custom mix: ${rules.sameArmorSet ? 'same armor set' : 'any armor set'}, ${
        rules.sameTuningStat ? 'same tuning stat' : 'any tuning stat'
      }.`;
  return `${body} ${dimTagImpactLine(rules)}`;
}

/** Preset id when rules match a built-in preset grouping; null for custom mixes. */
export function presetIdForRules(rules: DupeRuleConfig): DupePresetId | null {
  const grouping = presetGroupingRules(rules);
  for (const id of PRESET_IDS) {
    const partial = DUPE_PRESETS[id]?.rules;
    if (!partial) continue;
    const merged = mergeDupeRules(partial);
    if (
      merged.sameArmorSet === grouping.sameArmorSet &&
      merged.sameTuningStat === grouping.sameTuningStat &&
      merged.ignoreTaggedKeep === grouping.ignoreTaggedKeep
    ) {
      return id;
    }
  }
  return null;
}

/** Align slider with stored grouping rules when they match a preset. */
export function reconcileStrictnessWithRules(
  rules: DupeRuleConfig,
  strictness: number,
): number {
  const presetId = presetIdForRules(rules);
  if (!presetId) return strictness;
  const fromSlider = strictnessToPreset(strictness);
  if (presetId === fromSlider) return strictness;
  return strictnessForPreset(presetId);
}
