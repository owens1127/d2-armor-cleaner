import { ARMOR_SLOTS, STAT_LABELS, STATS } from '@/lib/constants';
import {
  decodeBuildId,
  encodeDesiredBuildId,
  isEncodedBuildId,
} from '@/lib/coverage/buildIdCodec';
import { formatSetBonusBuildNameSuffix } from '@/lib/coverage/setBonus';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import type {
  ArmorPiece,
  ArmorSlot,
  BuildTargetMode,
  ClassPreferenceProfile,
  ClassType,
  DesiredBuild,
  Stat,
  StatTarget,
} from '@/types';

export {
  decodeBuildId,
  encodeBuildId,
  encodeDesiredBuildId,
  isEncodedBuildId,
  type BuildIdDefinition,
} from '@/lib/coverage/buildIdCodec';

const ARMOR_SLOT_SET = new Set<ArmorSlot>(ARMOR_SLOTS);

export function normalizeSlotRepresentatives(
  raw: unknown,
): Partial<Record<ArmorSlot, string>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<ArmorSlot, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ARMOR_SLOT_SET.has(key as ArmorSlot)) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    out[key as ArmorSlot] = value.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeTuningRepresentatives(
  raw: unknown,
): Partial<Record<Stat, string>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<Stat, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isStat(key)) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    out[key] = value.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Keys are `archetype:tertiary:tuning` (archetype may be `any`). */
export function normalizeRollPatternRepresentatives(
  raw: unknown,
): Partial<Record<string, string>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<string, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key.includes(':')) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    out[key] = value.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Nested pattern key → armor slot → instance id. */
export function normalizeRollPatternSlotRepresentatives(
  raw: unknown,
): Partial<Record<string, Partial<Record<ArmorSlot, string>>>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<string, Partial<Record<ArmorSlot, string>>>> = {};
  for (const [patternKey, slotMap] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof patternKey !== 'string' || !patternKey.includes(':')) continue;
    if (!slotMap || typeof slotMap !== 'object') continue;
    const slots = normalizeSlotRepresentatives(slotMap);
    if (!slots) continue;
    out[patternKey] = slots;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const STAT_TARGET_MIN = 10;
export const STAT_TARGET_MAX = 200;
/** Community triple-stat / quad-stat tier totals (armor-only, mods extra). */
export const PRIORITY_TARGET_DEFAULTS = [200, 150, 100, 80] as const;
export const MIN_STAT_PRIORITIES = 2;
export const MAX_STAT_PRIORITIES = 4;
/** Recommended number of enabled stat-priority lists per class for vault insights. */
export const RECOMMENDED_DESIRED_BUILD_COUNT = 3;

export type DesiredBuildIdentity = Pick<
  DesiredBuild,
  'statTargets' | 'targetsMode' | 'mode' | 'setBonus2pc' | 'setBonus4pc' | 'enabled'
>;

export function assignEncodedBuildId(
  build: DesiredBuild,
  classType: ClassType,
  previousId?: string,
): DesiredBuild {
  const id = encodeDesiredBuildId(build, classType);
  if (build.id === id && !previousId) return build;

  const aliasSource =
    previousId && previousId !== id
      ? previousId
      : build.id && build.id !== id
        ? build.id
        : undefined;
  const legacyId =
    aliasSource && !isEncodedBuildId(aliasSource)
      ? build.legacyId && build.legacyId !== id
        ? build.legacyId
        : aliasSource
      : build.legacyId;

  return {
    ...build,
    id,
    ...(legacyId && legacyId !== id ? { legacyId } : {}),
  };
}

function finalizeDesiredBuildId(
  build: DesiredBuild,
  classType: ClassType,
  storedId?: string,
): DesiredBuild {
  const draft = storedId ? { ...build, id: storedId } : build;
  if (storedId && !isEncodedBuildId(storedId)) {
    return assignEncodedBuildId(draft, classType, storedId);
  }
  return assignEncodedBuildId(draft, classType);
}

