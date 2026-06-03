import { ARCHETYPES, STATS } from '@/lib/constants';
import {
  buildCalibratePath,
  mergeCalibrateProgressFromUrl,
  parseCalibrateSearchParams,
} from '@/lib/onboarding/calibrateUrl';

import {
  LS_ONBOARDING,
  LS_ONBOARDING_PROGRESS,
  SS_CALIBRATE_SESSION,
} from '@/lib/storage/keys';

import type { Archetype, ClassType, Stat, VaultKeepPreference } from '@/types';

export type OnboardingPhase = 'rules' | 'inventory' | 'calibrate';

export type CalibrateStep = 'class' | 'archetype' | 'tertiary' | 'tuning' | 'sets';

export const CALIBRATE_STEPS: CalibrateStep[] = [
  'class',
  'archetype',
  'tertiary',
  'tuning',
  'sets',
];

export interface PairwisePick {
  winner: string;
  loser: string;
}

export interface PairwiseTie {
  tie: true;
  a: string;
  b: string;
}

export type PairwiseDecision = PairwisePick | PairwiseTie;

export interface PairwiseDecisionLog {
  archetype: PairwiseDecision[];
  /** Per-archetype tertiary pairwise decisions. */
  tertiaryByArchetype: Partial<Record<Archetype, PairwiseDecision[]>>;
  /** Per-archetype tuning pairwise decisions. */
  tuningByArchetype: Partial<Record<Archetype, PairwiseDecision[]>>;
  sets: PairwiseDecision[];
}

export interface CalibrateProgress {
  step: CalibrateStep;
  calibrateClass: ClassType;
  /** User-ranked archetypes (most preferred first). */
  archetypeOrder: Archetype[];
  /** User-ranked armor set hashes (most preferred first). */
  setOrder: number[];
  /** User-ranked tertiary stats by archetype (most preferred first). */
  tertiaryOrderByArchetype: Partial<Record<Archetype, Stat[]>>;
  /** User-ranked tuning stats by archetype (most preferred first). */
  tuningOrderByArchetype: Partial<Record<Archetype, Stat[]>>;
  archetypeRound: number;
  tertiaryRound: number;
  /** Index into tertiary archetype list for the active tertiary archetype. */
  tertiaryArchetypeIndex: number;
  tuningRound: number;
  /** Index into calibrationTuningArchetypes() for the active tuning archetype. */
  tuningArchetypeIndex: number;
  setRound: number;
  pairwiseDecisions: PairwiseDecisionLog;
  completedSteps: CalibrateStep[];
}

export interface OnboardingProgress {
  phase: OnboardingPhase;
  /** User clicked through to calibration */
  rulesAccepted?: boolean;
  /** User completed vault inventory snapshot step */
  inventoryComplete?: boolean;
  vaultKeepPreference?: VaultKeepPreference;
  calibrate?: CalibrateProgress;
}

export function defaultPairwiseDecisions(): PairwiseDecisionLog {
  return { archetype: [], tertiaryByArchetype: {}, tuningByArchetype: {}, sets: [] };
}

export function defaultCalibrateProgress(): CalibrateProgress {
  return {
    step: 'class',
    calibrateClass: 'hunter',
    archetypeOrder: [...ARCHETYPES],
    setOrder: [],
    tertiaryOrderByArchetype: {},
    tuningOrderByArchetype: {},
    archetypeRound: 0,
    tertiaryRound: 0,
    tertiaryArchetypeIndex: 0,
    tuningRound: 0,
    tuningArchetypeIndex: 0,
    setRound: 0,
    pairwiseDecisions: defaultPairwiseDecisions(),
    completedSteps: [],
  };
}

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(LS_ONBOARDING) === 'true';
}

/** Route guards: localStorage is the source of truth (not zustand cache). */
export function needsOnboardingRedirect(): boolean {
  return !isOnboardingComplete();
}

/** True when onboarding progress indicates an active first-time onboarding run. */
export function hasInProgressOnboarding(): boolean {
  const progress = loadOnboardingProgress();
  if (!progress) return false;
  return (
    progress.rulesAccepted === true ||
    progress.phase === 'inventory' ||
    progress.phase === 'calibrate'
  );
}

