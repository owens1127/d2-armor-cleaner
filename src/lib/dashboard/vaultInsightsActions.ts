import { i18n } from '@/i18n';
import {
  browseBuildDetailCopy,
  buildAddBuildsInsightActionCopy,
  buildSetupAutoFiltersInsightActionCopy,
  calibrationInsightCopy,
  fixCoverageDetailCopy,
} from '@/i18n/dashboardCopy';
import { countDashboardItems, dashboardDupeBuckets } from '@/lib/dashboard/items';
import { bucketKeyString, formatDupeBucketLabel } from '@/lib/dupes/queue';
import {
  getDesiredBuilds,
  RECOMMENDED_DESIRED_BUILD_COUNT,
  type CoverageAnalysis,
} from '@/lib/coverage/analyze';
import { getCachedDesiredBuildAnalyses } from '@/lib/coverage/vaultComputeCache';
import {
  buildCalibratePath,
  getCalibrateNavPath,
  hasInProgressOnboarding,
  isOnboardingComplete,
  loadOnboardingProgress,
} from '@/lib/onboarding/storage';
import { browseRedundantPath, combosPagePath, desiredBuildsEditorPath } from '@/lib/nav';
import { buildCleanPath } from '@/lib/session/cleanUrl';
import type {
  ArmorPiece,
  AutoFilterRule,
  ClassPreferenceProfile,
  ClassType,
  ClassVaultState,
  DupeBucket,
  PendingTag,
} from '@/types';

export interface VaultInsightAction {
  id: string;
  title: string;
  detail: string;
  to: string;
  cta: string;
  tone?: 'default' | 'danger' | 'accent';
}

const MAX_FIX_COVERAGE_ACTIONS = 2;
const MAX_BROWSE_BUILD_ACTIONS = 1;
/** Recalibrate nudge when last calibration is older than this. */
export const STALE_CALIBRATION_MS = 90 * 24 * 60 * 60 * 1000;

export interface CalibrationInsightContext {
  onboardingComplete: boolean;
  inProgressOnboarding: boolean;
}

export function getCalibrationInsightContext(): CalibrationInsightContext {
  return {
    onboardingComplete: isOnboardingComplete(),
    inProgressOnboarding: hasInProgressOnboarding(),
  };
}

export function calibrationInsightPath(
  classType: ClassType,
  ctx: CalibrationInsightContext,
): string {
  if (!ctx.onboardingComplete || ctx.inProgressOnboarding) {
    const progress = loadOnboardingProgress();
    if (ctx.inProgressOnboarding && progress?.phase === 'calibrate') {
      return buildCalibratePath(progress.calibrate);
    }
    return getCalibrateNavPath(classType);
  }
  return `/onboarding/calibrate?class=${classType}`;
}

export function buildCalibrationInsightAction(
  prefs: ClassPreferenceProfile,
  classType: ClassType,
  ctx: CalibrationInsightContext,
  nowMs = Date.now(),
): VaultInsightAction {
  const copy = calibrationInsightCopy(prefs, ctx, nowMs);
  return {
    id: 'calibration',
    ...copy,
    to: calibrationInsightPath(classType, ctx),
  };
}

export function desiredBuildsNudgeNeeded(
  prefs: ClassPreferenceProfile,
  classType: ClassType,
): boolean {
  return getDesiredBuilds(prefs, classType).length < RECOMMENDED_DESIRED_BUILD_COUNT;
}

/** True when at least one auto-filter rule is enabled (vault triage on load). */
export function hasConfiguredAutoFilters(rules: AutoFilterRule[] | undefined): boolean {
  return (rules ?? []).some((rule) => rule.enabled);
}

export function buildSetupAutoFiltersInsightAction(): VaultInsightAction {
  return buildSetupAutoFiltersInsightActionCopy();
}

