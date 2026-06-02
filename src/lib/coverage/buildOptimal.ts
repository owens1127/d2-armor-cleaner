import { CLASSES } from '@/lib/constants';
import { getClassPrefs } from '@/lib/prefs/profile';
import { isBestTierLoadoutPiece, priorityStatsFromTargets } from '@/lib/coverage/achievability';
import { getDesiredBuilds } from '@/lib/coverage/builds';
import { bestSetPieceInSlot } from '@/lib/coverage/loadout';
import { parseSetBonusTargets } from '@/lib/coverage/setBonus';
import type { ArmorPiece, ClassPreferenceProfile, ClassType, DesiredBuild, PreferenceProfile } from '@/types';

export type BuildOptimalRollIdentity = Pick<
  ArmorPiece,
  'archetype' | 'tertiaryStat' | 'tuningStat'
>;

export type BuildOptimalIndicatorVariant = 'default' | 'sole';

export interface BuildOptimalLookup {
  isOptimal(piece: BuildOptimalRollIdentity): boolean;
  /** Enabled desired builds this roll shape is optimal for (each build counts once). */
  buildCount(piece: BuildOptimalRollIdentity): number;
  tooltip(
    piece: BuildOptimalRollIdentity,
    options?: { setScopeHash?: number },
  ): string | undefined;
  indicatorVariant(
    instanceId: string,
    options?: { setScopeHash?: number },
  ): BuildOptimalIndicatorVariant;
}

const SOLE_OPTIMAL_PREFIX = 'Only matching piece in this slot';

function rollIdentityKey(piece: BuildOptimalRollIdentity): string {
  return `${piece.archetype}|${piece.tertiaryStat}|${piece.tuningStat ?? ''}`;
}

function formatBuildNameList(buildNames: readonly string[]): string {
  if (buildNames.length === 0) return '';
  if (buildNames.length === 1) return buildNames[0];
  if (buildNames.length === 2) {
    return `${buildNames[0]} and ${buildNames[1]}`;
  }
  return `${buildNames.slice(0, -1).join(', ')}, and ${buildNames[buildNames.length - 1]}`;
}

/** Badge tooltip: combo count plus named combos, e.g. "Optimal for 2 combos · A and B". */
export function formatBuildOptimalCountTooltip(buildNames: readonly string[]): string {
  const count = buildNames.length;
  if (count === 0) return '';
  const summary = count === 1 ? 'Optimal for 1 combo' : `Optimal for ${count} combos`;
  return `${summary} · ${formatBuildNameList(buildNames)}`;
}

function classTypeFromItems(items: readonly ArmorPiece[]): ClassType {
  return items[0]?.classType ?? 'hunter';
}

export function matchingBuildNames(
  piece: BuildOptimalRollIdentity,
  prefs: ClassPreferenceProfile,
  classType: ClassType = 'hunter',
): string[] {
  return getDesiredBuilds(prefs, classType)
    .filter((build) =>
      isBestTierLoadoutPiece(piece as ArmorPiece, priorityStatsFromTargets(build.statTargets)),
    )
    .map((build) => build.name);
}

/**
 * Count of enabled desired builds where this piece matches an optimal roll shape.
 * Each build contributes at most once, even if multiple stat-target patterns match.
 */
export function matchingBuildCount(
  piece: BuildOptimalRollIdentity,
  prefs: ClassPreferenceProfile,
  classType: ClassType = 'hunter',
): number {
  return matchingBuildNames(piece, prefs, classType).length;
}

/** Whether a piece matches an optimal roll shape for any enabled desired build. */
export function isBuildOptimalPiece(
  piece: BuildOptimalRollIdentity,
  prefs: ClassPreferenceProfile,
  classType: ClassType = 'hunter',
): boolean {
  return matchingBuildNames(piece, prefs, classType).length > 0;
}

export interface SoleBuildOptimalBySlotAndBuild {
  /** Instance ids with no same-slot competitor for any matching enabled build. */
  soleInstanceIds: ReadonlySet<string>;
  /** Per slot+build+set when combo has set targets — for column-scoped red exclusive badges. */
  soleBySetScope: ReadonlyMap<string, string>;
}

