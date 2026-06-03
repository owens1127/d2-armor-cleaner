import { describe, expect, it } from 'vitest';
import { DUPE_PRESETS } from '@/lib/constants';
import {
  mergeDupeRules,
  presetIdForRules,
  reconcileStrictnessWithRules,
  strictnessForPreset,
  strictnessToPreset,
} from './rules';
import { respectDimKeepFavoritePatch } from './ruleUi';

describe('dupe preset strictness sync', () => {
  it('maps each preset rules to its preset id', () => {
    for (const [id, { rules }] of Object.entries(DUPE_PRESETS)) {
      const merged = mergeDupeRules(rules);
      expect(presetIdForRules(merged)).toBe(id);
    }
  });

  it('round-trips strictness through preset ids', () => {
    for (const id of Object.keys(DUPE_PRESETS)) {
      const strictness = strictnessForPreset(id);
      expect(strictnessToPreset(strictness)).toBe(id);
    }
  });

  it('reconciles slider when stored strictness disagrees with rules', () => {
    const loose = mergeDupeRules(DUPE_PRESETS.loose.rules);
    expect(reconcileStrictnessWithRules(loose, 50)).toBe(strictnessForPreset('loose'));
    const setAware = mergeDupeRules(DUPE_PRESETS.setAware.rules);
    expect(reconcileStrictnessWithRules(setAware, 12)).toBe(strictnessForPreset('setAware'));
  });

  it('returns null for custom grouping mixes', () => {
    const custom = mergeDupeRules({
      sameArmorSet: true,
      sameTuningStat: true,
      ignoreTaggedKeep: false,
    });
    expect(presetIdForRules(custom)).toBeNull();
  });
});

describe('dupe rule respect toggle (UI vs storage)', () => {
  it('maps respect checked to ignoreTaggedKeep without inverting', () => {
    expect(respectDimKeepFavoritePatch(true)).toEqual({
      ignoreTaggedKeep: false,
      ignoreTaggedFavorite: false,
    });
    expect(respectDimKeepFavoritePatch(false)).toEqual({
      ignoreTaggedKeep: true,
      ignoreTaggedFavorite: true,
    });
  });
});
