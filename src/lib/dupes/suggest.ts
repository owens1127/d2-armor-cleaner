import type { ClassVaultState, DupeRuleConfig, DupeRuleSuggestion } from '@/types';
import { DUPE_PRESETS } from '@/lib/constants';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { loadPrefs } from '@/lib/prefs/storage';
import { vaultHeavyThreshold } from '@/lib/onboarding/inventorySnapshot';
import {
  groupIntoBuckets,
  computeVaultProfile,
  itemsToReview,
  dupeBucketCount,
} from '@/lib/dupes/group';

export function suggestDupeRules(
  classState: Pick<ClassVaultState, 'items' | 'classType'>,
): DupeRuleSuggestion[] {
  const suggestions: DupeRuleSuggestion[] = [];
  const presetIds = Object.keys(DUPE_PRESETS);

  const results = presetIds.map((presetId) => {
    const rules = mergeDupeRules(DUPE_PRESETS[presetId].rules);
    const buckets = groupIntoBuckets(classState.items, rules);
    return {
      presetId,
      rules,
      buckets,
      bucketCount: dupeBucketCount(buckets),
      reviewCount: itemsToReview(buckets),
    };
  });

  const standard = results.find((r) => r.presetId === 'standard')!;
  const profile = computeVaultProfile(classState.items, standard.buckets);
  const keepPref = loadPrefs().vaultKeepPreference;
  const { totalT5: heavyTotal, heavyBuckets: heavyBucketMin } = vaultHeavyThreshold(keepPref);

  if (profile.totalT5 > heavyTotal || profile.heavyBuckets >= heavyBucketMin) {
    const setAware = results.find((r) => r.presetId === 'setAware')!;
    suggestions.push({
      rule: 'preset',
      presetId: 'setAware',
      recommended: true,
      reason: `${profile.totalT5} Tier 5 pieces and ${profile.heavyBuckets} buckets with 5+ items. Use same armor set to avoid false dupes.`,
      impact: {
        buckets: setAware.bucketCount,
        itemsToReview: setAware.reviewCount,
      },
    });
  }

  if (profile.totalT5 < 50 && profile.heavyBuckets < 3) {
    suggestions.push({
      rule: 'preset',
      presetId: 'loose',
      recommended: true,
      reason: 'Small vault: loose rules will surface more duplicate buckets.',
      impact: {
        buckets: results.find((r) => r.presetId === 'loose')!.bucketCount,
        itemsToReview: results.find((r) => r.presetId === 'loose')!.reviewCount,
      },
    });
  }

  if (profile.taggedKeepInDupes > 0) {
    suggestions.push({
      rule: 'ignoreTaggedKeep',
      recommended: true,
      reason: `${profile.taggedKeepInDupes} dupe candidates already tagged keep or favorite in DIM.`,
      impact: {
        buckets: standard.bucketCount,
        itemsToReview: standard.reviewCount,
      },
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      rule: 'preset',
      presetId: 'standard',
      recommended: true,
      reason: 'Standard preset for your vault size.',
      impact: {
        buckets: standard.bucketCount,
        itemsToReview: standard.reviewCount,
      },
    });
  }

  return suggestions;
}

export function buildClassVaultState(
  classType: ClassVaultState['classType'],
  items: ClassVaultState['items'],
  rules?: DupeRuleConfig,
): ClassVaultState {
  const activeDupeRules = rules ?? mergeDupeRules();
  const classItems = items.filter((i) => i.classType === classType);
  const buckets = groupIntoBuckets(classItems, activeDupeRules);
  const profile = computeVaultProfile(classItems, buckets);
  profile.dupeBucketCount = Object.fromEntries(
    Object.keys(DUPE_PRESETS).map((id) => {
      const r = mergeDupeRules(DUPE_PRESETS[id].rules);
      const b = groupIntoBuckets(classItems, r);
      return [id, dupeBucketCount(b)];
    }),
  );

  const partial = { classType, items: classItems };
  return {
    classType,
    items: classItems,
    buckets,
    profile,
    ruleSuggestions: suggestDupeRules(partial),
    activeDupeRules,
    lastScannedAt: Date.now(),
  };
}
