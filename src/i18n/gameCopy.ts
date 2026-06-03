import { i18n } from '@/i18n';
import type { Archetype, ArmorSlot, ClassType, Stat } from '@/types';

export function classLabel(classType: ClassType): string {
  return i18n.t(`game:classes.${classType}`);
}

export function statLabel(stat: Stat): string {
  return i18n.t(`game:stats.${stat}`);
}

export function archetypeLabel(archetype: Archetype): string {
  return i18n.t(`game:archetypes.${archetype}`);
}

export function slotLabel(slot: ArmorSlot): string {
  return i18n.t(`game:slots.${slot}`);
}

export function gameLabelSeparator(): string {
  return i18n.t('game:labels.separator');
}

export function formatArchetypeStatsLabel(archetype: Archetype): string {
  const [primary, secondary] = (
    {
      gunner: ['weapons', 'grenade'],
      grenadier: ['grenade', 'super'],
      paragon: ['super', 'melee'],
      brawler: ['melee', 'health'],
      bulwark: ['health', 'class'],
      specialist: ['class', 'weapons'],
    } as const satisfies Record<Archetype, readonly [Stat, Stat]>
  )[archetype];
  return `${statLabel(primary)}${gameLabelSeparator()}${statLabel(secondary)}`;
}

export function formatArchetypeTertiaryLabel(archetype: Archetype, tertiary: Stat): string {
  return `${archetypeLabel(archetype)}${gameLabelSeparator()}${statLabel(tertiary)}`;
}

export function rollTuningInlineLabel(stat: Stat): string {
  return i18n.t('game:roll.tuningLabel', { stat: statLabel(stat) });
}

export function armorDiffSetFootnoteCopy(name: string): string {
  return i18n.t('game:diff.setFootnote', { name });
}

export function armorDiffLabelCopy(key: string): string {
  const map: Record<string, string> = {
    'Same stat split': 'game:armorDiff.sameStatSplit',
    'Same stats & tuning': 'game:armorDiff.sameStatsTuning',
    'Same roll': 'game:armorDiff.sameRoll',
    'Decide by set or tuning': 'game:armorDiff.decideSetOrTuning',
    'Decide by tuning': 'game:armorDiff.decideTuning',
    'Decide by set': 'game:armorDiff.decideSet',
    'Same everything except power/location': 'game:armorDiff.sameExceptPower',
    'Identical roll. Pick either one.': 'game:armorDiff.identicalRoll',
  };
  return i18n.t(map[key] ?? key, { defaultValue: key });
}

export function armorDiffLineLabelCopy(label: string): string {
  const map: Record<string, string> = {
    Tuning: 'game:diff.tuning',
    Set: 'game:diff.set',
    Power: 'game:diff.power',
    Masterwork: 'game:diff.masterwork',
  };
  const key = map[label];
  return key ? i18n.t(key as 'game:diff.tuning') : label;
}

export function dominatorHeaderCopy(
  reason: 'stat-lower' | 'tuning-equivalent',
  statSplit: boolean,
): string {
  if (statSplit) return i18n.t('game:dominator.differentStatSplit');
  return reason === 'tuning-equivalent'
    ? i18n.t('game:dominator.sameAfterTuning')
    : i18n.t('game:dominator.beatsPiece');
}

export function dominatorCaptionLabelCopy(
  reason: 'stat-lower' | 'tuning-equivalent',
  tuningMutual: boolean,
  statSplit: boolean,
): string {
  if (statSplit) return i18n.t('game:dominator.statComparison');
  if (reason === 'tuning-equivalent') {
    return tuningMutual
      ? i18n.t('game:dominator.tuningCoverage')
      : i18n.t('game:dominator.aheadOn');
  }
  return i18n.t('game:dominator.statComparison');
}

export function dominatorEveryTuningLayoutCopy(): string {
  return i18n.t('game:dominator.everyTuningLayout');
}

export function heatmapMixedTuningTitleCopy(): string {
  return i18n.t('game:heatmap.mixedTuning');
}

export function armorDiffNoSetCopy(): string {
  return i18n.t('game:diff.noSet');
}

export function armorDiffYesNoCopy(yes: boolean): string {
  return yes ? i18n.t('game:diff.yes') : i18n.t('game:diff.no');
}

export function armorDiffTuningVsCopy(a: string, b: string): string {
  return i18n.t('game:diff.tuningVs', { a, b });
}
