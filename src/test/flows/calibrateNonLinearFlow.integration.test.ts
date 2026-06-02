import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCalibrateProgress,
  getCalibrateInitialState,
  getCalibrateNavPath,
  getOnboardingResumePath,
  hasInProgressOnboarding,
  isOnboardingComplete,
  markInventoryComplete,
  markOnboardingComplete,
  markRulesAccepted,
  resetCalibrateProgressAfterCompletion,
  saveCalibrateProgress,
  type CalibrateProgress,
} from '@/lib/onboarding/storage';
import { mergeCalibrateProgressFromUrl } from '@/lib/onboarding/calibrateUrl';
import { LS_ONBOARDING, LS_ONBOARDING_PROGRESS, SS_CALIBRATE_SESSION } from '@/lib/storage/keys';

describe('calibration non-linear navigation flow', () => {
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
  });

  it('jumps from early step to later step while preserving in-progress state', () => {
    const progress: CalibrateProgress = {
      ...defaultCalibrateProgress(),
      step: 'stats',
      statOrder: ['super', 'weapons', 'health', 'class', 'melee', 'grenade'],
      archetypeOrder: ['gunner', 'brawler', 'grenadier', 'paragon', 'bulwark', 'specialist'],
      completedSteps: ['class'],
    };

    const jumped = mergeCalibrateProgressFromUrl(progress, { step: 'sets' });
    expect(jumped.step).toBe('sets');
    expect(jumped.statOrder).toEqual(progress.statOrder);
    expect(jumped.archetypeOrder).toEqual(progress.archetypeOrder);
  });

  it('supports repeated backward and forward jumps without losing progress data', () => {
    const base: CalibrateProgress = {
      ...defaultCalibrateProgress(),
      step: 'tuning',
      tertiaryOrderByArchetype: {
        gunner: ['weapons', 'super', 'health'],
      },
      tuningOrderByArchetype: { gunner: ['weapons', 'super', 'health'] },
      setOrder: [101, 202, 303],
      completedSteps: ['class', 'stats', 'archetype', 'tertiary'],
    };

    const toStats = mergeCalibrateProgressFromUrl(base, { step: 'stats' });
    const toSets = mergeCalibrateProgressFromUrl(toStats, { step: 'sets' });
    const backToTuning = mergeCalibrateProgressFromUrl(toSets, { step: 'tuning' });

    expect(backToTuning.step).toBe('tuning');
    expect(backToTuning.tertiaryOrderByArchetype.gunner).toEqual(['weapons', 'super', 'health']);
    expect(backToTuning.tuningOrderByArchetype.gunner).toEqual(['weapons', 'super', 'health']);
    expect(backToTuning.setOrder).toEqual([101, 202, 303]);
  });

  it('keeps per-archetype tertiary ordering while navigating tertiary rounds', () => {
    const base: CalibrateProgress = {
      ...defaultCalibrateProgress(),
      step: 'tertiary',
      tertiaryArchetypeIndex: 1,
      tertiaryOrderByArchetype: {
        gunner: ['weapons', 'super', 'health'],
        paragon: ['super', 'health', 'weapons'],
      },
      completedSteps: ['class', 'stats', 'archetype'],
    };

    const toArchetype = mergeCalibrateProgressFromUrl(base, { step: 'archetype' });
    const backToTertiary = mergeCalibrateProgressFromUrl(toArchetype, { step: 'tertiary' });

    expect(backToTertiary.step).toBe('tertiary');
    expect(backToTertiary.tertiaryArchetypeIndex).toBe(1);
    expect(backToTertiary.tertiaryOrderByArchetype.gunner).toEqual([
      'weapons',
      'super',
      'health',
    ]);
    expect(backToTertiary.tertiaryOrderByArchetype.paragon).toEqual([
      'super',
      'health',
      'weapons',
    ]);
  });

  it('resets calibration pointers after final dashboard completion path', () => {
    localStore.set(LS_ONBOARDING, 'true');
    localStore.set(LS_ONBOARDING_PROGRESS, '{"phase":"calibrate","calibrate":{"step":"sets"}}');
    sessionStore.set(SS_CALIBRATE_SESSION, '{"step":"sets"}');

    resetCalibrateProgressAfterCompletion();

    expect(localStore.get(LS_ONBOARDING_PROGRESS)).toBeUndefined();
    expect(sessionStore.get(SS_CALIBRATE_SESSION)).toBeUndefined();

    const nextRun = getCalibrateInitialState({ urlClass: 'hunter' });
    expect(nextRun.step).toBe('class');
  });

  it('restores sets step from URL after onboarding is complete', () => {
    markOnboardingComplete();
    const params = new URLSearchParams('step=sets&class=hunter');
    const state = getCalibrateInitialState({ urlClass: 'hunter', searchParams: params });
    expect(state.step).toBe('sets');
    expect(state.calibrateClass).toBe('hunter');
  });

  it('markOnboardingComplete clears sets-step progress and resumes at dashboard', () => {
    markRulesAccepted();
    markInventoryComplete('balanced');
    saveCalibrateProgress({
      ...defaultCalibrateProgress(),
      step: 'sets',
      setOrder: [101, 202],
      completedSteps: ['class', 'stats', 'archetype', 'tertiary', 'tuning'],
    });

    markOnboardingComplete();

    expect(isOnboardingComplete()).toBe(true);
    expect(hasInProgressOnboarding()).toBe(false);
    expect(localStore.get(LS_ONBOARDING_PROGRESS)).toBeUndefined();
    expect(getOnboardingResumePath(true)).toBe('/dashboard/hunter');
    expect(getCalibrateNavPath('hunter')).toBe('/onboarding/calibrate?class=hunter');

    const nextVoluntaryVisit = getCalibrateInitialState({ urlClass: 'hunter' });
    expect(nextVoluntaryVisit.step).toBe('class');
  });
});