/** Skip inventory for users who already advanced past the class pick in calibrate. */
export function isInventoryPhaseComplete(progress?: OnboardingProgress | null): boolean {
  const p = progress ?? loadOnboardingProgress();
  if (!p) return false;
  if (p.inventoryComplete === true) return true;
  const step = p.calibrate?.step;
  if (step && step !== 'class') return true;
  if ((p.calibrate?.completedSteps?.length ?? 0) > 0) return true;
  return false;
}

/** Persist calibrate step/round state during first-time onboarding. */
export function shouldPersistCalibrateProgress(): boolean {
  return !isOnboardingComplete() || hasInProgressOnboarding();
}

/** Post-completion recalibrate from Settings: fresh class step, no progress key. */
export function isRecalibrationSession(): boolean {
  return isOnboardingComplete() && !hasInProgressOnboarding();
}

function debugCalibrateReset(savedStep: CalibrateStep | undefined, reason: string): void {
  if (!import.meta.env.DEV || !savedStep || savedStep === 'class') return;
  console.debug('[calibrate] step reset to class', { reason, savedStep });
}

/** True when in-memory calibrate looks like an untouched default (typical after HMR reset). */
export function isFreshCalibrateDefault(current: CalibrateProgress): boolean {
  return current.step === 'class' && current.completedSteps.length === 0;
}

/** Whether persisted progress should replace current in-memory calibrate state. */
export function shouldRestoreCalibrateProgressFromStorage(
  current: CalibrateProgress,
  saved: CalibrateProgress,
): boolean {
  const savedIdx = CALIBRATE_STEPS.indexOf(saved.step);
  const currentIdx = CALIBRATE_STEPS.indexOf(current.step);

  if (savedIdx > currentIdx) return true;
  if (savedIdx < currentIdx) return false;

  if (isFreshCalibrateDefault(current) && !isFreshCalibrateDefault(saved)) {
    return true;
  }

  return (
    saved.archetypeRound !== current.archetypeRound ||
    saved.tertiaryRound !== current.tertiaryRound ||
    saved.tertiaryArchetypeIndex !== current.tertiaryArchetypeIndex ||
    saved.tuningRound !== current.tuningRound ||
    saved.tuningArchetypeIndex !== current.tuningArchetypeIndex ||
    saved.setRound !== current.setRound ||
    saved.calibrateClass !== current.calibrateClass ||
    saved.archetypeOrder.join(',') !== current.archetypeOrder.join(',') ||
    saved.setOrder.join(',') !== current.setOrder.join(',') ||
    JSON.stringify(saved.tertiaryOrderByArchetype) !==
      JSON.stringify(current.tertiaryOrderByArchetype) ||
    JSON.stringify(saved.tuningOrderByArchetype) !== JSON.stringify(current.tuningOrderByArchetype) ||
    saved.pairwiseDecisions.archetype.length !== current.pairwiseDecisions.archetype.length ||
    saved.completedSteps.join(',') !== current.completedSteps.join(',')
  );
}

/** Read saved calibrate progress when first-time onboarding persistence is active. */
export function getSavedCalibrateProgressForRestore(): CalibrateProgress | null {
  if (!shouldPersistCalibrateProgress()) return null;
  return loadOnboardingProgress()?.calibrate ?? null;
}

export function loadCalibrateSessionProgress(): CalibrateProgress | null {
  try {
    const raw = sessionStorage.getItem(SS_CALIBRATE_SESSION);
    if (!raw) return null;
    return parseCalibrateProgress(JSON.parse(raw)) ?? null;
  } catch {
    return null;
  }
}

export function saveCalibrateSessionProgress(calibrate: CalibrateProgress): void {
  try {
    sessionStorage.setItem(SS_CALIBRATE_SESSION, JSON.stringify(calibrate));
  } catch {
    /* quota / private mode */
  }
}

export function clearCalibrateSessionProgress(): void {
  sessionStorage.removeItem(SS_CALIBRATE_SESSION);
}

