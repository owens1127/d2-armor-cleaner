import { describe, expect, it } from 'vitest';
import { ARMOR_SLOTS } from '@/lib/constants';
import { createAutoFilterRule } from '@/lib/auto-filter/match';
import { analyzeDesiredBuilds } from '@/lib/coverage/analyze';
import { encodeDesiredBuildId } from '@/lib/coverage/builds';
import { groupIntoBuckets } from '@/lib/dupes/group';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { buildClassVaultState } from '@/lib/dupes/suggest';
import {
  buildBuildInsightActions,
  buildCalibrationInsightAction,
  buildSetupAutoFiltersInsightAction,
  buildVaultInsightActions,
  hasConfiguredAutoFilters,
} from '@/lib/dashboard/vaultInsightsActions';
import { recordCalibrationChoice } from '@/lib/prefs/calibrationChoices';
import { calibrationKeyArchetypeOrder } from '@/lib/onboarding/calibrateSession';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import { armorPiece, fullBrawlerVault } from '@/test/armorFixtures';

function meleeBuild() {
  return {
    id: 'melee',
    name: 'Melee stack',
    mode: 'priority' as const,
    enabled: true,
    statTargets: [
      { stat: 'melee' as const, target: 200 },
      { stat: 'super' as const, target: 150 },
    ],
  };
}