function buildHasSetBonus(build: DesiredBuild): boolean {
  return build.setBonus2pc !== undefined || build.setBonus4pc !== undefined;
}

/** Grouping key for global sole badges: per slot+build, or per slot+build+set when combo has set targets. */
function soleScopeKey(
  item: ArmorPiece,
  buildName: string,
  setBonus: boolean,
): string {
  if (setBonus) {
    const setHash = item.armorSet?.hash ?? 0;
    return `${item.armorSlot}|${buildName}|${setHash}`;
  }
  return `${item.armorSlot}|${buildName}`;
}

/** Set-column sole scope: slot+build+set+roll shape so tuning columns do not compete. */
function setPatternSoleScopeKey(item: ArmorPiece, buildName: string): string {
  const setHash = item.armorSet?.hash ?? 0;
  return `${item.armorSlot}|${buildName}|${setHash}|${rollIdentityKey(item)}`;
}

/**
 * Per armor slot and enabled build: red exclusive when a piece is the only vault piece in
 * that slot optimal for every build it matches (no same-slot peer shares a build).
 * When a build has set bonus targets, sole scope is limited to the same armor set.
 */
export function soleBuildOptimalBySlotAndBuild(
  items: readonly ArmorPiece[],
  prefs: ClassPreferenceProfile,
): SoleBuildOptimalBySlotAndBuild {
  const classType = classTypeFromItems(items);
  const builds = getDesiredBuilds(prefs, classType);
  const buildSetBonus = new Map(builds.map((build) => [build.name, buildHasSetBonus(build)]));
  const bySlotAndBuild = new Map<string, string[]>();
  const bySetPatternScope = new Map<string, string[]>();

  for (const item of items) {
    const buildNames = matchingBuildNames(item, prefs, classType);
    if (buildNames.length === 0) continue;

    for (const buildName of buildNames) {
      const setBonus = buildSetBonus.get(buildName) ?? false;
      const key = soleScopeKey(item, buildName, setBonus);
      const list = bySlotAndBuild.get(key) ?? [];
      list.push(item.instanceId);
      bySlotAndBuild.set(key, list);

      if (setBonus) {
        const patternKey = setPatternSoleScopeKey(item, buildName);
        const patternList = bySetPatternScope.get(patternKey) ?? [];
        patternList.push(item.instanceId);
        bySetPatternScope.set(patternKey, patternList);
      }
    }
  }

  const soleInstanceIds = new Set<string>();
  const soleBySetScope = new Map<string, string>();

  for (const [key, ids] of bySetPatternScope) {
    if (ids.length === 1) {
      soleBySetScope.set(key, ids[0]!);
    }
  }

  for (const item of items) {
    const buildNames = matchingBuildNames(item, prefs, classType);
    if (buildNames.length === 0) continue;

    const isSole = buildNames.every((buildName) => {
      const key = soleScopeKey(item, buildName, buildSetBonus.get(buildName) ?? false);
      const ids = bySlotAndBuild.get(key) ?? [];
      return ids.length === 1 && ids[0] === item.instanceId;
    });

    if (isSole) {
      soleInstanceIds.add(item.instanceId);
    }
  }

  return { soleInstanceIds, soleBySetScope };
}

export function formatSoleBuildOptimalTooltip(buildNames: readonly string[]): string {
  const base = formatBuildOptimalCountTooltip(buildNames);
  return base ? `${SOLE_OPTIMAL_PREFIX} · ${base}` : SOLE_OPTIMAL_PREFIX;
}