/** Reset all calibrate progress storage after successful completion. */
export function resetCalibrateProgressAfterCompletion(): void {
  clearCalibrateSessionProgress();
  clearOnboardingProgress();
  calibrateHmrRef.current = null;
  if (import.meta.hot?.data) {
    delete import.meta.hot.data[HMR_CALIBRATE_KEY];
  }
}

/** Persist onboarding completion and clear all in-progress onboarding/calibrate state. */
export function markOnboardingComplete(): void {
  localStorage.setItem(LS_ONBOARDING, 'true');
  resetCalibrateProgressAfterCompletion();
}

function calibrateProgressFromStorage(options?: {
  urlClass?: ClassType;
  searchParams?: URLSearchParams;
}): CalibrateProgress {
  const saved = loadOnboardingProgress()?.calibrate;

  if (saved && shouldPersistCalibrateProgress()) {
    if (options?.urlClass && saved.step === 'class') {
      return { ...saved, calibrateClass: options.urlClass };
    }
    return saved;
  }

  const classOnlyRecalibrate =
    isRecalibrationSession() &&
    Boolean(options?.urlClass) &&
    !options?.searchParams?.get('step');

  const session = classOnlyRecalibrate ? null : loadCalibrateSessionProgress();
  if (session && isRecalibrationSession()) {
    if (options?.urlClass && session.step === 'class') {
      return { ...session, calibrateClass: options.urlClass };
    }
    return session;
  }

  if (saved && saved.step !== 'class') {
    debugCalibrateReset(
      saved.step,
      isRecalibrationSession() ? 'recalibration session' : 'not persistable',
    );
  }

  const defaults = defaultCalibrateProgress();
  return {
    ...defaults,
    calibrateClass: options?.urlClass ?? defaults.calibrateClass,
    step: 'class',
  };
}

/** Synchronous calibrate state for first render (read-only: never writes storage). */
export function getCalibrateInitialState(options?: {
  urlClass?: ClassType;
  searchParams?: URLSearchParams;
}): CalibrateProgress {
  const fromStorage = calibrateProgressFromStorage({
    urlClass: options?.urlClass,
    searchParams: options?.searchParams,
  });
  const urlPartial = options?.searchParams
    ? parseCalibrateSearchParams(options.searchParams)
    : null;

  if (urlPartial?.step) {
    return mergeCalibrateProgressFromUrl(fromStorage, urlPartial);
  }

  if (urlPartial?.calibrateClass && fromStorage.step === 'class') {
    return { ...fromStorage, calibrateClass: urlPartial.calibrateClass };
  }

  return fromStorage;
}

/**
 * @deprecated Use getCalibrateInitialState: mount must not write storage (avoids
 * overwriting in-progress step with defaults when read path fails).
 */
export function hydrateCalibratePageState(urlClass?: ClassType): CalibrateProgress {
  return getCalibrateInitialState({ urlClass });
}

function isCalibrateStep(value: unknown): value is CalibrateStep {
  return typeof value === 'string' && CALIBRATE_STEPS.includes(value as CalibrateStep);
}

function parsePairwiseDecisionLog(raw: unknown): PairwiseDecisionLog {
  const empty = defaultPairwiseDecisions();
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as Partial<PairwiseDecisionLog> & {
    tertiary?: PairwiseDecision[];
    tuning?: PairwiseDecision[];
  };

  function parseList(list: unknown): PairwiseDecision[] {
    if (!Array.isArray(list)) return [];
    return list.filter((entry): entry is PairwiseDecision => {
      if (!entry || typeof entry !== 'object') return false;
      if ('tie' in entry && entry.tie === true) {
        return typeof entry.a === 'string' && typeof entry.b === 'string';
      }
      return typeof entry.winner === 'string' && typeof entry.loser === 'string';
    });
  }

  const tertiaryByArchetype: Partial<Record<Archetype, PairwiseDecision[]>> = {};
  if (data.tertiaryByArchetype && typeof data.tertiaryByArchetype === 'object') {
    for (const [arch, list] of Object.entries(data.tertiaryByArchetype)) {
      tertiaryByArchetype[arch as Archetype] = parseList(list);
    }
  } else if (Array.isArray(data.tertiary)) {
    // Legacy: class-wide tertiary decisions become the initial baseline for all archetypes.
    const legacy = parseList(data.tertiary);
    for (const archetype of ARCHETYPES) {
      tertiaryByArchetype[archetype] = [...legacy];
    }
  }

  const tuningByArchetype: Partial<Record<Archetype, PairwiseDecision[]>> = {};
  if (data.tuningByArchetype && typeof data.tuningByArchetype === 'object') {
    for (const [arch, list] of Object.entries(data.tuningByArchetype)) {
      tuningByArchetype[arch as Archetype] = parseList(list);
    }
  } else if (Array.isArray(data.tuning)) {
    // Legacy: class-wide tuning decisions applied to gunner only.
    tuningByArchetype.gunner = parseList(data.tuning);
  }

  return {
    archetype: parseList(data.archetype),
    tertiaryByArchetype,
    tuningByArchetype,
    sets: parseList(data.sets),
  };
}

