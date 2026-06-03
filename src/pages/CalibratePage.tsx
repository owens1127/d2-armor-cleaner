import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TransitionFlash } from '@/components/TransitionFlash';
import { ClassIcon } from '@/components/items/ClassIcon';
import { OnboardingStepActions } from '@/components/onboarding/OnboardingBackButton';
import { StatIcon } from '@/components/StatIcon';
import { ArmorSetIcons } from '@/components/ArmorSetIcons';
import {
  ARCHETYPE_LABELS,
  ARCHETYPE_STATS,
  CLASS_LABELS,
  CLASSES,
  formatArchetypeStatsLabel,
  formatArmorSetPerkTierLabel,
  getArmorSetPerkLines,
  STAT_LABELS,
} from '@/lib/constants';
import { resolveArmorSetDisplayName, resolveArmorSetInfoForHash } from '@/lib/items/setIcons';
import { moveRankedItem, reorderRankedItems } from '@/lib/onboarding/rankedOrder';
import {
  buildTertiaryRanker,
  buildTuningRanker,
  calibrationSetPieces,
  calibrationTertiaryStats,
  calibrationTuningArchetypes,
  calibrationTuningStats,
  defaultArchetypeOrder,
  defaultSetOrderHashes,
  normalizeArchetypeOrder,
} from '@/lib/scoring/calibrate';
import { getClassPrefs, updateClassPrefs } from '@/lib/prefs/profile';
import { savePrefs } from '@/lib/prefs/storage';
import {
  getCalibrationChoiceCount,
  recordCalibrationChoice,
  syncCalibrationChoicesToKeys,
  trimCalibrationChoicesForStep,
} from '@/lib/prefs/calibrationChoices';
import {
  applyArchetypeOrder,
  applySetOrder,
  applyTertiaryStatOrder,
  applyTuningStatOrder,
  updateStatRank,
} from '@/lib/scoring/score';
import {
  calibrationKeyArchetypeOrder,
  calibrationKeyForRound,
  calibrationKeySetOrder,
  calibrationKeyStats,
  removeCalibrationKey,
  trimCountedKeysForStep,
  trimCountedKeysWhenReturningToArchetype,
} from '@/lib/onboarding/calibrateSession';
import {
  buildCalibrateSearchParams,
  mergeCalibrateProgressFromUrl,
  parseCalibrateSearchParams,
  searchParamsMatchProgress,
} from '@/lib/onboarding/calibrateUrl';
import {
  CALIBRATE_STEPS,
  calibrateHmrRef,
  ensureCalibratePhase,
  getCalibrateProgressForMount,
  markBackToInventory,
  registerCalibrateHmrHandlers,
  saveCalibrateProgress,
  shouldPersistCalibrateProgress,
  stashCalibrateProgressForHmr,
  type CalibrateProgress,
  type CalibrateStep,
} from '@/lib/onboarding/storage';
import { SS_CALIBRATE_SET_BONUS_DETAILS } from '@/lib/storage/keys';
import { usePrefsStore, useVaultStore } from '@/stores';
import type {
  Archetype,
  ArmorSetInfo,
  ClassPreferenceProfile,
  ClassType,
  Stat,
} from '@/types';

registerCalibrateHmrHandlers();

const STEPS = CALIBRATE_STEPS;

const STEP_LABELS: Record<CalibrateStep, string> = {
  class: 'Class',
  stats: 'Stat order',
  archetype: 'Archetypes',
  tertiary: 'Tertiary stats',
  tuning: 'Tuning stats',
  sets: 'Armor sets',
};

function loadShowSetBonusDetails(): boolean {
  try {
    const stored = sessionStorage.getItem(SS_CALIBRATE_SET_BONUS_DETAILS);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    /* private mode */
  }
  return true;
}

function persistShowSetBonusDetails(show: boolean): void {
  try {
    sessionStorage.setItem(SS_CALIBRATE_SET_BONUS_DETAILS, String(show));
  } catch {
    /* quota / private mode */
  }
}