function uniqueDefaultStatTargets(
  prefs: ClassPreferenceProfile,
  existing: readonly DesiredBuild[],
  targetsMode: 'tier' | 'custom',
  classType: ClassType,
): StatTarget[] {
  const ranked = [...STATS].sort(
    (a, b) => (prefs.statWeights[b] ?? 0) - (prefs.statWeights[a] ?? 0),
  );
  for (let i = 0; i < ranked.length - 1; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const statTargets: StatTarget[] = [
        { stat: ranked[i]!, target: PRIORITY_TARGET_DEFAULTS[0] },
        { stat: ranked[j]!, target: PRIORITY_TARGET_DEFAULTS[1] },
      ];
      const candidate: DesiredBuildIdentity = { statTargets, targetsMode, enabled: true };
      const id = encodeDesiredBuildId(candidate, classType);
      if (!existing.some((b) => encodeDesiredBuildId(b, classType) === id)) {
        return statTargets;
      }
    }
  }
  const fallback = defaultStatTargetsFromPrefs(prefs).slice(0, MIN_STAT_PRIORITIES);
  const last = fallback[fallback.length - 1];
  if (last) {
    fallback[fallback.length - 1] = {
      ...last,
      target: Math.max(STAT_TARGET_MIN, last.target - 1),
    };
  }
  return fallback;
}
/** @deprecated Use MAX_STAT_PRIORITIES */
export const MAX_PRIORITY_TARGETS = MAX_STAT_PRIORITIES;
/** @deprecated Use MAX_STAT_PRIORITIES */
export const MAX_CUSTOM_TARGETS = MAX_STAT_PRIORITIES;

export interface BuildProfile {
  id: string;
  label: string;
  statTargets: StatTarget[];
  targetsMode?: 'tier' | 'custom';
  /** Source desired build id when resolved from prefs. */
  desiredBuildId?: string;
  /** Optional armor set bonus targets for loadout recommendations. */
  setBonus2pc?: number;
  /** Second set for a 2+2 mix, or same as setBonus2pc for a 4pc single-set target. */
  setBonus4pc?: number;
}

export function normalizeArmorSetHash(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

const LEGACY_PRESET_STATS: Record<string, [Stat, Stat]> = {
  melee_super: ['melee', 'super'],
  grenade_super: ['grenade', 'super'],
  melee_grenade: ['melee', 'grenade'],
  weapons_class: ['weapons', 'class'],
  health_class: ['health', 'class'],
};

function isStat(value: unknown): value is Stat {
  return typeof value === 'string' && STATS.includes(value as Stat);
}

export function clampStatTarget(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(STAT_TARGET_MAX, Math.max(STAT_TARGET_MIN, Math.round(n)));
}

function normalizeStatTarget(raw: unknown, defaultTarget: number): StatTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (!isStat(data.stat)) return null;
  return {
    stat: data.stat,
    target: clampStatTarget(data.target, defaultTarget),
  };
}

function normalizeStatTargets(
  raw: unknown,
  targetsMode: 'tier' | 'custom',
): StatTarget[] {
  if (!Array.isArray(raw)) return [];
  const defaults = [...PRIORITY_TARGET_DEFAULTS];
  const targets: StatTarget[] = [];
  const seen = new Set<Stat>();
  for (let i = 0; i < raw.length && targets.length < MAX_STAT_PRIORITIES; i++) {
    const fallback =
      targetsMode === 'custom' ? (defaults[i] ?? 100) : (defaults[i] ?? 80);
    const entry = normalizeStatTarget(raw[i], fallback);
    if (!entry || seen.has(entry.stat)) continue;
    seen.add(entry.stat);
    targets.push(entry);
  }
  return targets;
}

function normalizeTargetsMode(
  data: Record<string, unknown>,
  mode: BuildTargetMode,
): 'tier' | 'custom' {
  if (data.targetsMode === 'custom' || data.targetsMode === 'tier') {
    return data.targetsMode;
  }
  return mode === 'custom' ? 'custom' : 'tier';
}

function normalizeMode(raw: unknown): BuildTargetMode {
  return raw === 'custom' ? 'custom' : 'priority';
}

