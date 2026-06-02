import { CLASSES, STATS } from '@/lib/constants';
import { normalizeAutoFilterRules } from '@/lib/auto-filter/match';
import { normalizeDesiredBuilds } from '@/lib/coverage/builds';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { normalizeCalibrationChoices } from '@/lib/prefs/calibrationChoices';
import { normalizeTertiaryWeights } from '@/lib/prefs/tertiaryWeights';
import { normalizeTuningWeights } from '@/lib/prefs/tuningWeights';
import type {
  Archetype,
  ClassPreferenceProfile,
  ClassType,
  DupeRuleConfig,
  PreferenceProfile,
  Stat,
  VaultKeepPreference,
} from '@/types';

export function defaultClassPreferenceProfile(): ClassPreferenceProfile {
  const statWeights = Object.fromEntries(
    STATS.map((s) => [s, s === 'weapons' || s === 'grenade' ? 1 : 0.5]),
  ) as Record<Stat, number>;

  const archetypeWeights = Object.fromEntries(
    (['gunner', 'grenadier', 'paragon', 'brawler', 'bulwark', 'specialist'] as Archetype[]).map(
      (a) => [a, a === 'gunner' || a === 'grenadier' ? 1 : 0.6],
    ),
  ) as Record<Archetype, number>;

  return {
    calibrationChoices: {},
    statWeights,
    archetypeWeights,
    tertiaryWeights: {},
    tuningWeights: {},
    setWeights: {},
    setCompletionBonus: 0.5,
    desiredBuilds: [],
  };
}

function defaultDupeRules(): DupeRuleConfig {
  return {
    minTier: 5,
    sameArmorSet: false,
    sameTuningStat: false,
    ignoreTaggedInfuse: true,
    ignoreTaggedJunk: true,
    ignoreTaggedKeep: true,
    ignoreTaggedFavorite: true,
    ignoreTaggedArchive: true,
    filterArmorSetHashes: [],
  };
}

export function defaultPreferenceProfile(): PreferenceProfile {
  return {
    version: 2,
    classPrefs: Object.fromEntries(
      CLASSES.map((c) => [c, defaultClassPreferenceProfile()]),
    ) as Record<ClassType, ClassPreferenceProfile>,
    defaultDupeRules: defaultDupeRules(),
    autoFilterRules: [],
  };
}

function stripLegacyRedundantPrefs(profile: PreferenceProfile): PreferenceProfile {
  if (
    profile.redundantGroupBySet === undefined &&
    profile.redundantGroupByTuning === undefined
  ) {
    return profile;
  }
  const { redundantGroupBySet: _s, redundantGroupByTuning: _t, ...rest } = profile;
  return rest;
}

export function getClassPrefs(
  profile: PreferenceProfile,
  classType: ClassType,
): ClassPreferenceProfile {
  return profile.classPrefs[classType] ?? defaultClassPreferenceProfile();
}

export function updateClassPrefs(
  profile: PreferenceProfile,
  classType: ClassType,
  fn: (prefs: ClassPreferenceProfile) => ClassPreferenceProfile,
): PreferenceProfile {
  return {
    ...profile,
    classPrefs: {
      ...profile.classPrefs,
      [classType]: fn(getClassPrefs(profile, classType)),
    },
  };
}

/** Reset one class to the empty/default preference profile. */
export function resetClassPrefs(
  profile: PreferenceProfile,
  classType: ClassType,
): PreferenceProfile {
  return updateClassPrefs(profile, classType, () => defaultClassPreferenceProfile());
}

/** Reset all classes to the empty/default preference profile; keeps dupe rules and other profile fields. */
export function resetAllClassPrefs(profile: PreferenceProfile): PreferenceProfile {
  return {
    ...profile,
    classPrefs: Object.fromEntries(
      CLASSES.map((c) => [c, defaultClassPreferenceProfile()]),
    ) as Record<ClassType, ClassPreferenceProfile>,
  };
}

function mergeClassPrefPartial(
  base: ClassPreferenceProfile,
  partial: Partial<ClassPreferenceProfile> & { buildMode?: unknown },
  classType: ClassType,
): ClassPreferenceProfile {
  const { buildMode: _legacyBuildMode, ...rest } = partial;
  return {
    ...base,
    ...rest,
    statWeights: { ...base.statWeights, ...rest.statWeights },
    archetypeWeights: { ...base.archetypeWeights, ...rest.archetypeWeights },
    tertiaryWeights: rest.tertiaryWeights
      ? normalizeTertiaryWeights(rest.tertiaryWeights)
      : base.tertiaryWeights,
    tuningWeights: rest.tuningWeights
      ? normalizeTuningWeights(rest.tuningWeights)
      : base.tuningWeights,
    setWeights: { ...base.setWeights, ...rest.setWeights },
    calibrationChoices: rest.calibrationChoices ?? base.calibrationChoices,
    desiredBuilds:
      rest.desiredBuilds !== undefined
        ? normalizeDesiredBuilds(rest.desiredBuilds, classType)
        : base.desiredBuilds,
  };
}

