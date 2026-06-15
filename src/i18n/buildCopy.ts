import { i18n } from '@/i18n';
import { archetypeLabel, statLabel } from '@/i18n/gameCopy';
import { OPTIMAL_ROLL_TERTIARY_BONUS, OPTIMAL_ROLL_TUNING_BONUS } from '@/lib/coverage/analyze';
import type { RollStatRole } from '@/lib/coverage/loadout';
import type { Archetype, Stat } from '@/types';

export function coverageGapDetailCopy(buildStatHits: number, targetCount: number): string {
  if (buildStatHits >= targetCount) return i18n.t('build:coverage.gapAllPriorities');
  if (buildStatHits >= 2) return i18n.t('build:coverage.gapMultiplePriorities');
  return i18n.t('build:coverage.gapOnePriority');
}

export function rollStatRoleLabelCopy(role: RollStatRole): string {
  if (role === 'combined') return i18n.t('build:coverage.rollRoleCombined');
  if (role === 'tertiary') return i18n.t('build:coverage.rollRoleTertiary');
  return i18n.t('build:coverage.rollRoleTuning');
}

export function rollTuningStatLabelCopy(stat: Stat): string {
  return i18n.t('game:roll.tuning', { stat: statLabel(stat) });
}

export function rollTertiaryStatLabelCopy(stat: Stat): string {
  return i18n.t('game:roll.tertiary', { stat: statLabel(stat) });
}

export function rollAnyTertiaryLabelCopy(): string {
  return i18n.t('build:coverage.rollRoleAnyTertiary');
}

export function patternColumnTitlePartsCopy(
  archetype: Archetype | null,
  tertiaryStat: Stat | null,
  tuningStat: Stat,
): { lead: string; tertiary?: string; tuning: string } {
  const tuning = rollTuningStatLabelCopy(tuningStat);
  const lead =
    archetype === null
      ? i18n.t('build:coverage.anyArchetype')
      : archetypeLabel(archetype);

  if (tertiaryStat === null) {
    return {
      lead,
      tertiary: rollAnyTertiaryLabelCopy(),
      tuning,
    };
  }
  if (tertiaryStat !== tuningStat) {
    return {
      lead,
      tertiary: rollTertiaryStatLabelCopy(tertiaryStat),
      tuning,
    };
  }
  return { lead, tuning };
}

/** Collapsed set-row card title: shared archetype name, or any archetype when mixed. */
export function patternCollapsedSetRowTitleCopy(archetype: Archetype | null): string {
  if (archetype === null) {
    return i18n.t('build:coverage.anyArchetype');
  }
  return archetypeLabel(archetype);
}

export function rollStatRoleTitleCopy(stat: Stat, role: RollStatRole): string {
  if (role === 'combined') {
    return i18n.t('build:coverage.rollCombinedTitle', {
      stat: statLabel(stat),
      tertiaryBonus: OPTIMAL_ROLL_TERTIARY_BONUS,
      tuningBonus: OPTIMAL_ROLL_TUNING_BONUS,
    });
  }
  if (role === 'tertiary') {
    return i18n.t('build:coverage.rollTertiaryTitle', {
      stat: statLabel(stat),
      bonus: OPTIMAL_ROLL_TERTIARY_BONUS,
    });
  }
  return i18n.t('build:coverage.rollTuningTitle', {
    stat: statLabel(stat),
    bonus: OPTIMAL_ROLL_TUNING_BONUS,
  });
}