function migrateLegacyBuild(data: Record<string, unknown>): Omit<DesiredBuild, 'id'> | null {
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null;
  if (!name) return null;

  const preset = typeof data.preset === 'string' ? data.preset : null;
  if (preset === 'calibrated') return null;

  let stats: Stat[] | undefined;
  if (preset === 'custom' && Array.isArray(data.focusStats)) {
    stats = data.focusStats.filter(isStat);
  } else if (preset && preset in LEGACY_PRESET_STATS) {
    stats = [...LEGACY_PRESET_STATS[preset]];
  }

  if (!stats || stats.length === 0) return null;

  const statTargets: StatTarget[] = stats
    .slice(0, MAX_STAT_PRIORITIES)
    .map((stat, i) => ({
      stat,
      target: PRIORITY_TARGET_DEFAULTS[i] ?? 80,
    }));

  if (statTargets.length < MIN_STAT_PRIORITIES) return null;

  return {
    name,
    mode: 'priority',
    targetsMode: 'tier',
    statTargets,
    enabled: data.enabled !== false,
  };
}

/** Resolve a saved build or decode a shareable combo id for the active class. */
export function resolveDesiredBuildFromParam(
  buildParam: string | null,
  classType: ClassType,
  savedBuilds: readonly DesiredBuild[],
): DesiredBuild | null {
  if (!buildParam) return null;
  const saved = savedBuilds.find((b) => b.id === buildParam || b.legacyId === buildParam);
  if (saved) return saved;
  const decoded = decodeBuildId(buildParam);
  if (!decoded || decoded.classType !== classType) return null;
  return {
    id: buildParam,
    name: defaultBuildNameFromStatTargets(decoded.statTargets),
    mode: decoded.targetsMode === 'custom' ? 'custom' : 'priority',
    targetsMode: decoded.targetsMode,
    statTargets: decoded.statTargets,
    enabled: decoded.enabled,
    ...(decoded.setBonus2pc !== undefined ? { setBonus2pc: decoded.setBonus2pc } : {}),
    ...(decoded.setBonus4pc !== undefined ? { setBonus4pc: decoded.setBonus4pc } : {}),
  };
}

export function defaultStatTargetsFromPrefs(prefs: ClassPreferenceProfile): StatTarget[] {
  const ranked = [...STATS].sort(
    (a, b) => (prefs.statWeights[b] ?? 0) - (prefs.statWeights[a] ?? 0),
  );
  return [
    { stat: ranked[0], target: PRIORITY_TARGET_DEFAULTS[0] },
    { stat: ranked[1], target: PRIORITY_TARGET_DEFAULTS[1] },
  ];
}

export function normalizeDesiredBuild(
  raw: unknown,
  classType: ClassType,
): DesiredBuild | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  if ('preset' in data && typeof data.preset === 'string') {
    const migrated = migrateLegacyBuild(data);
    if (!migrated) return null;
    const storedId =
      typeof data.id === 'string' && data.id.trim() ? data.id.trim() : undefined;
    return finalizeDesiredBuildId({ ...migrated, id: '' }, classType, storedId);
  }

  const storedId =
    typeof data.id === 'string' && data.id.trim() ? data.id.trim() : undefined;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null;
  if (!name) return null;

  const mode = normalizeMode(data.mode);
  const targetsMode = normalizeTargetsMode(data, mode);
  const statTargets = normalizeStatTargets(data.statTargets, targetsMode);
  if (statTargets.length < MIN_STAT_PRIORITIES) return null;

  const setBonus2pc = normalizeArmorSetHash(data.setBonus2pc);
  const setBonus4pc = normalizeArmorSetHash(data.setBonus4pc);
  const slotRepresentatives = normalizeSlotRepresentatives(data.slotRepresentatives);
  const tuningRepresentatives = normalizeTuningRepresentatives(data.tuningRepresentatives);
  const rollPatternRepresentatives = normalizeRollPatternRepresentatives(
    data.rollPatternRepresentatives,
  );
  const rollPatternSlotRepresentatives = normalizeRollPatternSlotRepresentatives(
    data.rollPatternSlotRepresentatives,
  );

  return finalizeDesiredBuildId(
    {
      id: '',
      name,
      mode,
      targetsMode,
      statTargets,
      ...(setBonus2pc !== undefined ? { setBonus2pc } : {}),
      ...(setBonus4pc !== undefined ? { setBonus4pc } : {}),
      ...(slotRepresentatives ? { slotRepresentatives } : {}),
      ...(rollPatternRepresentatives ? { rollPatternRepresentatives } : {}),
      ...(rollPatternSlotRepresentatives ? { rollPatternSlotRepresentatives } : {}),
      ...(tuningRepresentatives ? { tuningRepresentatives } : {}),
      enabled: data.enabled !== false,
      ...(typeof data.legacyId === 'string' && data.legacyId.trim()
        ? { legacyId: data.legacyId.trim() }
        : {}),
    },
    classType,
    storedId,
  );
}

