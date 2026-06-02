import type { DupeRuleConfig } from '@/types';
import { DEFAULT_DUPE_RULES, DUPE_MIN_TIER_VALUES } from '@/lib/constants';

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

export function strictnessToPreset(strictness: number): string {
  if (strictness < 25) return 'loose';
  if (strictness < 50) return 'standard';
  if (strictness < 75) return 'setAware';
  if (strictness < 90) return 'tuning';
  return 'strict';
}