export function CalibratePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, updateProfile } = usePrefsStore();
  const { setOnboardingComplete, allItems, lastParsedCount } = useVaultStore();
  const vaultReady = lastParsedCount !== null;
  const [progress, setProgress] = useState<CalibrateProgress>(() =>
    getCalibrateProgressForMount({ searchParams }),
  );
  const [pickFeedback, setPickFeedback] = useState<string | null>(null);
  const [showSetBonusDetails, setShowSetBonusDetails] = useState(loadShowSetBonusDetails);

  const {
    step,
    calibrateClass,
    statOrder,
    archetypeOrder,
    setOrder,
    archetypeRound,
    tertiaryRound,
    tertiaryArchetypeIndex,
    tuningRound,
    tuningArchetypeIndex,
    setRound,
    tertiaryOrderByArchetype,
    tuningOrderByArchetype,
    pairwiseDecisions,
    completedSteps,
  } = progress;

  calibrateHmrRef.current = progress;

  useEffect(() => {
    if (shouldPersistCalibrateProgress()) ensureCalibratePhase();
  }, []);

  useEffect(() => {
    if (!pickFeedback) return;
    const timer = window.setTimeout(() => setPickFeedback(null), 2000);
    return () => window.clearTimeout(timer);
  }, [pickFeedback]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [
    step,
    archetypeRound,
    tertiaryRound,
    tertiaryArchetypeIndex,
    tuningRound,
    tuningArchetypeIndex,
    setRound,
  ]);

  const searchKey = searchParams.toString();
  useEffect(() => {
    const urlPartial = parseCalibrateSearchParams(searchParams);
    if (!urlPartial?.step) return;

    setProgress((current) => {
      if (searchParamsMatchProgress(searchParams, current)) return current;
      const merged = mergeCalibrateProgressFromUrl(current, urlPartial);
      const urlStep = urlPartial.step;
      if (urlStep && STEPS.indexOf(urlStep) < STEPS.indexOf(current.step)) {
        updateProfile((p) => {
          const next = updateClassPrefs(p, merged.calibrateClass, (prefs) =>
            trimCalibrationChoicesForStep(prefs, urlStep),
          );
          savePrefs(next);
          return next;
        });
      }
      return merged;
    });
  }, [searchKey, searchParams]);

  useEffect(() => {
    if (searchParams.has('step')) return;
    if (progress.step === 'class' && progress.completedSteps.length === 0) return;
    if (searchParamsMatchProgress(searchParams, progress)) return;
    setSearchParams(buildCalibrateSearchParams(progress), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only URL seed from restored progress
  }, []);

  function syncProgressToUrl(next: CalibrateProgress) {
    const nextParams = buildCalibrateSearchParams(next);
    if (nextParams.toString() === searchParams.toString()) return;
    setSearchParams(nextParams, { replace: true });
  }

  function currentProgress(overrides: Partial<CalibrateProgress> = {}): CalibrateProgress {
    return { ...progress, ...overrides };
  }

  function persistProgress(overrides: Partial<CalibrateProgress> = {}): CalibrateProgress {
    const next = currentProgress(overrides);
    saveCalibrateProgress(next);
    stashCalibrateProgressForHmr(next);
    setProgress(next);
    syncProgressToUrl(next);
    return next;
  }

  function applyCalibrationChoice(
    key: string,
    updater: (prefs: ClassPreferenceProfile) => ClassPreferenceProfile,
  ) {
    updateProfile((p) => {
      const next = updateClassPrefs(p, calibrateClass, (prefs) =>
        recordCalibrationChoice(updater(prefs), key),
      );
      savePrefs(next);
      return next;
    });
  }

  function updateClassProfile(
    fn: (prefs: ReturnType<typeof getClassPrefs>) => ReturnType<typeof getClassPrefs>,
  ) {
    updateProfile((p) => {
      const next = updateClassPrefs(p, calibrateClass, fn);
      savePrefs(next);
      return next;
    });
  }

  const classItems = useMemo(
    () => allItems.filter((i) => i.classType === calibrateClass),
    [allItems, calibrateClass],
  );
  const savedChoiceCount = getCalibrationChoiceCount(
    getClassPrefs(profile, calibrateClass),
  );
  const tuningArchetypes = useMemo(
    () => calibrationTuningArchetypes(classItems),
    [classItems],
  );
  const tertiaryArchetypes = useMemo(() => calibrationTuningArchetypes(classItems), [classItems]);
  const currentTertiaryArchetype =
    tertiaryArchetypes[tertiaryArchetypeIndex] ?? tertiaryArchetypes[0] ?? 'gunner';
  const currentTuningArchetype = tuningArchetypes[tuningArchetypeIndex] ?? tuningArchetypes[0] ?? 'gunner';
  function withCompleted(completed: CalibrateStep): CalibrateStep[] {
    return completedSteps.includes(completed) ? completedSteps : [...completedSteps, completed];
  }

  const tertiaryStats = useMemo(
    () => calibrationTertiaryStats(classItems, statOrder, currentTertiaryArchetype),
    [classItems, statOrder, currentTertiaryArchetype],
  );
  const tuningStats = useMemo(
    () => calibrationTuningStats(classItems, statOrder, currentTuningArchetype),
    [classItems, statOrder, currentTuningArchetype],
  );
  const setPieces = useMemo(() => calibrationSetPieces(classItems), [classItems]);

  const effectiveArchetypeOrder = useMemo(
    () => normalizeArchetypeOrder(archetypeOrder),
    [archetypeOrder],
  );

  const defaultSetHashes = useMemo(
    () => defaultSetOrderHashes(classItems),
    [classItems],
  );

  const effectiveSetOrder = useMemo(() => {
    if (
      setOrder.length === defaultSetHashes.length &&
      setOrder.every((h) => defaultSetHashes.includes(h))
    ) {
      return setOrder;
    }
    return defaultSetHashes;
  }, [setOrder, defaultSetHashes]);

  const effectiveTertiaryOrder = useMemo(() => {
    const fromProgress = tertiaryOrderByArchetype[currentTertiaryArchetype] ?? [];
    const fallback = buildTertiaryRanker(
      classItems,
      statOrder,
      pairwiseDecisions.tertiaryByArchetype[currentTertiaryArchetype] ?? [],
      currentTertiaryArchetype,
    ).getOrderedItems();
    if (fromProgress.length !== tertiaryStats.length) return fallback;
    if (fromProgress.some((stat) => !tertiaryStats.includes(stat))) return fallback;
    return fromProgress;
  }, [
    classItems,
    statOrder,
    pairwiseDecisions.tertiaryByArchetype,
    currentTertiaryArchetype,
    tertiaryOrderByArchetype,
    tertiaryStats,
  ]);

  const currentTuningOrder = useMemo(() => {
    const fromProgress = tuningOrderByArchetype[currentTuningArchetype] ?? [];
    const fallback = buildTuningRanker(
      classItems,
      statOrder,
      currentTuningArchetype,
      pairwiseDecisions.tuningByArchetype[currentTuningArchetype] ?? [],
    ).getOrderedItems();
    if (fromProgress.length !== tuningStats.length) return fallback;
    if (fromProgress.some((stat) => !tuningStats.includes(stat))) return fallback;
    return fromProgress;
  }, [
    classItems,
    statOrder,
    currentTuningArchetype,
    pairwiseDecisions.tuningByArchetype,
    tuningOrderByArchetype,
    tuningStats,
  ]);

  const stepIndex = STEPS.indexOf(step);
  const classSelected = step !== 'class';

  function moveStat(index: number, dir: -1 | 1) {
    const next = moveRankedItem(statOrder, index, dir);
    if (!next) return;
    persistProgress({ statOrder: next });
  }

  function moveArchetype(index: number, dir: -1 | 1) {
    const next = moveRankedItem(effectiveArchetypeOrder, index, dir);
    if (!next) return;
    persistProgress({ archetypeOrder: next });
  }

  function moveSet(index: number, dir: -1 | 1) {
    const next = moveRankedItem(effectiveSetOrder, index, dir);
    if (!next) return;
    persistProgress({ setOrder: next });
  }

  function moveTertiary(index: number, dir: -1 | 1) {
    const next = moveRankedItem(effectiveTertiaryOrder, index, dir);
    if (!next) return;
    persistTertiaryOrder(next);
  }

  function moveCurrentTuning(index: number, dir: -1 | 1) {
    const next = moveRankedItem(currentTuningOrder, index, dir);
    if (!next) return;
    persistCurrentTuningOrder(next);
  }

  function pickClass(classType: ClassType) {
    persistProgress({ calibrateClass: classType, step: 'stats' });
  }

  function finishStats() {
    const key = calibrationKeyStats();
    applyCalibrationChoice(key, (p) => updateStatRank(p, statOrder));
    persistProgress({
      step: 'archetype',
      archetypeRound: 0,
      archetypeOrder: defaultArchetypeOrder(),
    });
  }

  function advanceAfterArchetype() {
    const nextCompleted = withCompleted('archetype');
    if (tertiaryStats.length < 2) {
      persistProgress({
        step: 'tuning',
        tuningRound: 0,
        tuningArchetypeIndex: 0,
        tertiaryRound: 0,
        tertiaryArchetypeIndex: 0,
        completedSteps: [...nextCompleted, 'tertiary'],
      });
    } else {
      persistProgress({
        step: 'tertiary',
        tertiaryRound: 0,
        tertiaryArchetypeIndex: 0,
        completedSteps: nextCompleted,
      });
    }
  }

  function finishArchetype() {
    applyCalibrationChoice(calibrationKeyArchetypeOrder(), (p) =>
      applyArchetypeOrder(p, effectiveArchetypeOrder),
    );
    setPickFeedback('Saved · Next step');
    advanceAfterArchetype();
  }

  function persistTertiaryOrder(nextOrder: Stat[]) {
    persistProgress({
      tertiaryOrderByArchetype: {
        ...tertiaryOrderByArchetype,
        [currentTertiaryArchetype]: nextOrder,
      },
    });
  }

  function finishTertiaryArchetype() {
    const key = calibrationKeyForRound('tertiary', 0, currentTertiaryArchetype);
    applyCalibrationChoice(key, (p) =>
      applyTertiaryStatOrder(p, effectiveTertiaryOrder, [currentTertiaryArchetype]),
    );
    const nextIndex = tertiaryArchetypeIndex + 1;
    if (nextIndex < tertiaryArchetypes.length) {
      persistProgress({ tertiaryArchetypeIndex: nextIndex, tertiaryRound: 0 });
      setPickFeedback(`Saved · Next ${ARCHETYPE_LABELS[tertiaryArchetypes[nextIndex]!]} tertiary`);
      return;
    }
    persistProgress({
      step: 'tuning',
      tuningRound: 0,
      tuningArchetypeIndex: 0,
      tertiaryRound: 0,
      tertiaryArchetypeIndex: 0,
      completedSteps: withCompleted('tertiary'),
    });
    setPickFeedback('Saved · Next step');
  }

  function persistCurrentTuningOrder(nextOrder: Stat[]) {
    persistProgress({
      tuningOrderByArchetype: {
        ...tuningOrderByArchetype,
        [currentTuningArchetype]: nextOrder,
      },
    });
  }

  function finishTuningArchetype() {
    const key = calibrationKeyForRound('tuning', 0, currentTuningArchetype);
    applyCalibrationChoice(key, (p) => applyTuningStatOrder(p, currentTuningOrder, [currentTuningArchetype]));
    const nextIndex = tuningArchetypeIndex + 1;
    if (nextIndex < tuningArchetypes.length) {
      persistProgress({
        tuningArchetypeIndex: nextIndex,
        tuningRound: 0,
      });
      setPickFeedback(`Saved · Next ${ARCHETYPE_LABELS[tuningArchetypes[nextIndex]!]} tuning`);
      return;
    }
    finishTuningStep();
  }

  function finishTuningStep() {
    const nextCompleted = withCompleted('tuning');
    if (setPieces.length < 2) {
      completeCalibration();
    } else {
      persistProgress({
        step: 'sets',
        setRound: 0,
        setOrder: defaultSetOrderHashes(classItems),
        completedSteps: nextCompleted,
      });
    }
    setPickFeedback('Saved · Next step');
  }

  function finishSets() {
    applyCalibrationChoice(calibrationKeySetOrder(), (p) =>
      applySetOrder(p, effectiveSetOrder),
    );
    completeCalibration();
  }

  function skipArchetype() {
    const nextCompleted = withCompleted('archetype');
    if (tertiaryStats.length < 2) {
      persistProgress({
        step: 'tuning',
        tuningRound: 0,
        tuningArchetypeIndex: 0,
        tertiaryRound: 0,
        tertiaryArchetypeIndex: 0,
        completedSteps: [...nextCompleted, 'tertiary'],
      });
    } else {
      persistProgress({
        step: 'tertiary',
        tertiaryRound: 0,
        tertiaryArchetypeIndex: 0,
        completedSteps: nextCompleted,
      });
    }
  }

  function skipTertiaryArchetype() {
    if (tertiaryArchetypeIndex + 1 < tertiaryArchetypes.length) {
      persistProgress({ tertiaryArchetypeIndex: tertiaryArchetypeIndex + 1, tertiaryRound: 0 });
      return;
    }
    persistProgress({
      step: 'tuning',
      tuningRound: 0,
      tuningArchetypeIndex: 0,
      tertiaryRound: 0,
      tertiaryArchetypeIndex: 0,
      completedSteps: withCompleted('tertiary'),
    });
  }

  function skipTuningArchetype() {
    if (tuningArchetypeIndex + 1 < tuningArchetypes.length) {
      persistProgress({
        tuningArchetypeIndex: tuningArchetypeIndex + 1,
        tuningRound: 0,
      });
      return;
    }
    skipTuning();
  }

  function skipTuning() {
    const nextCompleted = withCompleted('tuning');
    if (setPieces.length < 2) {
      finish();
    } else {
      persistProgress({ step: 'sets', completedSteps: nextCompleted });
    }
  }

  function completeCalibration() {
    savePrefs(usePrefsStore.getState().profile);
    finish();
  }

  function finish() {
    setOnboardingComplete(true);
    navigate(`/dashboard/${calibrateClass}`, { replace: true });
  }

  function jumpToStep(targetStep: CalibrateStep) {
    if (targetStep === step) return;
    persistProgress({ step: targetStep });
  }

  function dropCompletedFrom(
    fromStep: CalibrateStep,
    overrides: Partial<CalibrateProgress> = {},
    options?: { trimChoiceKeys?: string[] },
  ): CalibrateStep[] {
    const fromIndex = STEPS.indexOf(fromStep);
    const next = completedSteps.filter((s) => STEPS.indexOf(s) < fromIndex);
    const targetStep = overrides.step ?? fromStep;
    updateClassProfile((p) =>
      options?.trimChoiceKeys
        ? syncCalibrationChoicesToKeys(p, options.trimChoiceKeys)
        : trimCalibrationChoicesForStep(p, targetStep),
    );
    persistProgress({ ...overrides, completedSteps: next });
    return next;
  }

  function goBack() {
    if (step === 'class') {
      markBackToInventory();
      navigate('/onboarding/inventory');
      return;
    }

    switch (step) {
      case 'stats':
        dropCompletedFrom('stats', { step: 'class' });
        break;
      case 'archetype':
        dropCompletedFrom('archetype', { step: 'stats' });
        break;
      case 'tertiary':
        {
          const choiceKeys = Object.keys(
            getClassPrefs(profile, calibrateClass).calibrationChoices,
          );
          dropCompletedFrom(
            'tertiary',
            { step: 'archetype', archetypeRound: 0 },
            {
              trimChoiceKeys: trimCountedKeysWhenReturningToArchetype(choiceKeys),
            },
          );
        }
        break;
      case 'tuning':
        if (tuningArchetypeIndex > 0) {
          const prevArch = tuningArchetypes[tuningArchetypeIndex - 1]!;
          const prevOrder = tuningOrderByArchetype[prevArch] ?? [];
          persistProgress({
            tuningArchetypeIndex: tuningArchetypeIndex - 1,
            tuningRound: Math.max(0, prevOrder.length > 0 ? 1 : 0),
          });
        } else {
          const choiceKeys = Object.keys(
            getClassPrefs(profile, calibrateClass).calibrationChoices,
          );
          dropCompletedFrom(
            'tuning',
            {
              step: 'tertiary',
              tertiaryRound: 0,
              tertiaryArchetypeIndex: Math.max(0, tertiaryArchetypes.length - 1),
              tuningArchetypeIndex: 0,
            },
            {
              trimChoiceKeys: removeCalibrationKey(
                trimCountedKeysForStep(choiceKeys, 'tertiary'),
                calibrationKeyForRound(
                  'tertiary',
                  0,
                  tertiaryArchetypes[Math.max(0, tertiaryArchetypes.length - 1)] ?? 'gunner',
                ),
              ),
            },
          );
        }
        break;
      case 'sets':
        {
          const lastTuningArch = tuningArchetypes[tuningArchetypes.length - 1] ?? 'gunner';
          const choiceKeys = Object.keys(
            getClassPrefs(profile, calibrateClass).calibrationChoices,
          );
          dropCompletedFrom(
            'sets',
            {
              step: 'tuning',
              tuningRound: 1,
              tuningArchetypeIndex: Math.max(0, tuningArchetypes.length - 1),
            },
            {
              trimChoiceKeys: removeCalibrationKey(
                trimCountedKeysForStep(choiceKeys, 'tuning'),
                calibrationKeyForRound('tuning', 0, lastTuningArch),
              ),
            },
          );
        }
        break;
    }
  }

  useEffect(() => {
    if (!vaultReady) return;
    if (step !== 'tertiary' || tertiaryStats.length >= 2) return;
    finishTertiaryArchetype();
  }, [vaultReady, step, tertiaryStats.length, tertiaryArchetypeIndex, currentTertiaryArchetype]);

  useEffect(() => {
    if (!vaultReady) return;
    if (step !== 'tuning' || tuningStats.length >= 2) return;
    finishTuningArchetype();
  }, [vaultReady, step, tuningStats.length, currentTuningArchetype, tuningArchetypeIndex]);

  return (
    <Layout>
      <TransitionFlash message={pickFeedback} />
      <h1 className="text-2xl font-bold mb-2">Calibrate preferences</h1>
      {classSelected && (
        <p className="text-neutral-400 mb-2 max-w-xl">
          Calibrating {CLASS_LABELS[calibrateClass]}.{' '}
          {savedChoiceCount === 1
            ? '1 choice saved'
            : `${savedChoiceCount} choices saved`}.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => jumpToStep(s)}
            className={`text-xs px-2 py-1 rounded-full ${
              i === stepIndex
                ? 'bg-white/10 text-white'
                : i < stepIndex
                  ? 'bg-white/10 text-neutral-400'
                  : 'bg-surface-2 text-neutral-500'
            } hover:text-white hover:bg-white/10 transition-colors`}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      {step === 'class' && (
        <div className="w-full max-w-lg min-w-0">
          <CalibrateStepHeader
            step="class"
            calibrateClass={calibrateClass}
            classSelected={classSelected}
            title="Which class are you calibrating?"
          />
          <div className="grid sm:grid-cols-3 gap-3">
            {CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickClass(c)}
                className="h-32 cursor-pointer rounded-xl border border-border bg-surface-2 hover:border-white/20 hover:bg-white/5 font-semibold capitalize transition-all flex flex-col items-center justify-center gap-2"
              >
                <ClassIcon classType={c} size="md" />
                {CLASS_LABELS[c]}
              </button>
            ))}
          </div>
          <OnboardingStepActions onBack={goBack} />
        </div>
      )}

      {step === 'stats' && (
        <div className="w-full max-w-md min-w-0">
          <CalibrateStepHeader
            step="stats"
            calibrateClass={calibrateClass}
            classSelected={classSelected}
            title="Rank stats by priority"
            instruction="Most important at the top. Drag to reorder or use arrow buttons."
            contextVisual={<StatGroupIcons stats={statOrder} />}
            contextLabel="Stat priority order"
          />
          <RankedReorderList
            items={statOrder}
            getKey={(stat) => stat}
            getLabel={(stat) => STAT_LABELS[stat]}
            getLeadingVisual={(stat) => <StatIcon stat={stat} size="sm" variant="glyph" />}
            onReorder={(next) => persistProgress({ statOrder: next })}
            onMove={moveStat}
          />
          <OnboardingStepActions onBack={goBack}>
            <button
              type="button"
              onClick={finishStats}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold"
            >
              Continue
            </button>
          </OnboardingStepActions>
        </div>
      )}

      {step === 'archetype' && (
        <div className="w-full max-w-lg min-w-0">
          <CalibrateStepHeader
            step="archetype"
            calibrateClass={calibrateClass}
            classSelected={classSelected}
            title="Rank archetypes by preference"
            instruction="Most preferred at the top. Drag rows or use the arrows. All six archetypes are listed; vault ownership does not limit the list."
          />
          <RankedReorderList
            items={effectiveArchetypeOrder}
            getKey={(arch) => arch}
            getLabel={(arch) => ARCHETYPE_LABELS[arch]}
            emphasizeLabel
            getSecondaryLabel={(arch) => formatArchetypeStatsLabel(arch)}
            getLeadingVisual={(arch) => <ArchetypePairIcons archetype={arch} size="md" />}
            onReorder={(next) => persistProgress({ archetypeOrder: next })}
            onMove={moveArchetype}
          />
          <OnboardingStepActions onBack={goBack} onSkip={skipArchetype} skipLabel="Skip all archetypes">
            <button
              type="button"
              onClick={finishArchetype}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold"
            >
              Continue
            </button>
          </OnboardingStepActions>
        </div>
      )}

      {step === 'tertiary' && tertiaryStats.length >= 2 && (
        <div className="w-full max-w-lg min-w-0 calibrate-pick--enter">
          <CalibrateStepHeader
            step="tertiary"
            calibrateClass={calibrateClass}
            classSelected={classSelected}
            title="Rank tertiary stats"
            instruction={
              <CalibrateRollRankInstruction
                archetype={currentTertiaryArchetype}
                archetypeIndex={tertiaryArchetypeIndex}
                archetypeCount={tertiaryArchetypes.length}
                role="tertiary"
                vaultStats={tertiaryStats}
              />
            }
          />
          <RankedReorderList
            items={effectiveTertiaryOrder}
            getKey={(stat) => stat}
            getLabel={(stat) => STAT_LABELS[stat]}
            emphasizeLabel
            getLeadingVisual={(stat) => <StatIcon stat={stat} size="md" variant="glyph" />}
            onReorder={persistTertiaryOrder}
            onMove={moveTertiary}
          />
          <OnboardingStepActions
            onBack={goBack}
            onSkip={skipTertiaryArchetype}
            skipLabel={
              tertiaryArchetypeIndex + 1 < tertiaryArchetypes.length
                ? `Skip ${ARCHETYPE_LABELS[currentTertiaryArchetype]} tertiary`
                : 'Skip tertiary stats'
            }
          >
            <button
              type="button"
              onClick={finishTertiaryArchetype}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold"
            >
              {tertiaryArchetypeIndex + 1 < tertiaryArchetypes.length
                ? 'Next archetype'
                : 'Continue'}
            </button>
          </OnboardingStepActions>
        </div>
      )}

      {step === 'tuning' && tuningStats.length >= 2 && (
        <div className="w-full max-w-lg min-w-0 calibrate-pick--enter">
          <CalibrateStepHeader
            step="tuning"
            calibrateClass={calibrateClass}
            classSelected={classSelected}
            title="Rank tuning stats"
            instruction={
              <CalibrateRollRankInstruction
                archetype={currentTuningArchetype}
                archetypeIndex={tuningArchetypeIndex}
                archetypeCount={tuningArchetypes.length}
                role="tuning"
                vaultStats={tuningStats}
              />
            }
          />
          <RankedReorderList
            items={currentTuningOrder}
            getKey={(stat) => stat}
            getLabel={(stat) => STAT_LABELS[stat]}
            emphasizeLabel
            getLeadingVisual={(stat) => <StatIcon stat={stat} size="md" variant="glyph" />}
            onReorder={persistCurrentTuningOrder}
            onMove={moveCurrentTuning}
          />
          <OnboardingStepActions
            onBack={goBack}
            onSkip={skipTuningArchetype}
            skipLabel={
              tuningArchetypeIndex + 1 < tuningArchetypes.length
                ? `Skip ${ARCHETYPE_LABELS[currentTuningArchetype]} tuning`
                : 'Skip tuning stats'
            }
          >
            <button
              type="button"
              onClick={finishTuningArchetype}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold"
            >
              {tuningArchetypeIndex + 1 < tuningArchetypes.length ? 'Next archetype' : 'Continue'}
            </button>
          </OnboardingStepActions>
        </div>
      )}

      {step === 'sets' && setPieces.length >= 2 && (
        <div className="w-full max-w-2xl min-w-0">
          <CalibrateStepHeader
            step="sets"
            calibrateClass={calibrateClass}
            classSelected={classSelected}
            title="Rank armor sets by preference"
            instruction="Most preferred at the top. Sets from your vault, ordered by how many pieces you own. Drag to reorder or use arrow buttons."
            contextVisual={
              <span className="inline-flex items-center gap-1">
                {effectiveSetOrder.slice(0, 4).map((hash) => (
                  <ArmorSetIcons key={hash} setHash={hash} items={classItems} size="sm" maxIcons={1} />
                ))}
              </span>
            }
            contextLabel="Armor set preferences"
          />
          <CalibrateSetBonusDetailsToggle
            checked={showSetBonusDetails}
            onChange={(show) => {
              setShowSetBonusDetails(show);
              persistShowSetBonusDetails(show);
            }}
          />
          <RankedReorderList
            items={effectiveSetOrder}
            getKey={(hash) => hash}
            getLabel={(hash) => resolveArmorSetDisplayName(hash, classItems) ?? 'Unknown set'}
            getLeadingVisual={(hash) => <ArmorSetIcons setHash={hash} items={classItems} size="sm" maxIcons={1} />}
            renderDetails={
              showSetBonusDetails
                ? (hash) => (
                    <RankedSetBonusDetails
                      setInfo={resolveArmorSetInfoForHash(hash, classItems)}
                    />
                  )
                : undefined
            }
            onReorder={(next) => persistProgress({ setOrder: next })}
            onMove={moveSet}
          />
          <OnboardingStepActions
            onBack={goBack}
            onSkip={completeCalibration}
            skipLabel="Skip armor sets"
          >
            <button
              type="button"
              onClick={finishSets}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold"
            >
              Go to dashboard
            </button>
          </OnboardingStepActions>
        </div>
      )}

      {step === 'sets' && setPieces.length < 2 && (
        <div className="w-full max-w-md min-w-0">
          <p className="text-neutral-400 mb-4">No armor sets to compare.</p>
          <OnboardingStepActions onBack={goBack}>
            <button
              type="button"
              onClick={finish}
              className="px-5 py-2.5 rounded-lg bg-accent text-surface font-semibold"
            >
              Go to dashboard
            </button>
          </OnboardingStepActions>
        </div>
      )}
    </Layout>
  );
}