describe('vault insight actions across user steps', () => {
  const completeOnboarding = { onboardingComplete: true, inProgressOnboarding: false };

  it('always surfaces a calibration action with class-scoped calibrate link', () => {
    const prefs = defaultClassPreferenceProfile();
    const action = buildCalibrationInsightAction(prefs, 'hunter', completeOnboarding);
    expect(action).toMatchObject({
      id: 'calibration',
      to: '/onboarding/calibrate?class=hunter',
    });

    let calibrated = prefs;
    for (let i = 0; i < 15; i++) {
      calibrated = recordCalibrationChoice(calibrated, `${calibrationKeyArchetypeOrder()}:${i}`);
    }
    calibrated = { ...calibrated, calibratedAt: Date.now() };
    expect(buildCalibrationInsightAction(calibrated, 'hunter', completeOnboarding)).toMatchObject({
      id: 'calibration',
      title: 'Recalibrate preferences',
      cta: 'Recalibrate',
    });
  });

  it('steps from setup nudge → coverage fix → browse → ready with navigation targets', () => {
    let prefs = defaultClassPreferenceProfile();
    const sparse = [armorPiece({ instanceId: '1', armorSlot: 'chest' })];
    let buckets = groupIntoBuckets(sparse, mergeDupeRules());

    let buildActions = buildBuildInsightActions(sparse, buckets, prefs, 'hunter');
    expect(buildActions[0]).toMatchObject({
      id: 'no-desired-builds',
      to: '/combos/hunter#combos',
      cta: 'Set up combos',
    });
    expect(buildActions[1]).toMatchObject(buildSetupAutoFiltersInsightAction());

    prefs = { ...prefs, desiredBuilds: [meleeBuild()] };
    buildActions = buildBuildInsightActions(sparse, buckets, prefs, 'hunter');
    const meleeId = encodeDesiredBuildId(meleeBuild(), 'hunter');
    expect(buildActions.map((a) => a.id)).toEqual([
      'add-desired-builds',
      'setup-auto-filters',
      `fix-coverage-${meleeId}`,
    ]);
    expect(buildActions.find((a) => a.id === `fix-coverage-${meleeId}`)).toMatchObject({
      to: `/combos/hunter?build=${encodeURIComponent(meleeId)}`,
      cta: 'Open Combos',
    });
    expect(buildActions.find((a) => a.id === `browse-build-${meleeId}`)).toBeUndefined();

    const fullVault = fullBrawlerVault();
    buckets = groupIntoBuckets(fullVault, mergeDupeRules());
    buildActions = buildBuildInsightActions(fullVault, buckets, prefs, 'hunter');
    expect(buildActions.map((a) => a.id)).toEqual(['add-desired-builds', 'setup-auto-filters']);

    prefs = {
      ...prefs,
      desiredBuilds: [
        meleeBuild(),
        {
          ...meleeBuild(),
          id: 'melee-2',
          name: 'Melee stack B',
          statTargets: [
            { stat: 'melee' as const, target: 180 },
            { stat: 'super' as const, target: 150 },
          ],
        },
        {
          ...meleeBuild(),
          id: 'melee-3',
          name: 'Melee stack C',
          statTargets: [
            { stat: 'melee' as const, target: 160 },
            { stat: 'super' as const, target: 150 },
          ],
        },
      ],
    };
    buildActions = buildBuildInsightActions(fullVault, buckets, prefs, 'hunter', [
      createAutoFilterRule({ classType: 'hunter' }),
    ]);
    expect(buildActions).toHaveLength(0);

    const analyses = analyzeDesiredBuilds(fullVault, buckets, prefs, 'hunter');
    expect(analyses.every((a) => a.buildReady)).toBe(true);
  });

  it('includes dupe compare action with duel route when heavy buckets exist', () => {
    const prefs = defaultClassPreferenceProfile();
    prefs.desiredBuilds = [
      meleeBuild(),
      {
        ...meleeBuild(),
        id: 'melee-2',
        name: 'Melee stack B',
        statTargets: [
          { stat: 'melee' as const, target: 180 },
          { stat: 'super' as const, target: 150 },
        ],
      },
      {
        ...meleeBuild(),
        id: 'melee-3',
        name: 'Melee stack C',
        statTargets: [
          { stat: 'melee' as const, target: 160 },
          { stat: 'super' as const, target: 150 },
        ],
      },
    ];

    const dupes = ARMOR_SLOTS.flatMap((armorSlot) =>
      [0, 1, 2].map((n) =>
        armorPiece({
          instanceId: `${armorSlot}-${n}`,
          armorSlot,
          archetype: 'gunner',
          tertiaryStat: 'super',
          tuningStat: 'weapons',
        }),
      ),
    );
    const classState = buildClassVaultState('hunter', dupes, mergeDupeRules());
    const actions = buildVaultInsightActions({
      classState,
      classType: 'hunter',
      prefs,
      redundantRollCount: 4,
      pendingTags: [],
      bucketJunkedIds: [],
      calibrationContext: completeOnboarding,
    });

    const compare = actions.find((a) => a.id === 'largest-dupe');
    expect(compare).toMatchObject({
      cta: 'Compare this group',
    });
    expect(compare?.to).toContain('/duel/hunter');

    expect(actions.filter((a) => a.id === 'calibration')).toHaveLength(1);
    expect(actions.at(-1)?.id).toBe('calibration');

    const comboIdx = actions.findIndex((a) => a.id === 'no-desired-builds' || a.id.startsWith('add-'));
    const filterIdx = actions.findIndex((a) => a.id === 'setup-auto-filters');
    if (comboIdx >= 0 && filterIdx >= 0) {
      expect(filterIdx).toBeGreaterThan(comboIdx);
    }
  });

  it('omits auto-filter nudge when enabled rules exist', () => {
    expect(hasConfiguredAutoFilters([])).toBe(false);
    expect(
      hasConfiguredAutoFilters([createAutoFilterRule({ classType: 'hunter', enabled: false })]),
    ).toBe(false);
    expect(hasConfiguredAutoFilters([createAutoFilterRule({ classType: 'hunter' })])).toBe(true);

    const sparse = [armorPiece({ instanceId: '1', armorSlot: 'chest' })];
    const buckets = groupIntoBuckets(sparse, mergeDupeRules());
    const prefs = defaultClassPreferenceProfile();
    const withFilters = buildBuildInsightActions(sparse, buckets, prefs, 'hunter', [
      createAutoFilterRule({ classType: 'hunter' }),
    ]);
    expect(withFilters.some((a) => a.id === 'setup-auto-filters')).toBe(false);
  });
});