function migrateCalibrateStep(step: unknown): CalibrateStep | undefined {
  if (step === 'mode' || step === 'stats') return 'archetype';
  return isCalibrateStep(step) ? step : undefined;
}

function parseCalibrateProgress(raw: unknown): CalibrateProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Partial<CalibrateProgress> & {
    tertiaryOrder?: unknown;
    tertiaryOrderByArchetype?: unknown;
  };
  const step = migrateCalibrateStep(data.step);
  if (!step) return undefined;

  const archetypeOrder = Array.isArray(data.archetypeOrder)
    ? data.archetypeOrder.filter((a): a is Archetype =>
        typeof a === 'string' && ARCHETYPES.includes(a as Archetype),
      )
    : [...ARCHETYPES];

  const setOrder = Array.isArray(data.setOrder)
    ? data.setOrder.filter((h): h is number => typeof h === 'number' && Number.isFinite(h))
    : [];
  const tertiaryOrderByArchetype: Partial<Record<Archetype, Stat[]>> = {};
  if (data.tertiaryOrderByArchetype && typeof data.tertiaryOrderByArchetype === 'object') {
    for (const [arch, list] of Object.entries(data.tertiaryOrderByArchetype)) {
      if (!ARCHETYPES.includes(arch as Archetype) || !Array.isArray(list)) continue;
      tertiaryOrderByArchetype[arch as Archetype] = list.filter(
        (s): s is Stat => typeof s === 'string' && STATS.includes(s as Stat),
      );
    }
  } else if (Array.isArray(data.tertiaryOrder)) {
    const legacyOrder = data.tertiaryOrder.filter(
      (s): s is Stat => typeof s === 'string' && STATS.includes(s as Stat),
    );
    for (const archetype of ARCHETYPES) {
      tertiaryOrderByArchetype[archetype] = [...legacyOrder];
    }
  }
  const tuningOrderByArchetype: Partial<Record<Archetype, Stat[]>> = {};
  if (data.tuningOrderByArchetype && typeof data.tuningOrderByArchetype === 'object') {
    for (const [arch, list] of Object.entries(data.tuningOrderByArchetype)) {
      if (!ARCHETYPES.includes(arch as Archetype) || !Array.isArray(list)) continue;
      tuningOrderByArchetype[arch as Archetype] = list.filter(
        (s): s is Stat => typeof s === 'string' && STATS.includes(s as Stat),
      );
    }
  }

  const calibrateClass =
    data.calibrateClass === 'titan' ||
    data.calibrateClass === 'hunter' ||
    data.calibrateClass === 'warlock'
      ? data.calibrateClass
      : 'hunter';

  const rawCompletedSteps = Array.isArray(data.completedSteps)
    ? (data.completedSteps as unknown[])
    : [];

  return {
    step,
    calibrateClass,
    archetypeOrder:
      archetypeOrder.length === ARCHETYPES.length ? archetypeOrder : [...ARCHETYPES],
    setOrder,
    tertiaryOrderByArchetype,
    tuningOrderByArchetype,
    archetypeRound: typeof data.archetypeRound === 'number' ? data.archetypeRound : 0,
    tertiaryRound: typeof data.tertiaryRound === 'number' ? data.tertiaryRound : 0,
    tertiaryArchetypeIndex:
      typeof data.tertiaryArchetypeIndex === 'number' ? data.tertiaryArchetypeIndex : 0,
    tuningRound: typeof data.tuningRound === 'number' ? data.tuningRound : 0,
    tuningArchetypeIndex:
      typeof data.tuningArchetypeIndex === 'number' ? data.tuningArchetypeIndex : 0,
    setRound: typeof data.setRound === 'number' ? data.setRound : 0,
    pairwiseDecisions: parsePairwiseDecisionLog(data.pairwiseDecisions),
    completedSteps: rawCompletedSteps
      .filter((s): s is string => typeof s === 'string')
      .filter((s) => s !== 'stats' && s !== 'mode')
      .map((s) => migrateCalibrateStep(s))
      .filter((s): s is CalibrateStep => s !== undefined),
  };
}