function CalibrateStepHeader({
  step,
  calibrateClass,
  classSelected,
  title,
  instruction,
  contextVisual,
  contextLabel,
}: {
  step: CalibrateStep;
  calibrateClass: ClassType;
  classSelected: boolean;
  title: string;
  instruction?: ReactNode;
  contextVisual?: ReactNode;
  contextLabel?: string;
}) {
  const stepIndex = STEPS.indexOf(step);
  return (
    <div className="mb-6">
      <p className="text-xs text-muted mb-2">
        Step {stepIndex + 1} of {STEPS.length} · {STEP_LABELS[step]}
        {classSelected && ` · ${CLASS_LABELS[calibrateClass]}`}
      </p>
      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
      {contextVisual && (
        <div
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface-2 text-neutral-300 mb-2"
          aria-label={contextLabel}
        >
          {contextVisual}
        </div>
      )}
      {instruction && (
        <div className="space-y-2 text-sm">
          {typeof instruction === 'string' ? (
            <p className="text-muted">{instruction}</p>
          ) : (
            instruction
          )}
        </div>
      )}
    </div>
  );
}

function CalibrateSetBonusDetailsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (show: boolean) => void;
}) {
  return (
    <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span>Show bonus details</span>
    </label>
  );
}

function RankDragHandle() {
  return (
    <span
      className="inline-flex shrink-0 cursor-grab text-muted hover:text-white active:cursor-grabbing"
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5" cy="3.5" r="1.25" />
        <circle cx="11" cy="3.5" r="1.25" />
        <circle cx="5" cy="8" r="1.25" />
        <circle cx="11" cy="8" r="1.25" />
        <circle cx="5" cy="12.5" r="1.25" />
        <circle cx="11" cy="12.5" r="1.25" />
      </svg>
    </span>
  );
}

