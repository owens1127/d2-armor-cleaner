import { isIgnoredByDupeRules } from '@/lib/dupes/group';
import { statLabel, archetypeLabel } from '@/i18n/gameCopy';
import type { ArmorPiece, DupeRuleConfig } from '@/types';

/** Same roll identity: class, slot, archetype, tertiary, and tuning. */
export function matchesRollProfile(a: ArmorPiece, b: ArmorPiece): boolean {
  return (
    a.classType === b.classType &&
    a.armorSlot === b.armorSlot &&
    a.archetype === b.archetype &&
    a.tertiaryStat === b.tertiaryStat &&
    a.tuningStat === b.tuningStat
  );
}

/** Roll profile plus altar gear tier (both must have a known tier). */
export function matchesRollProfileAndTier(a: ArmorPiece, b: ArmorPiece): boolean {
  return a.tier != null && b.tier != null && a.tier === b.tier && matchesRollProfile(a, b);
}

/** @deprecated Use {@link matchesRollProfile}. */
export const matchesArchetypeTertiaryBucket = matchesRollProfile;

export interface CountRollProfilePeersOptions {
  /** Instance ids to omit (e.g. junked or eliminated this bucket). */
  excludeInstanceIds?: Iterable<string>;
}

/** @deprecated Use {@link CountRollProfilePeersOptions}. */
export type CountArchetypeTertiaryPeersOptions = CountRollProfilePeersOptions;

/**
 * Count inventory pieces sharing class + slot + archetype + tertiary + tuning with `item`.
 * Respects dupe-rule min tier and DIM tag ignore flags.
 */
export function countRollProfilePeers(
  item: ArmorPiece,
  items: ArmorPiece[],
  rules: DupeRuleConfig,
  options?: CountRollProfilePeersOptions,
): number {
  const excluded = options?.excludeInstanceIds
    ? new Set(options.excludeInstanceIds)
    : null;

  let count = 0;
  for (const candidate of items) {
    if (excluded?.has(candidate.instanceId)) continue;
    if ((candidate.tier ?? 0) < rules.minTier) continue;
    if (isIgnoredByDupeRules(candidate, rules)) continue;
    if (matchesRollProfile(item, candidate)) count++;
  }
  return count;
}

/** @deprecated Use {@link countRollProfilePeers}. */
export const countArchetypeTertiaryPeers = countRollProfilePeers;

export function isSingletonRoll(
  item: ArmorPiece,
  items: ArmorPiece[],
  rules: DupeRuleConfig,
  options?: CountRollProfilePeersOptions,
): boolean {
  return countRollProfilePeers(item, items, rules, options) === 1;
}

/**
 * Count vault pieces sharing roll profile and altar gear tier with `item`.
 * Ignores dupe min-tier scope - tier is the explicit peer boundary.
 */
export function countTierRollProfilePeers(
  item: ArmorPiece,
  items: ArmorPiece[],
  rules: DupeRuleConfig,
  options?: CountRollProfilePeersOptions,
): number {
  if (item.tier == null) return 0;

  const excluded = options?.excludeInstanceIds
    ? new Set(options.excludeInstanceIds)
    : null;

  let count = 0;
  for (const candidate of items) {
    if (excluded?.has(candidate.instanceId)) continue;
    if (candidate.tier !== item.tier) continue;
    if (isIgnoredByDupeRules(candidate, rules)) continue;
    if (matchesRollProfile(item, candidate)) count++;
  }
  return count;
}

/** Only piece at this altar tier for class + slot + archetype + tertiary + tuning. */
export function isTierSingletonRoll(
  item: ArmorPiece,
  items: ArmorPiece[],
  rules: DupeRuleConfig,
  options?: CountRollProfilePeersOptions,
): boolean {
  if (item.tier == null) return false;
  return countTierRollProfilePeers(item, items, rules, options) === 1;
}

/** @deprecated Use {@link isSingletonRoll}. */
export const isOnlyArchetypeTertiaryRoll = isSingletonRoll;

export interface RollProfileParts {
  archetype: string;
  tertiary: string;
  tuning: string | null;
}

export function rollProfileParts(
  piece: Pick<ArmorPiece, 'archetype' | 'tertiaryStat' | 'tuningStat'>,
): RollProfileParts {
  return {
    archetype: archetypeLabel(piece.archetype),
    tertiary: statLabel(piece.tertiaryStat),
    tuning: piece.tuningStat ? statLabel(piece.tuningStat) : null,
  };
}

export function rollProfileLabel(
  piece: Pick<ArmorPiece, 'archetype' | 'tertiaryStat' | 'tuningStat'>,
): string {
  const { archetype, tertiary, tuning } = rollProfileParts(piece);
  return `${archetype} · ${tertiary} · ${tuning ?? 'no tuning'}`;
}

export function onlyRollTooltip(piece: ArmorPiece): string {
  return `Only ${rollProfileLabel(piece)} in vault`;
}

/** @deprecated Use {@link onlyRollTooltip}. */
export const singletonRollTooltip = onlyRollTooltip;

export const ONLY_ROLL_LABEL = 'Only roll';
export const ONLY_ROLL_TOOLTIP =
  'Only piece in vault for this slot, archetype, third stat, and tuning';
