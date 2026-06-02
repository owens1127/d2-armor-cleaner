import type { ArmorPiece, Stat } from '@/types';
import { STATS } from '@/lib/constants';
import { MASTERWORK_STAT_BONUS } from '@/lib/armor/effectiveStats';

/** @deprecated Use MASTERWORK_STAT_BONUS from effectiveStats */
const MW_BONUS = MASTERWORK_STAT_BONUS;
/** Must match T5_TUNING_INTRINSIC_SHIFT in coverage/achievability.ts (+5 / −5 socket shift). */
const TUNING_PLUS = 5;
const TUNING_MINUS = 5;

function cloneStats(stats: Partial<Record<Stat, number>>): Partial<Record<Stat, number>> {
  return { ...stats };
}

function statsOnPiece(stats: Partial<Record<Stat, number>>): Stat[] {
  return STATS.filter((s) => (stats[s] ?? 0) > 0);
}

function applyMasterwork(
  stats: Partial<Record<Stat, number>>,
  asIfMasterwork: boolean,
): Partial<Record<Stat, number>> {
  if (!asIfMasterwork) return cloneStats(stats);
  const out = cloneStats(stats);
  for (const s of statsOnPiece(out)) {
    out[s] = (out[s] ?? 0) + MW_BONUS;
  }
  return out;
}

function configKey(stats: Partial<Record<Stat, number>>): string {
  return STATS.map((s) => stats[s] ?? 0).join(',');
}

function dedupeConfigs(configs: Partial<Record<Stat, number>>[]): Partial<Record<Stat, number>>[] {
  const seen = new Set<string>();
  const out: Partial<Record<Stat, number>>[] = [];
  for (const c of configs) {
    const key = configKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Up to 6 intrinsic stat lines for Tier 5 tuning comparisons (DIM stat-lower aligned).
 * Base roll, +5/-5 shifts from each donor stat, and +1 balanced.
 */
export function tuningPermutations(
  item: ArmorPiece,
  opts?: { asIfMasterwork?: boolean; statsBase?: Partial<Record<Stat, number>> },
): Partial<Record<Stat, number>>[] {
  const base =
    opts?.statsBase ??
    applyMasterwork(item.baseStats, opts?.asIfMasterwork ?? false);
  const configs: Partial<Record<Stat, number>>[] = [base];
  const onPiece = statsOnPiece(base);
  const tuning = item.tuningStat;

  if (tuning) {
    for (const donor of onPiece) {
      if (donor === tuning) continue;
      const shifted = cloneStats(base);
      shifted[tuning] = (shifted[tuning] ?? 0) + TUNING_PLUS;
      shifted[donor] = Math.max(0, (shifted[donor] ?? 0) - TUNING_MINUS);
      configs.push(shifted);
    }

    if (!onPiece.includes(tuning)) {
      for (const donor of onPiece) {
        const shifted = cloneStats(base);
        shifted[tuning] = (shifted[tuning] ?? 0) + TUNING_PLUS;
        shifted[donor] = Math.max(0, (shifted[donor] ?? 0) - TUNING_MINUS);
        configs.push(shifted);
      }
    }

    const balanced = cloneStats(base);
    const ranked = [...STATS].sort((a, b) => (balanced[a] ?? 0) - (balanced[b] ?? 0));
    for (const s of ranked.slice(0, 3)) {
      balanced[s] = (balanced[s] ?? 0) + 1;
    }
    configs.push(balanced);
  }

  return dedupeConfigs(configs);
}

export function attachTuningConfigurations(item: ArmorPiece): ArmorPiece {
  return {
    ...item,
    statConfigurations: tuningPermutations(item, { statsBase: item.baseStats }),
  };
}