function RankedSetBonusDetails({ setInfo }: { setInfo: ArmorSetInfo | undefined }) {
  const perks = getArmorSetPerkLines(setInfo);
  if (perks.length === 0) {
    return <p className="mt-2 text-xs text-muted">Bonus details unavailable</p>;
  }
  return (
    <div className="mt-2 space-y-2.5">
      {perks.map((perk) => (
        <div key={perk.prefix}>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted">
            {formatArmorSetPerkTierLabel(perk.prefix)}
          </div>
          <p
            className="mt-0.5 text-xs leading-snug text-neutral-400 line-clamp-3"
            title={perk.text}
          >
            {perk.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function RankedReorderList<T extends string | number>({
  items,
  getKey,
  getLabel,
  getLeadingVisual,
  getSecondaryLabel,
  renderDetails,
  emphasizeLabel,
  onReorder,
  onMove,
}: {
  items: T[];
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  getLeadingVisual?: (item: T) => ReactNode;
  getSecondaryLabel?: (item: T) => string;
  renderDetails?: (item: T) => ReactNode;
  emphasizeLabel?: boolean;
  onReorder: (next: T[]) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const [draggingKey, setDraggingKey] = useState<string | number | null>(null);

  function reorderTo(targetIndex: number) {
    if (draggingKey === null) return;
    const sourceIndex = items.findIndex((item) => getKey(item) === draggingKey);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const next = reorderRankedItems(items, sourceIndex, targetIndex);
    onReorder(next);
  }

  return (
    <ul className="space-y-2 w-full min-w-0">
      {items.map((item, i) => {
        const label = getLabel(item);
        const key = getKey(item);
        const secondary = getSecondaryLabel?.(item);
        const details = renderDetails?.(item);
        const moveButtons = (
          <div className="flex shrink-0 items-center gap-0.5 self-start">
            <button
              type="button"
              onClick={() => onMove(i, -1)}
              disabled={i === 0}
              className="ui-icon-btn--compact border border-transparent text-base text-muted hover:border-white/15 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
              aria-label={`Move ${label} up`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(i, 1)}
              disabled={i === items.length - 1}
              className="ui-icon-btn--compact border border-transparent text-base text-muted hover:border-white/15 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
              aria-label={`Move ${label} down`}
            >
              ↓
            </button>
          </div>
        );
        return (
          <li
            key={key}
            className={`rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:border-white/15 ${
              details ? '' : 'flex items-center gap-3'
            } ${draggingKey === key ? 'border-white/20 opacity-80' : ''}`}
            draggable
            onDragStart={() => setDraggingKey(key)}
            onDragEnd={() => setDraggingKey(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              reorderTo(i);
              setDraggingKey(null);
            }}
            aria-label={`Rank ${i + 1}: ${label}${secondary ? `, ${secondary}` : ''}`}
          >
            {details ? (
              <div className="flex items-start gap-3">
                <RankDragHandle />
                <span className="w-5 shrink-0 pt-0.5 text-xs tabular-nums text-muted">{i + 1}</span>
                {getLeadingVisual && (
                  <span className="inline-flex shrink-0 items-center justify-center pt-0.5">
                    {getLeadingVisual(item)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-white ${
                          emphasizeLabel ? 'text-base font-semibold' : 'text-sm font-medium'
                        }`}
                      >
                        {label}
                      </div>
                      {secondary && <div className="text-xs text-muted">{secondary}</div>}
                    </div>
                    {moveButtons}
                  </div>
                  {details}
                </div>
              </div>
            ) : (
              <>
                <RankDragHandle />
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted">{i + 1}</span>
                {getLeadingVisual && (
                  <span className="inline-flex shrink-0 items-center justify-center">
                    {getLeadingVisual(item)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-white ${
                      emphasizeLabel ? 'text-base font-semibold' : 'text-sm font-medium'
                    }`}
                  >
                    {label}
                  </div>
                  {secondary && <div className="truncate text-xs text-muted">{secondary}</div>}
                </div>
                {moveButtons}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatGroupIcons({ stats }: { stats: Stat[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {stats.map((stat) => (
        <StatIcon key={stat} stat={stat} size="sm" variant="glyph" />
      ))}
    </span>
  );
}

function ArchetypePairIcons({
  archetype,
  size = 'sm',
}: {
  archetype: Archetype;
  size?: 'sm' | 'md';
}) {
  const [primary, secondary] = ARCHETYPE_STATS[archetype];
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      <StatIcon stat={primary} size={size} variant="glyph" />
      <StatIcon stat={secondary} size={size} variant="glyph" />
    </span>
  );
}

function CalibrateInstructionChip({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-white/90 ${className}`}
    >
      {children}
    </span>
  );
}

function CalibrateRollRankInstruction({
  archetype,
  archetypeIndex,
  archetypeCount,
  role,
  vaultStats,
}: {
  archetype: Archetype;
  archetypeIndex: number;
  archetypeCount: number;
  role: 'tertiary' | 'tuning';
  vaultStats: Stat[];
}) {
  const roleLabel = role === 'tertiary' ? 'tertiary stats' : 'tuning stats';
  const vaultStatLabels = vaultStats.map((stat) => STAT_LABELS[stat]).join(', ');
  const progressLabel =
    archetypeCount > 1 ? `${archetypeIndex + 1} of ${archetypeCount} archetypes` : '';
  const contextSummary = `${ARCHETYPE_LABELS[archetype]}${progressLabel ? `, ${progressLabel}` : ''}`;
  const ariaLabel =
    vaultStats.length > 0
      ? `${contextSummary}. Rank ${roleLabel}: ${vaultStatLabels}.`
      : `${contextSummary}. Rank ${roleLabel}.`;

  return (
    <div className="space-y-2" aria-label={ariaLabel}>
      <div className="flex flex-wrap items-center gap-2">
        <CalibrateInstructionChip>
          <ArchetypePairIcons archetype={archetype} size="sm" />
          <span className="font-medium">{ARCHETYPE_LABELS[archetype]}</span>
        </CalibrateInstructionChip>
        {archetypeCount > 1 && (
          <CalibrateInstructionChip className="tabular-nums text-xs text-muted">
            {archetypeIndex + 1}/{archetypeCount}
          </CalibrateInstructionChip>
        )}
      </div>
      {vaultStats.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="shrink-0 text-xs font-medium text-muted">Rank these stats:</span>
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {vaultStats.map((stat) => (
              <span key={stat} className="inline-flex items-center gap-1 text-neutral-300">
                <StatIcon stat={stat} size="sm" variant="glyph" />
                <span className="text-xs">{STAT_LABELS[stat]}</span>
              </span>
            ))}
          </span>
        </div>
      )}
      <p className="text-xs text-muted">
        Drag rows or use the arrows. Most important at the top.
      </p>
    </div>
  );
}