export function loadOnboardingProgress(): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(LS_ONBOARDING_PROGRESS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    const phase =
      parsed.phase === 'calibrate'
        ? 'calibrate'
        : parsed.phase === 'inventory'
          ? 'inventory'
          : 'rules';
    const vaultKeepPreference =
      parsed.vaultKeepPreference === 'lean' ||
      parsed.vaultKeepPreference === 'balanced' ||
      parsed.vaultKeepPreference === 'options' ||
      parsed.vaultKeepPreference === 'hoarder'
        ? parsed.vaultKeepPreference
        : undefined;
    return {
      phase,
      rulesAccepted: parsed.rulesAccepted === true,
      inventoryComplete: parsed.inventoryComplete === true,
      vaultKeepPreference,
      calibrate: parseCalibrateProgress(parsed.calibrate),
    };
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(progress: OnboardingProgress): void {
  localStorage.setItem(LS_ONBOARDING_PROGRESS, JSON.stringify(progress));
}

export function clearOnboardingProgress(): void {
  localStorage.removeItem(LS_ONBOARDING_PROGRESS);
}

/** Primary nav target: resume onboarding or start recalibration for a class. */
export function getCalibrateNavPath(classType: ClassType): string {
  if (!isOnboardingComplete() || hasInProgressOnboarding()) {
    return getOnboardingResumePath(isOnboardingComplete());
  }
  return `/onboarding/calibrate?class=${classType}`;
}

/** Route to resume incomplete onboarding (rules vs inventory vs calibrate). */
export function getOnboardingResumePath(onboardingComplete: boolean): string {
  if (onboardingComplete && !hasInProgressOnboarding()) return '/dashboard/hunter';

  const progress = loadOnboardingProgress();
  if (progress?.rulesAccepted || progress?.phase === 'inventory' || progress?.phase === 'calibrate') {
    if (!isInventoryPhaseComplete(progress)) return '/onboarding/inventory';
    return buildCalibratePath(progress?.calibrate);
  }
  return '/onboarding/rules';
}

export { buildCalibratePath };

export function markRulesPhase(): void {
  const existing = loadOnboardingProgress();
  if (existing?.rulesAccepted || existing?.phase === 'calibrate') return;
  saveOnboardingProgress({
    phase: 'rules',
    rulesAccepted: false,
    ...(existing?.calibrate ? { calibrate: existing.calibrate } : {}),
  });
}

export function markRulesAccepted(): void {
  const existing = loadOnboardingProgress();
  saveOnboardingProgress({
    phase: 'inventory',
    rulesAccepted: true,
    inventoryComplete: false,
    calibrate: existing?.calibrate ?? defaultCalibrateProgress(),
  });
}

export function markInventoryComplete(vaultKeepPreference: VaultKeepPreference): void {
  const existing = loadOnboardingProgress();
  saveOnboardingProgress({
    phase: 'calibrate',
    rulesAccepted: true,
    inventoryComplete: true,
    vaultKeepPreference,
    calibrate: existing?.calibrate ?? defaultCalibrateProgress(),
  });
}

/** Return to inventory from calibration while preserving calibrate state. */
export function markBackToInventory(): void {
  const existing = loadOnboardingProgress();
  saveOnboardingProgress({
    phase: 'inventory',
    rulesAccepted: true,
    inventoryComplete: false,
    vaultKeepPreference: existing?.vaultKeepPreference,
    calibrate: existing?.calibrate ?? defaultCalibrateProgress(),
  });
}

export function ensureCalibratePhase(): void {
  const existing = loadOnboardingProgress();
  if (
    existing?.rulesAccepted &&
    isInventoryPhaseComplete(existing) &&
    existing.phase === 'calibrate' &&
    existing.calibrate
  ) {
    return;
  }

  saveOnboardingProgress({
    phase: 'calibrate',
    rulesAccepted: true,
    inventoryComplete: existing?.inventoryComplete ?? isInventoryPhaseComplete(existing),
    vaultKeepPreference: existing?.vaultKeepPreference,
    calibrate: existing?.calibrate ?? defaultCalibrateProgress(),
  });
}

/** Return to rules from calibration while preserving in-progress calibrate state. */
export function markBackToRules(): void {
  const existing = loadOnboardingProgress();
  saveOnboardingProgress({
    phase: 'rules',
    rulesAccepted: false,
    calibrate: existing?.calibrate ?? defaultCalibrateProgress(),
  });
}

export function saveCalibrateProgress(calibrate: CalibrateProgress): void {
  if (!shouldPersistCalibrateProgress()) {
    saveCalibrateSessionProgress(calibrate);
    return;
  }
  const existing = loadOnboardingProgress();
  saveOnboardingProgress({
    phase: 'calibrate',
    rulesAccepted: true,
    inventoryComplete: existing?.inventoryComplete ?? isInventoryPhaseComplete(existing),
    vaultKeepPreference: existing?.vaultKeepPreference,
    calibrate,
  });
}

/** Vite HMR data key: survives module swap within a dev session. */
const HMR_CALIBRATE_KEY = 'calibrateProgress';

/**
 * Updated each CalibratePage render so module-level HMR handlers can persist
 * in-memory progress before React Fast Refresh resets hook state.
 */
export const calibrateHmrRef: { current: CalibrateProgress | null } = { current: null };

/** Persist current calibrate progress before a Vite module swap (dev only). */
export function stashCalibrateProgressForHmr(progress: CalibrateProgress): void {
  calibrateHmrRef.current = progress;
  if (import.meta.hot?.data) {
    import.meta.hot.data[HMR_CALIBRATE_KEY] = progress;
  }
  if (shouldPersistCalibrateProgress()) {
    saveCalibrateProgress(progress);
  }
}

function readHmrCalibrateProgress(): CalibrateProgress | undefined {
  const raw = import.meta.hot?.data?.[HMR_CALIBRATE_KEY];
  if (!raw || typeof raw !== 'object') return undefined;
  const parsed = parseCalibrateProgress(raw);
  return parsed;
}

/**
 * Calibrate mount state: URL (source of truth) → localStorage → defaults.
 * URL survives HMR/refresh; localStorage backs resume paths and fields not in the URL.
 */
export function getCalibrateProgressForMount(options?: {
  urlClass?: ClassType;
  searchParams?: URLSearchParams;
}): CalibrateProgress {
  const searchParams = options?.searchParams;
  const urlPartial = searchParams ? parseCalibrateSearchParams(searchParams) : null;

  if (urlPartial?.step) {
    return getCalibrateInitialState(options);
  }

  const fromHmr = readHmrCalibrateProgress();
  if (fromHmr) return fromHmr;
  if (import.meta.env.DEV && calibrateHmrRef.current) {
    return calibrateHmrRef.current;
  }

  return getCalibrateInitialState(options);
}

/** Register Vite HMR hooks once (CalibratePage import triggers this in dev). */
export function registerCalibrateHmrHandlers(): void {
  if (!import.meta.hot || import.meta.hot.data.calibrateHmrRegistered) return;
  import.meta.hot.data.calibrateHmrRegistered = true;

  import.meta.hot.dispose((data) => {
    const progress = calibrateHmrRef.current;
    if (progress) {
      data[HMR_CALIBRATE_KEY] = progress;
      if (shouldPersistCalibrateProgress()) {
        saveCalibrateProgress(progress);
      }
    }
  });

  import.meta.hot.on('vite:beforeUpdate', () => {
    const progress = calibrateHmrRef.current;
    if (progress) stashCalibrateProgressForHmr(progress);
  });
}
