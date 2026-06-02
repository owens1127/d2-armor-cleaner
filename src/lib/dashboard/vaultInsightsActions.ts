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
import {
  getCalibrationChoiceCount,
  getCalibrationConfidence,
} from '@/lib/prefs/calibrationChoices';
import { combosPagePath, desiredBuildsEditorPath } from '@/lib/nav';
import { buildCleanPath } from '@/lib/session/cleanUrl';
import { SLOT_LABELS } from '@/lib/constants';
import type {
  ArmorPiece,
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

function isCalibrationStale(prefs: ClassPreferenceProfile, nowMs: number): boolean {
  if (prefs.calibratedAt == null) return false;
  return nowMs - prefs.calibratedAt > STALE_CALIBRATION_MS;
}

function calibrationInsightCopy(
  prefs: ClassPreferenceProfile,
  ctx: CalibrationInsightContext,
  nowMs: number,
): { title: string; detail: string; cta: string; tone: VaultInsightAction['tone'] } {
  const choiceCount = getCalibrationChoiceCount(prefs);
  const confidence = getCalibrationConfidence(prefs);
  const stale = isCalibrationStale(prefs, nowMs);

  if (!ctx.onboardingComplete) {
    return {
      title: 'Continue setup',
      detail: 'Finish calibration so vault suggestions match your priorities',
      cta: 'Continue',
      tone: 'accent',
    };
  }
  if (ctx.inProgressOnboarding) {
    return {
      title: 'Continue calibration',
      detail: 'Pick up where you left off in preference calibration',
      cta: 'Continue',
      tone: 'accent',
    };
  }
  if (choiceCount === 0) {
    return {
      title: 'Calibrate preferences',
      detail: 'Teach stat, archetype, and set priorities for this class',
      cta: 'Calibrate',
      tone: 'accent',
    };
  }
  if (confidence === 'low') {
    return {
      title: 'Complete calibration',
      detail: 'Low confidence · a few more picks sharpen dupe and combo suggestions',
      cta: 'Calibrate',
      tone: 'accent',
    };
  }
  if (confidence === 'medium') {
    return {
      title: 'Improve calibration',
      detail: 'Medium confidence · more picks improve ranking and coverage hints',
      cta: 'Calibrate',
      tone: 'accent',
    };
  }
  if (stale) {
    return {
      title: 'Recalibrate preferences',
      detail: 'Your last calibration was a while ago · vault rolls may have shifted',
      cta: 'Recalibrate',
      tone: 'default',
    };
  }
  return {
    title: 'Recalibrate preferences',
    detail: 'Update stat, archetype, and set weights for this class anytime',
    cta: 'Recalibrate',
    tone: 'default',
  };
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

export function buildAddBuildsInsightAction(
  enabledCount: number,
  classType: ClassType,
): VaultInsightAction | null {
  if (enabledCount >= RECOMMENDED_DESIRED_BUILD_COUNT) return null;

  const remaining = RECOMMENDED_DESIRED_BUILD_COUNT - enabledCount;
  const countLabel = `${enabledCount} of ${RECOMMENDED_DESIRED_BUILD_COUNT}`;
  const to = desiredBuildsEditorPath(classType);

  if (enabledCount === 0) {
    return {
      id: 'no-desired-builds',
      title: 'Set up combos',
      detail: `Pick 2–4 priority stats per combo · ${countLabel}`,
      to,
      cta: 'Set up combos',
      tone: 'accent',
    };
  }

  return {
    id: 'add-desired-builds',
    title: remaining === 1 ? 'Add another combo' : 'Add more combos',
    detail:
      remaining === 1
        ? `${countLabel} combos · add 1 more`
        : `${countLabel} · add ${remaining} more combos`,
    to,
    cta: 'Add combos',
    tone: 'accent',
  };
}

export function buildCoverageNeedsFix(analysis: CoverageAnalysis): boolean {
  return !analysis.buildReady;
}

export function buildBrowseRecommended(analysis: CoverageAnalysis): boolean {
  if (analysis.buildReady) return false;
  return analysis.gaps.length > 0 || analysis.supportingPieces === 0;
}

function fixCoverageDetail(analysis: CoverageAnalysis): string {
  const { loadoutVerdict, recommendedLoadout, slotCoverage } = analysis;
  if (recommendedLoadout.slotsFilled === 0) {
    return 'No vault pieces roll your priority stats yet';
  }
  const emptySlots = slotCoverage.filter((s) => !s.covered);
  if (emptySlots.length === 1) {
    return `Need a ${SLOT_LABELS[emptySlots[0].slot].toLowerCase()} that rolls your priorities`;
  }
  if (emptySlots.length > 1) {
    return `${loadoutVerdict.slotsFilled}/${loadoutVerdict.slotsTotal} slots filled in recommended loadout`;
  }
  return loadoutVerdict.summary;
}

function browseBuildDetail(analysis: CoverageAnalysis): string {
  if (analysis.supportingPieces === 0) {
    return 'No armor in your vault rolls these stats yet';
  }
  if (analysis.gaps.length > 0) {
    return `${analysis.gaps.length} roll ${analysis.gaps.length === 1 ? 'type' : 'types'} to hunt for better fit`;
  }
  return 'Compare vault armor against your combos';
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

export function buildBuildInsightActions(
  items: ArmorPiece[],
  buckets: DupeBucket[],
  prefs: ClassPreferenceProfile,
  classType: ClassType,
): VaultInsightAction[] {
  const actions: VaultInsightAction[] = [];
  const enabledBuildCount = getDesiredBuilds(prefs, classType).length;
  const addBuildsAction = buildAddBuildsInsightAction(enabledBuildCount, classType);
  if (addBuildsAction) {
    actions.push(addBuildsAction);
  }

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
      title: `Fix ${analysis.build.label} coverage`,
      detail: fixCoverageDetail(analysis),
      to: combosPagePath(classType, { buildId }),
      cta: 'Open Combos',
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
      title: `Browse upgrades for ${analysis.build.label}`,
      detail: browseBuildDetail(analysis),
      to: `/browse/${classType}?build=${encodeURIComponent(buildId)}`,
      cta: 'Browse vault',
    });
  }

  return actions;
}

