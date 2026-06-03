import { useMemo } from 'react';
import { classLabel } from '@/i18n/gameCopy';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['vault', 'rulesOnboarding', 'dupes']);
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
    return <p className={`text-sm text-muted ${className}`}>{t('vault:dupeRulesImpact')}</p>;
  }

  if (plainLanguage) {
    const classDisplayName = classLabel(classType);
    const line =
      impact.buckets === 0
        ? t('rulesOnboarding:impact.none', { class: classDisplayName })
        : t('rulesOnboarding:impact.summary', {
            buckets: impact.buckets,
            review: impact.review,
            class: classDisplayName,
            groupWord: t('rulesOnboarding:impact.group', { count: impact.buckets }),
            rollWord: t('rulesOnboarding:impact.roll', { count: impact.review }),
          });
    return (
      <p className={`text-sm text-muted min-h-[2.75rem] leading-relaxed ${className}`}>
        {line}
      </p>
    );
  }

  return (
    <p className={`text-sm ${className}`}>
      <span className="text-white font-semibold">{impact.buckets}</span>
      <span className="text-muted"> {t('dupes:impactCompact.buckets')} </span>
      <span className="text-white font-semibold">~{impact.review}</span>
      <span className="text-muted"> {t('dupes:impactCompact.decisions')} </span>
      <span className="text-muted">
        {t('dupes:impactCompact.pieces', { count: impact.pieces })}
      </span>
    </p>
  );
}
