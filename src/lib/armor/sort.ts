import type { Archetype, ArmorPiece, ArmorSlot, ClassPreferenceProfile, Stat } from '@/types';
import { ARCHETYPES, ARMOR_SLOTS, STATS } from '@/lib/constants';
import { compareRedundantKeepPriority } from '@/lib/scoring/redundantKeepPriority';

function slotOrder(slot: ArmorSlot): number {
  const i = ARMOR_SLOTS.indexOf(slot);
  return i === -1 ? 99 : i;
}

function archetypeOrder(archetype: Archetype): number {
  const i = ARCHETYPES.indexOf(archetype);
  return i === -1 ? 99 : i;
}

function statOrder(stat: Stat): number {
  const i = STATS.indexOf(stat);
  return i === -1 ? 99 : i;
}

/** Vault-wide list order: slot → archetype → tertiary → interest → power. */
export function sortArmorLikeTier5(items: ArmorPiece[]): ArmorPiece[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.isIgnored) !== Boolean(b.isIgnored)) return a.isIgnored ? 1 : -1;

    const slot = slotOrder(a.armorSlot) - slotOrder(b.armorSlot);
    if (slot !== 0) return slot;

    const arch = archetypeOrder(a.archetype) - archetypeOrder(b.archetype);
    if (arch !== 0) return arch;

    const tert = statOrder(a.tertiaryStat) - statOrder(b.tertiaryStat);
    if (tert !== 0) return tert;

    const want = (b.wantScore ?? 0) - (a.wantScore ?? 0);
    if (want !== 0) return want;

    return b.power - a.power;
  });
}

/** Within a dupe bucket: interest → keep-priority prefs → tuning stat → power. */
export function sortBucketItems(
  items: ArmorPiece[],
  prefs?: ClassPreferenceProfile,
): ArmorPiece[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.isIgnored) !== Boolean(b.isIgnored)) return a.isIgnored ? 1 : -1;

    const want = (b.wantScore ?? 0) - (a.wantScore ?? 0);
    if (want !== 0) return want;

    if (prefs) {
      const keep = compareRedundantKeepPriority(b, a, prefs);
      if (keep !== 0) return keep;
    }

    const tuneA = a.tuningStat ?? '';
    const tuneB = b.tuningStat ?? '';
    if (tuneA !== tuneB) return tuneA.localeCompare(tuneB);

    return b.power - a.power;
  });
}

export type BrowseSortOrder = 'preference' | 'match-desc' | 'match-asc' | 'build-fit-desc';

/** Browse grid: preference or precomputed match totals, power as tiebreaker. */
export function sortBrowseItems(
  items: ArmorPiece[],
  order: BrowseSortOrder,
  matchTotals?: Map<string, number>,
  buildFitTotals?: Map<string, number>,
): ArmorPiece[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (order === 'preference') {
      cmp = (b.wantScore ?? 0) - (a.wantScore ?? 0);
    } else if (order === 'build-fit-desc') {
      const aTotal = buildFitTotals?.get(a.instanceId) ?? 0;
      const bTotal = buildFitTotals?.get(b.instanceId) ?? 0;
      cmp = bTotal - aTotal;
    } else {
      const aTotal = matchTotals?.get(a.instanceId) ?? 0;
      const bTotal = matchTotals?.get(b.instanceId) ?? 0;
      cmp = bTotal - aTotal;
      if (order === 'match-asc') cmp = -cmp;
    }
    if (cmp !== 0) return cmp;
    return b.power - a.power;
  });
}
