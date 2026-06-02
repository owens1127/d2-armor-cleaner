import type { ClassType } from '@/types';
import {
  CALIBRATE_STEPS,
  defaultCalibrateProgress,
  type CalibrateProgress,
  type CalibrateStep,
} from './storage';

const CLASS_VALUES: ClassType[] = ['titan', 'hunter', 'warlock'];
const ROUND_STEPS: CalibrateStep[] = ['tertiary', 'tuning'];

function isCalibrateStep(value: string): value is CalibrateStep {
  return CALIBRATE_STEPS.includes(value as CalibrateStep);
}

function isClassType(value: string): value is ClassType {
  return CLASS_VALUES.includes(value as ClassType);
}

/** Round index (0-based) for the active calibrate step. */
export function getRoundForStep(progress: CalibrateProgress): number {
  switch (progress.step) {
    case 'tertiary':
      return progress.tertiaryRound;
    case 'tuning':
      return progress.tuningRound;
    default:
      return 0;
  }
}

/** Apply a 0-based round index to the field that matches `step`. */
export function roundOverridesForStep(
  step: CalibrateStep,
  round: number,
): Partial<CalibrateProgress> {
  switch (step) {
    case 'tertiary':
      return { tertiaryRound: round };
    case 'tuning':
      return { tuningRound: round };
    default:
      return {};
  }
}

/** Trim completedSteps when navigating back via URL/history. */
export function completedStepsBeforeStep(
  step: CalibrateStep,
  existing: CalibrateStep[],
): CalibrateStep[] {
  const maxIdx = CALIBRATE_STEPS.indexOf(step);
  return existing.filter((s) => CALIBRATE_STEPS.indexOf(s) < maxIdx);
}

/**
 * Parse calibrate URL search params.
 *
 * Schema:
 * - `step`: class|stats|archetype|tertiary|tuning|sets
 * - `class`: titan|hunter|warlock (when past class step, or preselect on class step)
 * - `round`: 1-based round for tertiary|tuning pairwise steps
 */
export function parseCalibrateSearchParams(
  params: URLSearchParams,
): Partial<CalibrateProgress> | null {
  const stepParam = params.get('step');
  const classParam = params.get('class');

  if (!stepParam) {
    if (classParam && isClassType(classParam)) {
      return { calibrateClass: classParam };
    }
    return null;
  }

  if (!isCalibrateStep(stepParam)) return null;

  const partial: Partial<CalibrateProgress> = { step: stepParam };

  if (classParam && isClassType(classParam)) {
    partial.calibrateClass = classParam;
  }

  if (ROUND_STEPS.includes(stepParam)) {
    const roundParam = params.get('round');
    if (roundParam !== null) {
      const round = Number.parseInt(roundParam, 10);
      if (Number.isFinite(round) && round >= 1) {
        Object.assign(partial, roundOverridesForStep(stepParam, round - 1));
      }
    }
  }

  return partial;
}

/** Build URL search params from calibrate progress (readable, minimal). */
export function buildCalibrateSearchParams(progress: CalibrateProgress): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = defaultCalibrateProgress();

  if (progress.step !== 'class') {
    params.set('step', progress.step);
    params.set('class', progress.calibrateClass);

    if (ROUND_STEPS.includes(progress.step)) {
      params.set('round', String(getRoundForStep(progress) + 1));
    }
  } else if (progress.calibrateClass !== defaults.calibrateClass) {
    params.set('class', progress.calibrateClass);
  }

  return params;
}

export function searchParamsMatchProgress(
  params: URLSearchParams,
  progress: CalibrateProgress,
): boolean {
  return buildCalibrateSearchParams(progress).toString() === params.toString();
}

/** Merge URL overrides onto a base progress object (localStorage / defaults). URL wins for step/class/rounds. */
export function mergeCalibrateProgressFromUrl(
  base: CalibrateProgress,
  urlPartial: Partial<CalibrateProgress> | null,
): CalibrateProgress {
  if (!urlPartial) return base;

  const merged: CalibrateProgress = {
    ...base,
    ...urlPartial,
  };

  if (urlPartial.step && urlPartial.step !== base.step) {
    merged.completedSteps = completedStepsBeforeStep(urlPartial.step, base.completedSteps);
  }

  return merged;
}

/** Resume / navigate path including query when mid-calibrate. */
export function buildCalibratePath(progress?: CalibrateProgress | null): string {
  if (!progress || progress.step === 'class') {
    const params = progress ? buildCalibrateSearchParams(progress) : new URLSearchParams();
    const qs = params.toString();
    return qs ? `/onboarding/calibrate?${qs}` : '/onboarding/calibrate';
  }
  const qs = buildCalibrateSearchParams(progress).toString();
  return `/onboarding/calibrate?${qs}`;
}
