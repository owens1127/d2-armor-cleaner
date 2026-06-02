import { useMemo } from 'react';
import { groupIntoBuckets, dupeBucketCount, itemsToReview } from '@/lib/dupes/group';
import type { ClassType, DupeRuleConfig } from '@/types';
import { useVaultStore } from '@/stores';

interface DupeRulesImpactProps {
  rules: DupeRuleConfig;
  classType?: ClassType;
  className?: string;
}

export function DupeRulesImpact({
  rules,
  classType = 'hunter',
  className = '',
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
