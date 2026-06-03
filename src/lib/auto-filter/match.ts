import { ARCHETYPES, ARMOR_SLOTS, CLASSES, STATS } from '@/lib/constants';
import { armorIsDimKeepOrFavorite } from '@/lib/dim/parseTags';
import { createEntityId } from '@/lib/ids';
import type {
  Archetype,
  ArmorPiece,
  ArmorSlot,
  AutoFilterClassScope,
  AutoFilterMatchMode,
  AutoFilterRule,
  PendingTag,
  Stat,
} from '@/types';

export interface AutoFilterExclusions {
  bucketJunkedIds: string[];
  bucketKeptBothIds: string[];
  bucketKeptSideIds: string[];
  pendingTags: PendingTag[];
}

const CLASS_SCOPES: AutoFilterClassScope[] = [...CLASSES, 'all'];
const ARCHETYPE_SET = new Set<Archetype>(ARCHETYPES);
const STAT_SET = new Set<Stat>(STATS);
const SLOT_SET = new Set<ArmorSlot>(ARMOR_SLOTS);

function isAutoFilterClassScope(value: unknown): value is AutoFilterClassScope {
  return typeof value === 'string' && CLASS_SCOPES.includes(value as AutoFilterClassScope);
}

function normalizeMatchMode(value: unknown): AutoFilterMatchMode {
  if (value === 'not') return 'not';
  if (value === 'anyOf') return 'anyOf';
  if (value === 'noneOf') return 'noneOf';
  return 'is';
}

function isMultiMatchMode(mode: AutoFilterMatchMode | undefined): boolean {
  const m = normalizeMatchMode(mode);
  return m === 'anyOf' || m === 'noneOf';
}

export function getCriterionValues<T>(
  single: T | undefined,
  multi: readonly T[] | undefined,
): T[] | undefined {
  if (multi?.length) return [...multi];
  if (single !== undefined) return [single];
  return undefined;
}

/** True when `actual` satisfies the rule criterion (no expected values => no constraint). */
export function criterionMatches<T>(
  actual: T,
  expected: T | undefined,
  mode: AutoFilterMatchMode | undefined,
  expectedValues?: readonly T[],
): boolean {
  const values = getCriterionValues(expected, expectedValues);
  if (!values?.length) return true;

  const m = normalizeMatchMode(mode);
  const inSet = values.some((value) => actual === value);

  switch (m) {
    case 'not':
      return !inSet && values.length === 1;
    case 'anyOf':
      return inSet;
    case 'noneOf':
      return !inSet;
    case 'is':
    default:
      return inSet && values.length === 1;
  }
}

function normalizeEnumList<T extends string>(
  single: unknown,
  multi: unknown,
  allowed: ReadonlySet<T>,
): T[] | undefined {
  const fromMulti = Array.isArray(multi)
    ? multi.filter((value): value is T => typeof value === 'string' && allowed.has(value as T))
    : [];
  const fromSingle =
    typeof single === 'string' && allowed.has(single as T) ? [single as T] : [];
  const merged = fromMulti.length > 0 ? fromMulti : fromSingle;
  return merged.length > 0 ? merged : undefined;
}

function normalizeNumberList(single: unknown, multi: unknown): number[] | undefined {
  const fromMulti = Array.isArray(multi)
    ? multi.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    : [];
  const fromSingle =
    typeof single === 'number' && Number.isFinite(single) ? [single] : [];
  const merged = fromMulti.length > 0 ? fromMulti : fromSingle;
  return merged.length > 0 ? merged : undefined;
}

function persistMatchMode(
  hasValues: boolean,
  mode: unknown,
  values: readonly unknown[] | undefined,
): AutoFilterMatchMode | undefined {
  if (!hasValues) return undefined;
  const normalized = normalizeMatchMode(mode);
  if (normalized === 'is') return undefined;
  if (normalized === 'not' && (values?.length ?? 0) === 1) return 'not';
  if (normalized === 'anyOf' && (values?.length ?? 0) >= 1) return 'anyOf';
  if (normalized === 'noneOf' && (values?.length ?? 0) >= 1) return 'noneOf';
  return undefined;
}

