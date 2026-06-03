import { i18n } from '@/i18n';
import { classLabel, statLabel, archetypeLabel, slotLabel } from '@/i18n/gameCopy';
import { getCriterionValues } from '@/lib/auto-filter/match';
import type { AutoFilterMatchMode, AutoFilterRule } from '@/types';

function describeCriterion(labels: string[], mode: AutoFilterMatchMode | undefined): string {
  if (labels.length === 0) return '';
  const m = mode ?? 'is';
  if (m === 'anyOf') {
    return i18n.t('autoFilters:describe.anyOf', { labels: labels.join(', ') });
  }
  if (m === 'noneOf') {
    return i18n.t('autoFilters:describe.noneOf', { labels: labels.join(', ') });
  }
  if (m === 'not') {
    return i18n.t('autoFilters:describe.not', { label: labels[0] });
  }
  return labels[0];
}

export function describeAutoFilterRule(
  rule: AutoFilterRule,
  setNames?: ReadonlyMap<number, string>,
): string {
  if (rule.name?.trim()) return rule.name.trim();
  const parts: string[] = [];
  parts.push(
    rule.classType === 'all'
      ? i18n.t('autoFilters:describe.allClasses')
      : classLabel(rule.classType),
  );
  const archetypeValues = getCriterionValues(rule.archetype, rule.archetypes);
  if (archetypeValues?.length) {
    parts.push(
      describeCriterion(
        archetypeValues.map((value) => archetypeLabel(value)),
        rule.archetypeMatchMode,
      ),
    );
  }
  const tertiaryValues = getCriterionValues(rule.tertiaryStat, rule.tertiaryStats);
  if (tertiaryValues?.length) {
    parts.push(
      describeCriterion(
        tertiaryValues.map((value) =>
          i18n.t('autoFilters:describe.tertiary', { stat: statLabel(value) }),
        ),
        rule.tertiaryStatMatchMode,
      ),
    );
  }
  const tuningValues = getCriterionValues(rule.tuningStat, rule.tuningStats);
  if (tuningValues?.length) {
    parts.push(
      describeCriterion(
        tuningValues.map((value) =>
          i18n.t('autoFilters:describe.tuning', { stat: statLabel(value) }),
        ),
        rule.tuningStatMatchMode,
      ),
    );
  }
  const slotValues = getCriterionValues(rule.armorSlot, rule.armorSlots);
  if (slotValues?.length) {
    parts.push(
      describeCriterion(
        slotValues.map((value) => slotLabel(value)),
        rule.armorSlotMatchMode,
      ),
    );
  }
  const setValues = getCriterionValues(rule.armorSetHash, rule.armorSetHashes);
  if (setValues?.length) {
    parts.push(
      describeCriterion(
        setValues.map((hash) => setNames?.get(hash) ?? i18n.t('autoFilters:describe.setFallback', { hash })),
        rule.armorSetHashMatchMode,
      ),
    );
  }
  return parts.join(' · ');
}