export function buildVaultInsightActions(input: {
  classState: ClassVaultState;
  classType: ClassType;
  prefs: ClassPreferenceProfile;
  redundantRollCount: number;
  pendingTags: PendingTag[];
  bucketJunkedIds: string[];
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

  const actions: VaultInsightAction[] = [
    buildCalibrationInsightAction(
      prefs,
      classType,
      calibrationContext ?? getCalibrationInsightContext(),
    ),
  ];

  if (largest) {
    actions.push({
      id: 'largest-dupe',
      title: `Compare ${formatDupeBucketLabel(largest.key)}`,
      detail: `${largest.count} pieces in your largest dupe bucket`,
      to: buildCleanPath(classType, { bucketKey: bucketKeyString(largest.key) }),
      cta: 'Compare this group',
      tone: 'accent',
    });
  }

  if (redundantRollCount > 0) {
    actions.push({
      id: 'redundant-rolls',
      title: 'Review redundant rolls',
      detail: `${redundantRollCount} piece${redundantRollCount === 1 ? '' : 's'} strictly worse than another roll you keep`,
      to: `/dismantle/${classType}`,
      cta: 'Open list',
      tone: 'danger',
    });
  }

  actions.push(
    ...buildBuildInsightActions(classState.items, classState.buckets, prefs, classType),
  );

  if (profile.taggedKeepInDupes > 0) {
    actions.push({
      id: 'tagged-keep',
      title: 'Review DIM-tagged dupes',
      detail: `${profile.taggedKeepInDupes} dupe candidate${profile.taggedKeepInDupes === 1 ? '' : 's'} already tagged keep or favorite in DIM`,
      to: `/browse/${classType}`,
      cta: 'Browse vault',
    });
  }

  if (profile.heavyBuckets > 0 && !largest) {
    actions.push({
      id: 'heavy-buckets',
      title: 'Clear heavy dupe buckets',
      detail: `${profile.heavyBuckets} bucket${profile.heavyBuckets === 1 ? '' : 's'} with 5+ items. Use the heatmap to pick one.`,
      to: buildCleanPath(classType),
      cta: 'Compare duplicates',
      tone: 'accent',
    });
  }

  return actions;
}