export function buildBuildOptimalLookup(
  prefs: ClassPreferenceProfile,
  classItems: readonly ArmorPiece[] = [],
): BuildOptimalLookup {
  const classType = classTypeFromItems(classItems);
  const builds = getDesiredBuilds(prefs, classType);
  if (builds.length === 0) {
    return {
      isOptimal: () => false,
      buildCount: () => 0,
      tooltip: () => undefined,
      indicatorVariant: () => 'default',
    };
  }

  const { soleInstanceIds } = soleBuildOptimalBySlotAndBuild(classItems, prefs);

  function isBestSetPieceInScope(instanceId: string, setScopeHash: number): boolean {
    const piece = classItems.find((item) => item.instanceId === instanceId);
    if (!piece || piece.armorSet?.hash !== setScopeHash) return false;

    const setBonusBuilds = builds.filter((build) => {
      if (!buildHasSetBonus(build)) return false;
      const setTargets = parseSetBonusTargets(build.setBonus2pc, build.setBonus4pc);
      return setTargets.some((target) => target.hash === setScopeHash);
    });
    if (setBonusBuilds.length === 0) return false;

    return setBonusBuilds.some((build) => {
      const priorities = priorityStatsFromTargets(build.statTargets);
      const setTargets = parseSetBonusTargets(build.setBonus2pc, build.setBonus4pc);
      const best = bestSetPieceInSlot(
        classItems,
        piece.armorSlot,
        setScopeHash,
        priorities,
        setTargets,
      );
      return best?.instanceId === instanceId;
    });
  }

  function isSoleInSetScope(instanceId: string, setScopeHash: number): boolean {
    return isBestSetPieceInScope(instanceId, setScopeHash);
  }

  function isSoleForPiece(
    piece: BuildOptimalRollIdentity & { instanceId?: string },
    setScopeHash?: number,
  ): boolean {
    if (piece.instanceId) {
      if (setScopeHash !== undefined) {
        return isSoleInSetScope(piece.instanceId, setScopeHash);
      }
      return soleInstanceIds.has(piece.instanceId);
    }

    const matching = classItems.filter(
      (item) =>
        rollIdentityKey(item) === rollIdentityKey(piece) &&
        isBuildOptimalPiece(item, prefs, classType),
    );
    return (
      matching.length === 1 && soleInstanceIds.has(matching[0]!.instanceId)
    );
  }

  const buildChecks = builds.map((build) => ({
    name: build.name,
    priorities: priorityStatsFromTargets(build.statTargets),
  }));
  const rollCache = new Map<string, string[]>();

  function namesForRoll(piece: BuildOptimalRollIdentity): string[] {
    const key = rollIdentityKey(piece);
    const cached = rollCache.get(key);
    if (cached) return cached;

    const names = buildChecks
      .filter(({ priorities }) =>
        isBestTierLoadoutPiece(piece as ArmorPiece, priorities),
      )
      .map(({ name }) => name);
    rollCache.set(key, names);
    return names;
  }

  function resolveIndicatorVariant(
    instanceId: string,
    setScopeHash?: number,
  ): BuildOptimalIndicatorVariant {
    if (setScopeHash !== undefined) {
      return isSoleInSetScope(instanceId, setScopeHash) ? 'sole' : 'default';
    }
    return soleInstanceIds.has(instanceId) ? 'sole' : 'default';
  }

  return {
    isOptimal: (piece) => namesForRoll(piece).length > 0,
    buildCount: (piece) => namesForRoll(piece).length,
    tooltip: (piece, options) => {
      const names = namesForRoll(piece);
      if (names.length === 0) return undefined;
      return isSoleForPiece(piece, options?.setScopeHash)
        ? formatSoleBuildOptimalTooltip(names)
        : formatBuildOptimalCountTooltip(names);
    },
    indicatorVariant: (instanceId, options) =>
      resolveIndicatorVariant(instanceId, options?.setScopeHash),
  };
}

export function buildBuildOptimalLookups(
  profile: PreferenceProfile,
  allItems: readonly ArmorPiece[] = [],
): ReadonlyMap<ClassType, BuildOptimalLookup> {
  const itemsByClass = new Map<ClassType, ArmorPiece[]>();
  for (const item of allItems) {
    const list = itemsByClass.get(item.classType) ?? [];
    list.push(item);
    itemsByClass.set(item.classType, list);
  }

  return new Map(
    CLASSES.map((classType) => [
      classType,
      buildBuildOptimalLookup(
        getClassPrefs(profile, classType),
        itemsByClass.get(classType) ?? [],
      ),
    ]),
  );
}