function persistSingleValue<T>(values: T[] | undefined, mode: AutoFilterMatchMode | undefined): T | undefined {
  if (!values?.length || isMultiMatchMode(mode) || values.length !== 1) return undefined;
  return values[0];
}

function persistMultiValues<T>(
  values: T[] | undefined,
  mode: AutoFilterMatchMode | undefined,
): T[] | undefined {
  if (!values?.length) return undefined;
  if (isMultiMatchMode(mode) || values.length > 1) return values;
  return undefined;
}

function normalizeCriterionField<T extends string>(
  single: unknown,
  multi: unknown,
  mode: unknown,
  allowed: ReadonlySet<T>,
): Pick<AutoFilterRule, never> & {
  single?: T;
  multi?: T[];
  matchMode?: AutoFilterMatchMode;
} {
  const values = normalizeEnumList(single, multi, allowed);
  const matchMode = persistMatchMode(!!values?.length, mode, values);
  return {
    single: persistSingleValue(values, matchMode),
    multi: persistMultiValues(values, matchMode),
    matchMode,
  };
}

function normalizeSetField(
  single: unknown,
  multi: unknown,
  mode: unknown,
): {
  single?: number;
  multi?: number[];
  matchMode?: AutoFilterMatchMode;
} {
  const values = normalizeNumberList(single, multi);
  const matchMode = persistMatchMode(!!values?.length, mode, values);
  return {
    single: persistSingleValue(values, matchMode),
    multi: persistMultiValues(values, matchMode),
    matchMode,
  };
}

export function createAutoFilterRule(
  partial: Omit<AutoFilterRule, 'id' | 'enabled'> & { id?: string; enabled?: boolean },
): AutoFilterRule {
  return {
    id: partial.id ?? createEntityId(),
    enabled: partial.enabled ?? true,
    name: partial.name,
    classType: partial.classType,
    archetype: partial.archetype,
    archetypes: partial.archetypes,
    archetypeMatchMode: partial.archetypeMatchMode,
    tertiaryStat: partial.tertiaryStat,
    tertiaryStats: partial.tertiaryStats,
    tertiaryStatMatchMode: partial.tertiaryStatMatchMode,
    tuningStat: partial.tuningStat,
    tuningStats: partial.tuningStats,
    tuningStatMatchMode: partial.tuningStatMatchMode,
    armorSlot: partial.armorSlot,
    armorSlots: partial.armorSlots,
    armorSlotMatchMode: partial.armorSlotMatchMode,
    armorSetHash: partial.armorSetHash,
    armorSetHashes: partial.armorSetHashes,
    armorSetHashMatchMode: partial.armorSetHashMatchMode,
  };
}

export function normalizeAutoFilterRules(raw: unknown): AutoFilterRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: AutoFilterRule[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rule = entry as Partial<AutoFilterRule>;
    if (typeof rule.id !== 'string' || !rule.id) continue;
    if (!isAutoFilterClassScope(rule.classType)) continue;

    const archetype = normalizeCriterionField(
      rule.archetype,
      rule.archetypes,
      rule.archetypeMatchMode,
      ARCHETYPE_SET,
    );
    const tertiaryStat = normalizeCriterionField(
      rule.tertiaryStat,
      rule.tertiaryStats,
      rule.tertiaryStatMatchMode,
      STAT_SET,
    );
    const tuningStat = normalizeCriterionField(
      rule.tuningStat,
      rule.tuningStats,
      rule.tuningStatMatchMode,
      STAT_SET,
    );
    const armorSlot = normalizeCriterionField(
      rule.armorSlot,
      rule.armorSlots,
      rule.armorSlotMatchMode,
      SLOT_SET,
    );
    const armorSet = normalizeSetField(
      rule.armorSetHash,
      rule.armorSetHashes,
      rule.armorSetHashMatchMode,
    );

    rules.push({
      id: rule.id,
      enabled: rule.enabled !== false,
      name: typeof rule.name === 'string' ? rule.name : undefined,
      classType: rule.classType,
      archetype: archetype.single,
      archetypes: archetype.multi,
      archetypeMatchMode: archetype.matchMode,
      tertiaryStat: tertiaryStat.single,
      tertiaryStats: tertiaryStat.multi,
      tertiaryStatMatchMode: tertiaryStat.matchMode,
      tuningStat: tuningStat.single,
      tuningStats: tuningStat.multi,
      tuningStatMatchMode: tuningStat.matchMode,
      armorSlot: armorSlot.single,
      armorSlots: armorSlot.multi,
      armorSlotMatchMode: armorSlot.matchMode,
      armorSetHash: armorSet.single,
      armorSetHashes: armorSet.multi,
      armorSetHashMatchMode: armorSet.matchMode,
    });
  }
  return rules;
}

