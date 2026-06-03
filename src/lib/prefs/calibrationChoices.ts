import { trimCountedKeysForStep } from '@/lib/onboarding/calibrateSession';
import type { CalibrateStep } from '@/lib/onboarding/storage';
import type { CalibrationChoice, ClassPreferenceProfile, Confidence } from '@/types';

export function getCalibrationChoiceCount(prefs: ClassPreferenceProfile): number {
  return Object.keys(prefs.calibrationChoices).length;
}

export function getCalibrationConfidence(prefs: ClassPreferenceProfile): Confidence {
  const count = getCalibrationChoiceCount(prefs);
  if (count >= 15) return 'high';
  if (count >= 5) return 'medium';
  return 'low';
}

export function hasCalibrationChoice(prefs: ClassPreferenceProfile, key: string): boolean {
  return key in prefs.calibrationChoices;
}

/** Upsert a calibration choice by key: re-picking the same round replaces the prior entry. */
export function recordCalibrationChoice(
  prefs: ClassPreferenceProfile,
  key: string,
): ClassPreferenceProfile {
  return {
    ...prefs,
    calibrationChoices: {
      ...prefs.calibrationChoices,
      [key]: { key, recordedAt: Date.now() },
    },
    calibratedAt: Date.now(),
  };
}

/** Keep only choices whose keys survive step-based trimming (browser back / step rewind). */
export function trimCalibrationChoicesForStep(
  prefs: ClassPreferenceProfile,
  targetStep: CalibrateStep,
): ClassPreferenceProfile {
  const keys = Object.keys(prefs.calibrationChoices);
  const kept = new Set(trimCountedKeysForStep(keys, targetStep));
  const calibrationChoices: Record<string, CalibrationChoice> = {};
  for (const key of kept) {
    calibrationChoices[key] = prefs.calibrationChoices[key];
  }
  return { ...prefs, calibrationChoices };
}

export function syncCalibrationChoicesToKeys(
  prefs: ClassPreferenceProfile,
  keys: string[],
): ClassPreferenceProfile {
  const kept = new Set(keys);
  const calibrationChoices: Record<string, CalibrationChoice> = {};
  for (const key of kept) {
    if (prefs.calibrationChoices[key]) {
      calibrationChoices[key] = prefs.calibrationChoices[key];
    }
  }
  return { ...prefs, calibrationChoices };
}

export function normalizeCalibrationChoices(raw: unknown): Record<string, CalibrationChoice> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const result: Record<string, CalibrationChoice> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key) continue;
    if (value && typeof value === 'object' && 'key' in value) {
      const choice = value as Partial<CalibrationChoice>;
      if (typeof choice.key === 'string') {
        result[key] = {
          key: choice.key,
          recordedAt:
            typeof choice.recordedAt === 'number' ? choice.recordedAt : Date.now(),
        };
      }
    } else {
      result[key] = { key, recordedAt: Date.now() };
    }
  }
  return result;
}