export function normalizeDesiredBuilds(
  raw: unknown,
  classType: ClassType,
): DesiredBuild[] {
  if (!Array.isArray(raw)) return [];
  const builds: DesiredBuild[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const build = normalizeDesiredBuild(entry, classType);
    if (!build || seen.has(build.id)) continue;
    seen.add(build.id);
    builds.push(build);
  }
  return builds.slice(0, 8);
}

export function getDesiredBuilds(
  prefs: ClassPreferenceProfile,
  classType: ClassType,
): DesiredBuild[] {
  return normalizeDesiredBuilds(prefs.desiredBuilds, classType).filter(
    (b) => b.enabled !== false,
  );
}

export function buildProfileFromPrefs(prefs: ClassPreferenceProfile): BuildProfile {
  const statTargets = defaultStatTargetsFromPrefs(prefs);
  const label = statTargets
    .map(({ stat }) => STAT_LABELS[stat])
    .join(' · ');
  return { id: 'top-stats', label, statTargets };
}

export function resolveDesiredBuild(
  build: DesiredBuild,
  _prefs: ClassPreferenceProfile,
): BuildProfile {
  const targetsMode =
    build.targetsMode ?? (build.mode === 'custom' ? 'custom' : 'tier');
  return {
    id: build.id,
    desiredBuildId: build.id,
    label: build.name,
    statTargets: build.statTargets,
    targetsMode,
    setBonus2pc: build.setBonus2pc,
    setBonus4pc: build.setBonus4pc,
  };
}

export function resolveBuildProfile(
  buildId: string,
  prefs?: ClassPreferenceProfile,
  classType: ClassType = 'hunter',
): BuildProfile {
  if (prefs) {
    const desired = getDesiredBuilds(prefs, classType).find(
      (b) => b.id === buildId || b.legacyId === buildId,
    );
    if (desired) return resolveDesiredBuild(desired, prefs);
    const decoded = decodeBuildId(buildId);
    if (decoded && decoded.classType === classType) {
      return resolveDesiredBuild(
        {
          id: buildId,
          name: defaultBuildNameFromStatTargets(decoded.statTargets),
          mode: decoded.targetsMode === 'custom' ? 'custom' : 'priority',
          targetsMode: decoded.targetsMode,
          statTargets: decoded.statTargets,
          enabled: decoded.enabled,
          ...(decoded.setBonus2pc !== undefined ? { setBonus2pc: decoded.setBonus2pc } : {}),
          ...(decoded.setBonus4pc !== undefined ? { setBonus4pc: decoded.setBonus4pc } : {}),
        },
        prefs,
      );
    }
  }
  return buildProfileFromPrefs(prefs ?? defaultClassPreferenceProfile());
}

export function formatStatTargetsLabel(targets: StatTarget[]): string {
  return targets.map(({ stat }) => STAT_LABELS[stat]).join(' → ');
}

/** Legacy default before stat-derived names. */
export const LEGACY_DEFAULT_BUILD_NAME = 'New build';

/** Slash-separated stat labels, e.g. `Weapons/Super/Grenade`. */
export function defaultBuildNameFromStatTargets(targets: StatTarget[]): string {
  if (targets.length === 0) return LEGACY_DEFAULT_BUILD_NAME;
  return targets.map(({ stat }) => STAT_LABELS[stat]).join('/');
}

