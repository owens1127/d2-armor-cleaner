import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LS_ONBOARDING } from '@/lib/storage/keys';
import {
  clearOnboardingProgress,
  getCalibrateInitialState,
  markRulesAccepted,
  saveCalibrateProgress,
  defaultCalibrateProgress,
} from '@/lib/onboarding/storage';

describe('calibration shortcut flow', () => {
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  beforeEach(() => {
    localStore.clear();
    sessionStore.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStore.set(key, value);
      },
      removeItem: (key: string) => {
        localStore.delete(key);
      },
      clear: () => localStore.clear(),
    });
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionStore.set(key, value);
      },
      removeItem: (key: string) => {
        sessionStore.delete(key);
      },
      clear: () => sessionStore.clear(),
    });
    clearOnboardingProgress();
  });

  it('starts recalibration at class step with selected class', () => {
    localStore.set(LS_ONBOARDING, 'true');
    const progress = getCalibrateInitialState({ urlClass: 'titan' });
    expect(progress.step).toBe('class');
    expect(progress.calibrateClass).toBe('titan');
  });

  it('keeps onboarding resume behavior for in-progress sessions', () => {
    markRulesAccepted();
    saveCalibrateProgress({
      ...defaultCalibrateProgress(),
      step: 'class',
      calibrateClass: 'hunter',
    });
    const progress = getCalibrateInitialState({ urlClass: 'warlock' });
    expect(progress.step).toBe('class');
    expect(progress.calibrateClass).toBe('warlock');
  });
});