/** v1 root-level fields before per-class storage. */
interface LegacyPreferenceFields {
  version?: number;
  calibratedAt?: number;
  calibrationCount?: number;
  calibrationChoices?: Record<string, { key: string; recordedAt?: number }>;
  statWeights?: Partial<Record<Stat, number>>;
  archetypeWeights?: Partial<Record<Archetype, number>>;
  tertiaryWeights?: ClassPreferenceProfile['tertiaryWeights'];
  tuningWeights?: ClassPreferenceProfile['tuningWeights'];
  setWeights?: Record<number, number>;
  setCompletionBonus?: number;
  defaultDupeRules?: Partial<DupeRuleConfig>;
  redundantGroupBySet?: boolean;
  redundantGroupByTuning?: boolean;
  autoFilterRules?: unknown;
  classOverrides?: Partial<Record<ClassType, Partial<ClassPreferenceProfile>>>;
  classPrefs?: Partial<Record<ClassType, Partial<ClassPreferenceProfile>>>;
  vaultKeepPreference?: VaultKeepPreference;
}

function extractLegacyGlobalPrefs(raw: LegacyPreferenceFields): ClassPreferenceProfile {
  const base = defaultClassPreferenceProfile();
  const choices =
    raw.calibrationChoices !== undefined
      ? normalizeCalibrationChoices(raw.calibrationChoices)
      : undefined;
  return mergeClassPrefPartial(base, {
    calibratedAt: raw.calibratedAt,
    ...(choices !== undefined ? { calibrationChoices: choices } : {}),
    statWeights: raw.statWeights as Record<Stat, number> | undefined,
    archetypeWeights: raw.archetypeWeights as Record<Archetype, number> | undefined,
    tertiaryWeights: raw.tertiaryWeights
      ? normalizeTertiaryWeights(raw.tertiaryWeights)
      : undefined,
    tuningWeights: raw.tuningWeights ? normalizeTuningWeights(raw.tuningWeights) : undefined,
    setWeights: raw.setWeights,
    setCompletionBonus: raw.setCompletionBonus,
  }, 'hunter');
}

export function migrateProfile(raw: unknown): PreferenceProfile {
  const base = defaultPreferenceProfile();
  if (!raw || typeof raw !== 'object') return base;

  const data = raw as LegacyPreferenceFields;

  if ((data.version ?? 0) >= 2 && data.classPrefs) {
    const classPrefs = { ...base.classPrefs };
    for (const c of CLASSES) {
      if (data.classPrefs[c]) {
        const partial = data.classPrefs[c]!;
        const mergePartial: Partial<ClassPreferenceProfile> = { ...partial };
        if (partial.calibrationChoices !== undefined) {
          mergePartial.calibrationChoices = normalizeCalibrationChoices(partial.calibrationChoices);
        }
        classPrefs[c] = mergeClassPrefPartial(base.classPrefs[c], mergePartial, c);
      }
    }
    const vaultKeepPreference =
      data.vaultKeepPreference === 'lean' ||
      data.vaultKeepPreference === 'balanced' ||
      data.vaultKeepPreference === 'options' ||
      data.vaultKeepPreference === 'hoarder'
        ? data.vaultKeepPreference
        : undefined;
    return stripLegacyRedundantPrefs({
      version: 2,
      classPrefs,
      defaultDupeRules: mergeDupeRules(data.defaultDupeRules),
      autoFilterRules: normalizeAutoFilterRules(data.autoFilterRules ?? base.autoFilterRules),
      ...(vaultKeepPreference ? { vaultKeepPreference } : {}),
    });
  }

  const globalPref = extractLegacyGlobalPrefs(data);
  const classPrefs = Object.fromEntries(
    CLASSES.map((c) => {
      const override = data.classOverrides?.[c];
      return [
        c,
        override ? mergeClassPrefPartial(globalPref, override, c) : { ...globalPref },
      ];
    }),
  ) as Record<ClassType, ClassPreferenceProfile>;

  return stripLegacyRedundantPrefs({
    version: 2,
    classPrefs,
    defaultDupeRules: data.defaultDupeRules
      ? mergeDupeRules(data.defaultDupeRules)
      : base.defaultDupeRules,
    autoFilterRules: normalizeAutoFilterRules(data.autoFilterRules ?? base.autoFilterRules),
  });
}
