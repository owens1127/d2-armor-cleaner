import { i18n } from '@/i18n';
import { statLabel } from '@/i18n/gameCopy';
import { OPTIMAL_ROLL_TERTIARY_BONUS, OPTIMAL_ROLL_TUNING_BONUS } from '@/lib/coverage/analyze';
import type { RollStatRole } from '@/lib/coverage/loadout';
import type { Stat } from '@/types';

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