/** Auto-generated combo name from stat priorities and optional set bonus targets. */
export function defaultBuildName(
  targets: StatTarget[],
  setBonus2pc?: number,
  setBonus4pc?: number,
  items?: ArmorPiece[],
): string {
  const statPart = defaultBuildNameFromStatTargets(targets);
  const setSuffix = formatSetBonusBuildNameSuffix(setBonus2pc, setBonus4pc, items ?? []);
  if (!setSuffix) return statPart;
  return `${statPart} · ${setSuffix}`;
}

export function shouldSyncBuildNameToStats(
  currentName: string,
  previousTargets: StatTarget[],
  previousSetBonus2pc?: number,
  previousSetBonus4pc?: number,
  items?: ArmorPiece[],
): boolean {
  const trimmed = currentName.trim();
  if (trimmed === LEGACY_DEFAULT_BUILD_NAME) return true;
  return (
    trimmed ===
    defaultBuildName(previousTargets, previousSetBonus2pc, previousSetBonus4pc, items)
  );
}

/** When the name still matches auto/legacy defaults, return the new auto name. */
export function buildNameForStatTargetChange(
  currentName: string,
  previousTargets: StatTarget[],
  nextTargets: StatTarget[],
  setBonus2pc?: number,
  setBonus4pc?: number,
  items?: ArmorPiece[],
): string | undefined {
  if (
    !shouldSyncBuildNameToStats(
      currentName,
      previousTargets,
      setBonus2pc,
      setBonus4pc,
      items,
    )
  ) {
    return undefined;
  }
  return defaultBuildName(nextTargets, setBonus2pc, setBonus4pc, items);
}

/** When the name still matches auto/legacy defaults, return the new auto name. */
export function buildNameForSetBonusChange(
  currentName: string,
  build: Pick<DesiredBuild, 'statTargets' | 'setBonus2pc' | 'setBonus4pc'>,
  nextSetBonus2pc?: number,
  nextSetBonus4pc?: number,
  items?: ArmorPiece[],
): string | undefined {
  if (
    !shouldSyncBuildNameToStats(
      currentName,
      build.statTargets,
      build.setBonus2pc,
      build.setBonus4pc,
      items,
    )
  ) {
    return undefined;
  }
  return defaultBuildName(build.statTargets, nextSetBonus2pc, nextSetBonus4pc, items);
}

export function patchDesiredBuildStatTargets(
  build: DesiredBuild,
  nextTargets: StatTarget[],
  items?: ArmorPiece[],
): Partial<DesiredBuild> {
  const name = buildNameForStatTargetChange(
    build.name,
    build.statTargets,
    nextTargets,
    build.setBonus2pc,
    build.setBonus4pc,
    items,
  );
  return {
    statTargets: nextTargets,
    ...(name !== undefined ? { name } : {}),
  };
}

export function patchDesiredBuildSetBonus(
  build: DesiredBuild,
  nextSetBonus2pc?: number,
  nextSetBonus4pc?: number,
  items?: ArmorPiece[],
): Partial<DesiredBuild> {
  const name = buildNameForSetBonusChange(
    build.name,
    build,
    nextSetBonus2pc,
    nextSetBonus4pc,
    items,
  );
  return {
    setBonus2pc: nextSetBonus2pc,
    setBonus4pc: nextSetBonus4pc,
    ...(name !== undefined ? { name } : {}),
  };
}

export function createDesiredBuild(
  prefs: ClassPreferenceProfile,
  classType: ClassType,
  name?: string,
  targetsMode: 'tier' | 'custom' = 'tier',
  existingBuilds: readonly DesiredBuild[] = [],
): DesiredBuild {
  const statTargets = uniqueDefaultStatTargets(
    prefs,
    existingBuilds,
    targetsMode,
    classType,
  );
  const draft: DesiredBuild = {
    id: '',
    name: name ?? defaultBuildNameFromStatTargets(statTargets),
    mode: targetsMode === 'custom' ? 'custom' : 'priority',
    targetsMode,
    statTargets,
    enabled: true,
  };
  return assignEncodedBuildId(draft, classType);
}

export function focusStatsFromTargets(targets: StatTarget[]): Stat[] {
  return targets.map((t) => t.stat);
}
