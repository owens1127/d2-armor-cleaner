import type { Archetype } from '@/types';
import { CALIBRATE_STEPS, type CalibrateStep } from './storage';

export function calibrationKeyStats(): string {
  return 'stats';
}

export function calibrationKeyArchetypeOrder(): string {
  return 'archetype';
}

export function calibrationKeySetOrder(): string {
  return 'sets';
}

export function calibrationKeyForRound(
  step: 'tertiary' | 'tuning',
  round: number,
  archetype?: Archetype,
): string {
  if (archetype) return `${step}:${archetype}:${round}`;
  return `${step}:${round}`;
}

export function removeCalibrationKey(keys: string[] | undefined, key: string): string[] {
  return (keys ?? []).filter((k) => k !== key);
}

/** Drop counted keys for the target step and everything after it (browser back / step rewind). */
export function trimCountedKeysForStep(
  keys: string[] | undefined,
  targetStep: CalibrateStep,
): string[] {
  const targetIdx = CALIBRATE_STEPS.indexOf(targetStep);
  return (keys ?? []).filter((key) => {
    if (key === 'stats') return targetIdx > CALIBRATE_STEPS.indexOf('stats');
    if (key === 'archetype' || key.startsWith('archetype:')) {
      return targetIdx > CALIBRATE_STEPS.indexOf('archetype');
    }
    if (key.startsWith('tertiary:')) return targetIdx > CALIBRATE_STEPS.indexOf('tertiary');
    if (key.startsWith('tuning:')) return targetIdx > CALIBRATE_STEPS.indexOf('tuning');
    if (key === 'sets' || key.startsWith('sets:')) {
      return targetIdx > CALIBRATE_STEPS.indexOf('sets');
    }
    return true;
  });
}

/** When rewinding to archetype ranking, drop later-step keys and the archetype choice. */
export function trimCountedKeysWhenReturningToArchetype(keys: string[] | undefined): string[] {
  const withoutLater = (keys ?? []).filter(
    (k) =>
      !k.startsWith('tertiary:') &&
      !k.startsWith('tuning:') &&
      !k.startsWith('sets:') &&
      k !== calibrationKeySetOrder(),
  );
  return removeCalibrationKey(withoutLater, calibrationKeyArchetypeOrder());
}
