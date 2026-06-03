import { useMemo } from 'react';
import { groupIntoBuckets, dupeBucketCount, itemsToReview } from '@/lib/dupes/group';
import type { ClassType, DupeRuleConfig } from '@/types';
import { useVaultStore } from '@/stores';

interface DupeRulesImpactProps {
  rules: DupeRuleConfig;
  classType?: ClassType;
  className?: string;
  /** Plain copy for onboarding; default keeps compact stats line. */
  plainLanguage?: boolean;
}

export function DupeRulesImpact({
  rules,
  classType = 'hunter',
  className = '',
  plainLanguage = false,
}: DupeRulesImpactProps) {
  const classStates = useVaultStore((s) => s.classStates);
  const state = classStates[classType];

  const impact = useMemo(() => {
    if (!state) return null;
    const buckets = groupIntoBuckets(state.items, rules);
    return {
      buckets: dupeBucketCount(buckets),
      review: itemsToReview(buckets),
      pieces: state.items.filter((i) => (i.tier ?? 0) >= rules.minTier).length,
    };
  }, [state, rules]);

  if (!impact) {
    return <p className={`text-sm text-muted ${className}`}>Load vault to preview impact.</p>;
  }

  if (plainLanguage) {
    const classLabel = classType.charAt(0).toUpperCase() + classType.slice(1);
    const groupWord = impact.buckets === 1 ? 'group' : 'groups';
    const rollWord = impact.review === 1 ? 'roll' : 'rolls';
    const line =
      impact.buckets === 0
        ? `No duplicate groups for ${classLabel} at this tier.`
        : `About ${impact.buckets} duplicate ${groupWord} · roughly ${impact.review} ${rollWord} to compare`;
    return (
      <p className={`text-sm text-muted min-h-[2.75rem] leading-relaxed ${className}`}>
        {line}
      </p>
    );
  }

  return (
    <p className={`text-sm ${className}`}>
      <span className="text-white font-semibold">{impact.buckets}</span>
      <span className="text-muted"> dupe buckets · </span>
      <span className="text-white font-semibold">~{impact.review}</span>
      <span className="text-muted"> decisions · </span>
      <span className="text-muted">{impact.pieces} pieces included</span>
    </p>
  );
}