/** Items blocked from auto-junk: keep state, already junked, or session keep decisions. */
export function isProtectedFromAutoJunk(
  item: ArmorPiece,
  exclusions: AutoFilterExclusions,
): boolean {
  if (armorIsDimKeepOrFavorite(item)) return true;
  if (item.dimTag === 'junk') return true;

  if (exclusions.bucketKeptBothIds.includes(item.instanceId)) return true;
  if (exclusions.bucketKeptSideIds.includes(item.instanceId)) return true;
  if (exclusions.bucketJunkedIds.includes(item.instanceId)) return true;

  for (const tag of exclusions.pendingTags) {
    if (tag.instanceId !== item.instanceId) continue;
    if (tag.tag === 'keep' || tag.tag === 'favorite') return true;
    if (tag.tag === 'junk') return true;
  }

  return false;
}

export function pieceMatchesRule(item: ArmorPiece, rule: AutoFilterRule): boolean {
  if (!rule.enabled) return false;
  if (rule.classType !== 'all' && item.classType !== rule.classType) return false;
  if (
    !criterionMatches(
      item.archetype,
      rule.archetype,
      rule.archetypeMatchMode,
      rule.archetypes,
    )
  ) {
    return false;
  }
  if (
    !criterionMatches(
      item.tertiaryStat,
      rule.tertiaryStat,
      rule.tertiaryStatMatchMode,
      rule.tertiaryStats,
    )
  ) {
    return false;
  }
  if (
    !criterionMatches(
      item.tuningStat,
      rule.tuningStat,
      rule.tuningStatMatchMode,
      rule.tuningStats,
    )
  ) {
    return false;
  }
  if (
    !criterionMatches(item.armorSlot, rule.armorSlot, rule.armorSlotMatchMode, rule.armorSlots)
  ) {
    return false;
  }
  const setValues = getCriterionValues(rule.armorSetHash, rule.armorSetHashes);
  if (
    setValues?.length &&
    !criterionMatches(
      item.armorSet?.hash,
      rule.armorSetHash,
      rule.armorSetHashMatchMode,
      rule.armorSetHashes,
    )
  ) {
    return false;
  }
  return true;
}

export function findAutoFilterMatches(
  items: ArmorPiece[],
  rules: AutoFilterRule[],
  exclusions: AutoFilterExclusions,
): ArmorPiece[] {
  const enabledRules = rules.filter((rule) => rule.enabled);
  if (enabledRules.length === 0) return [];

  const matched = new Map<string, ArmorPiece>();
  for (const item of items) {
    if (isProtectedFromAutoJunk(item, exclusions)) continue;
    if (enabledRules.some((rule) => pieceMatchesRule(item, rule))) {
      matched.set(item.instanceId, item);
    }
  }
  return [...matched.values()];
}

export function countAutoFilterMatches(
  items: ArmorPiece[],
  rules: AutoFilterRule[],
  exclusions: AutoFilterExclusions,
): number {
  return findAutoFilterMatches(items, rules, exclusions).length;
}