export function buildAddBuildsInsightAction(
  enabledCount: number,
  classType: ClassType,
): VaultInsightAction | null {
  return buildAddBuildsInsightActionCopy(
    enabledCount,
    classType,
    desiredBuildsEditorPath(classType),
  );
}

export function buildCoverageNeedsFix(analysis: CoverageAnalysis): boolean {
  return !analysis.buildReady;
}

export function buildBrowseRecommended(analysis: CoverageAnalysis): boolean {
  if (analysis.buildReady) return false;
  return analysis.gaps.length > 0 || analysis.supportingPieces === 0;
}


function coverageFixPriority(analysis: CoverageAnalysis): number {
  const { loadoutVerdict } = analysis;
  const emptySlots = loadoutVerdict.slotsTotal - loadoutVerdict.slotsFilled;
  return emptySlots * 10 + (analysis.buildReady ? 0 : 5);
}

function browseBuildPriority(analysis: CoverageAnalysis): number {
  return (
    analysis.gaps.length * 10 +
    (analysis.loadoutVerdict.slotsTotal - analysis.loadoutVerdict.slotsFilled) * 5 +
    (analysis.supportingPieces === 0 ? 20 : 0)
  );
}

export function buildCoverageAndBrowseInsightActions(
  items: ArmorPiece[],
  buckets: DupeBucket[],
  prefs: ClassPreferenceProfile,
  classType: ClassType,
): VaultInsightAction[] {
  const actions: VaultInsightAction[] = [];
  const analyses = getCachedDesiredBuildAnalyses(items, buckets, prefs, classType);
  const fixCandidates = analyses
    .filter(buildCoverageNeedsFix)
    .sort((a, b) => coverageFixPriority(b) - coverageFixPriority(a))
    .slice(0, MAX_FIX_COVERAGE_ACTIONS);
  const fixCandidateBuildIds = new Set(
    fixCandidates.map((analysis) => analysis.build.desiredBuildId ?? analysis.build.id),
  );

  for (const analysis of fixCandidates) {
    const buildId = analysis.build.desiredBuildId ?? analysis.build.id;
    actions.push({
      id: `fix-coverage-${buildId}`,
      title: i18n.t('dashboard:insights.fixCoverage.title', { label: analysis.build.label }),
      detail: fixCoverageDetailCopy(analysis),
      to: combosPagePath(classType, { buildId }),
      cta: i18n.t('dashboard:insights.fixCoverage.cta'),
      tone: 'accent',
    });
  }

  const browseCandidates = analyses
    .filter(buildBrowseRecommended)
    .filter((analysis) => {
      const buildId = analysis.build.desiredBuildId ?? analysis.build.id;
      return !fixCandidateBuildIds.has(buildId);
    })
    .sort((a, b) => browseBuildPriority(b) - browseBuildPriority(a))
    .slice(0, MAX_BROWSE_BUILD_ACTIONS);

  for (const analysis of browseCandidates) {
    const buildId = analysis.build.desiredBuildId ?? analysis.build.id;
    actions.push({
      id: `browse-build-${buildId}`,
      title: i18n.t('dashboard:insights.browseUpgrades.title', { label: analysis.build.label }),
      detail: browseBuildDetailCopy(analysis),
      to: `/browse/${classType}?build=${encodeURIComponent(buildId)}`,
      cta: i18n.t('dashboard:insights.browseUpgrades.cta'),
    });
  }

  return actions;
}

export function buildBuildInsightActions(
  items: ArmorPiece[],
  buckets: DupeBucket[],
  prefs: ClassPreferenceProfile,
  classType: ClassType,
  autoFilterRules?: AutoFilterRule[],
): VaultInsightAction[] {
  const actions: VaultInsightAction[] = [];
  const enabledBuildCount = getDesiredBuilds(prefs, classType).length;
  const addBuildsAction = buildAddBuildsInsightAction(enabledBuildCount, classType);
  if (addBuildsAction) {
    actions.push(addBuildsAction);
  }
  if (!hasConfiguredAutoFilters(autoFilterRules)) {
    actions.push(buildSetupAutoFiltersInsightAction());
  }
  actions.push(...buildCoverageAndBrowseInsightActions(items, buckets, prefs, classType));
  return actions;
}

