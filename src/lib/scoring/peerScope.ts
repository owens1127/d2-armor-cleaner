import type { ArmorPiece, DupeRuleConfig, RedundantPeerScope } from '@/types';

export const DEFAULT_REDUNDANT_PEER_SCOPE: RedundantPeerScope = {
  groupBySet: true,
  groupByTuning: true,
};

/** Maps dupe-rule grouping flags to redundant-roll peer comparison scope. */
export function redundantPeerScopeFromDupeRules(
  rules: DupeRuleConfig,
): RedundantPeerScope {
  return {
    groupBySet: rules.sameArmorSet,
    groupByTuning: rules.sameTuningStat,
  };
}

/**
 * True when two pieces belong to the same armor set for stat comparison.
 * Orphans (no set) match only each other: set bonuses differ across sets.
 */
export function sameArmorSetForCompare(a: ArmorPiece, b: ArmorPiece): boolean {
  const aHash = a.armorSet?.hash;
  const bHash = b.armorSet?.hash;
  if (aHash == null && bHash == null) return true;
  if (aHash == null || bHash == null) return false;
  return aHash === bHash;
}

/** True when two pieces share the same tuning stat (including both unset). */
export function sameTuningStatForCompare(a: ArmorPiece, b: ArmorPiece): boolean {
  return a.tuningStat === b.tuningStat;
}

/**
 * Peers eligible for stat-lower / tuning-redundancy comparison.
 * Same class, slot, archetype, tertiary roll; optionally same armor set and tuning stat.
 */
export function armorComparisonPeers(
  candidate: ArmorPiece,
  items: ArmorPiece[],
  scope: RedundantPeerScope = DEFAULT_REDUNDANT_PEER_SCOPE,
): ArmorPiece[] {
  return items.filter(
    (i) =>
      i.instanceId !== candidate.instanceId &&
      i.classType === candidate.classType &&
      i.armorSlot === candidate.armorSlot &&
      i.archetype === candidate.archetype &&
      i.tertiaryStat === candidate.tertiaryStat &&
      (!scope.groupBySet || sameArmorSetForCompare(candidate, i)) &&
      (!scope.groupByTuning || sameTuningStatForCompare(candidate, i)),
  );
}
