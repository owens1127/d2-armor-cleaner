import { i18n } from '@/i18n';
import { slotLabel } from '@/i18n/gameCopy';
import {
  RECOMMENDED_DESIRED_BUILD_COUNT,
  type CoverageAnalysis,
} from '@/lib/coverage/analyze';
import {
  getCalibrationChoiceCount,
  getCalibrationConfidence,
} from '@/lib/prefs/calibrationChoices';
import type { VaultInsightAction, CalibrationInsightContext } from '@/lib/dashboard/vaultInsightsActions';
import type { ClassPreferenceProfile, ClassType } from '@/types';

export function calibrationInsightCopy(
  prefs: ClassPreferenceProfile,
  ctx: CalibrationInsightContext,
  nowMs: number,
): Pick<VaultInsightAction, 'title' | 'detail' | 'cta' | 'tone'> {
  const choiceCount = getCalibrationChoiceCount(prefs);
  const confidence = getCalibrationConfidence(prefs);
  const stale =
    prefs.calibratedAt != null && nowMs - prefs.calibratedAt > 90 * 24 * 60 * 60 * 1000;

  if (!ctx.onboardingComplete) {
    return {
      title: i18n.t('dashboard:insights.continueSetup.title'),
      detail: i18n.t('dashboard:insights.continueSetup.detail'),
      cta: i18n.t('dashboard:insights.continueSetup.cta'),
      tone: 'accent',
    };
  }
  if (ctx.inProgressOnboarding) {
    return {
      title: i18n.t('dashboard:insights.continueCalibration.title'),
      detail: i18n.t('dashboard:insights.continueCalibration.detail'),
      cta: i18n.t('dashboard:insights.continueCalibration.cta'),
      tone: 'accent',
    };
  }
  if (choiceCount === 0) {
    return {
      title: i18n.t('dashboard:insights.calibratePreferences.title'),
      detail: i18n.t('dashboard:insights.calibratePreferences.detail'),
      cta: i18n.t('dashboard:insights.calibratePreferences.cta'),
      tone: 'accent',
    };
  }
  if (confidence === 'low') {
    return {
      title: i18n.t('dashboard:insights.completeCalibration.title'),
      detail: i18n.t('dashboard:insights.completeCalibration.detail'),
      cta: i18n.t('dashboard:insights.completeCalibration.cta'),
      tone: 'accent',
    };
  }
  if (confidence === 'medium') {
    return {
      title: i18n.t('dashboard:insights.improveCalibration.title'),
      detail: i18n.t('dashboard:insights.improveCalibration.detail'),
      cta: i18n.t('dashboard:insights.improveCalibration.cta'),
      tone: 'accent',
    };
  }
  if (stale) {
    return {
      title: i18n.t('dashboard:insights.recalibrateStale.title'),
      detail: i18n.t('dashboard:insights.recalibrateStale.detail'),
      cta: i18n.t('dashboard:insights.recalibrateStale.cta'),
      tone: 'default',
    };
  }
  return {
    title: i18n.t('dashboard:insights.recalibrateDefault.title'),
    detail: i18n.t('dashboard:insights.recalibrateDefault.detail'),
    cta: i18n.t('dashboard:insights.recalibrateDefault.cta'),
    tone: 'default',
  };
}

export function buildSetupAutoFiltersInsightActionCopy(): VaultInsightAction {
  return {
    id: 'setup-auto-filters',
    title: i18n.t('dashboard:insights.setupAutoFilters.title'),
    detail: i18n.t('dashboard:insights.setupAutoFilters.detail'),
    to: '/auto-filters',
    cta: i18n.t('dashboard:insights.setupAutoFilters.cta'),
    tone: 'accent',
  };
}

export function buildAddBuildsInsightActionCopy(
  enabledCount: number,
  _classType: ClassType,
  to: string,
): VaultInsightAction | null {
  if (enabledCount >= RECOMMENDED_DESIRED_BUILD_COUNT) return null;

  const remaining = RECOMMENDED_DESIRED_BUILD_COUNT - enabledCount;
  const countLabel = `${enabledCount} of ${RECOMMENDED_DESIRED_BUILD_COUNT}`;

  if (enabledCount === 0) {
    return {
      id: 'no-desired-builds',
      title: i18n.t('dashboard:insights.setupCombos.title'),
      detail: i18n.t('dashboard:insights.setupCombos.detail', { countLabel }),
      to,
      cta: i18n.t('dashboard:insights.setupCombos.cta'),
      tone: 'accent',
    };
  }

  return {
    id: 'add-desired-builds',
    title:
      remaining === 1
        ? i18n.t('dashboard:insights.addAnotherCombo.title')
        : i18n.t('dashboard:insights.addMoreCombos.title'),
    detail:
      remaining === 1
        ? i18n.t('dashboard:insights.addAnotherCombo.detail', { countLabel })
        : i18n.t('dashboard:insights.addMoreCombos.detail', { countLabel, remaining }),
    to,
    cta: i18n.t('dashboard:insights.addMoreCombos.cta'),
    tone: 'accent',
  };
}

export function fixCoverageDetailCopy(analysis: CoverageAnalysis): string {
  const { loadoutVerdict, recommendedLoadout, slotCoverage } = analysis;
  if (recommendedLoadout.slotsFilled === 0) {
    return i18n.t('dashboard:insights.fixCoverageNoVault');
  }
  const emptySlots = slotCoverage.filter((s) => !s.covered);
  if (emptySlots.length === 1) {
    return i18n.t('dashboard:insights.fixCoverageNeedSlot', {
        slot: slotLabel(emptySlots[0]!.slot).toLowerCase(),
    });
  }
  if (emptySlots.length > 1) {
    return i18n.t('dashboard:insights.fixCoverageSlots', {
      filled: loadoutVerdict.slotsFilled,
      total: loadoutVerdict.slotsTotal,
    });
  }
  return loadoutVerdict.summary;
}

export function browseBuildDetailCopy(analysis: CoverageAnalysis): string {
  if (analysis.supportingPieces === 0) {
    return i18n.t('dashboard:insights.browseNoArmor');
  }
  if (analysis.gaps.length > 0) {
    return i18n.t('dashboard:insights.browseGaps', { count: analysis.gaps.length });
  }
  return i18n.t('dashboard:insights.browseCompare');
}