export function buildVaultInsightActions(input: {
  classState: ClassVaultState;
  classType: ClassType;
  prefs: ClassPreferenceProfile;
  redundantRollCount: number;
  pendingTags: PendingTag[];
  bucketJunkedIds: string[];
  autoFilterRules?: AutoFilterRule[];
  /** Test hook: avoid reading onboarding flags from localStorage. */
  calibrationContext?: CalibrationInsightContext;
}): VaultInsightAction[] {
  const {
    classState,
    classType,
    prefs,
    redundantRollCount,
    pendingTags,
    bucketJunkedIds,
    autoFilterRules,
    calibrationContext,
  } = input;
  const { profile, buckets } = classState;
  const dupeBuckets = dashboardDupeBuckets(buckets, pendingTags, bucketJunkedIds);
  const largestBucket = dupeBuckets.reduce<(typeof dupeBuckets)[number] | null>(
    (best, b) => {
      const count = countDashboardItems(b.items, pendingTags, bucketJunkedIds);
      const bestCount = best
        ? countDashboardItems(best.items, pendingTags, bucketJunkedIds)
        : 0;
      return count > bestCount ? b : best;
    },
    null,
  );
  const largest =
    largestBucket && countDashboardItems(largestBucket.items, pendingTags, bucketJunkedIds) >= 2
      ? {
          key: largestBucket.key,
          count: countDashboardItems(largestBucket.items, pendingTags, bucketJunkedIds),
        }
      : null;

  const calibrationAction = buildCalibrationInsightAction(
    prefs,
    classType,
    calibrationContext ?? getCalibrationInsightContext(),
  );

  const actions: VaultInsightAction[] = [];

  if (largest) {
    actions.push({
      id: 'largest-dupe',
      title: i18n.t('dashboard:insights.compareLargest.title', {
        label: formatDupeBucketLabel(largest.key),
      }),
      detail: i18n.t('dashboard:insights.compareLargest.detail', { count: largest.count }),
      to: buildCleanPath(classType, { bucketKey: bucketKeyString(largest.key) }),
      cta: i18n.t('dashboard:insights.compareLargest.cta'),
      tone: 'accent',
    });
  }

  if (redundantRollCount > 0) {
    actions.push({
      id: 'redundant-rolls',
      title: i18n.t('dashboard:insights.redundantRolls.title'),
      detail: i18n.t('dashboard:insights.redundantRolls.detail', { count: redundantRollCount }),
      to: browseRedundantPath(classType),
      cta: i18n.t('dashboard:insights.redundantRolls.cta'),
      tone: 'danger',
    });
  }

  actions.push(
    ...buildBuildInsightActions(
      classState.items,
      classState.buckets,
      prefs,
      classType,
      autoFilterRules,
    ),
  );

  if (profile.taggedKeepInDupes > 0) {
    actions.push({
      id: 'tagged-keep',
      title: i18n.t('dashboard:insights.taggedKeep.title'),
      detail: i18n.t('dashboard:insights.taggedKeep.detail', { count: profile.taggedKeepInDupes }),
      to: `/browse/${classType}`,
      cta: i18n.t('dashboard:insights.taggedKeep.cta'),
    });
  }

  if (profile.heavyBuckets > 0 && !largest) {
    actions.push({
      id: 'heavy-buckets',
      title: i18n.t('dashboard:insights.heavyBuckets.title'),
      detail: i18n.t('dashboard:insights.heavyBuckets.detail', { count: profile.heavyBuckets }),
      to: buildCleanPath(classType),
      cta: i18n.t('dashboard:insights.heavyBuckets.cta'),
      tone: 'accent',
    });
  }

  actions.push(calibrationAction);

  return actions;
}
