import { STAT_HASH_TO_STAT } from '@/lib/constants';

/** Count mapped Armor 3.0 stat lines with positive values (may count duplicates). */
export function countMappedProfileStats(
  statData?: { stats?: Record<string, { statHash: number; value: number }> },
): number {
  let count = 0;
  for (const entry of Object.values(statData?.stats ?? {})) {
    if (entry.value > 0 && STAT_HASH_TO_STAT[entry.statHash]) count++;
  }
  return count;
}

/** Count distinct mapped stats: bulk 304 often repeats lines or omits the tertiary roll. */
export function countUniqueMappedProfileStats(
  statData?: { stats?: Record<string, { statHash: number; value: number }> },
): number {
  const seen = new Set<string>();
  for (const entry of Object.values(statData?.stats ?? {})) {
    if (entry.value > 0) {
      const stat = STAT_HASH_TO_STAT[entry.statHash];
      if (stat) seen.add(stat);
    }
  }
  return seen.size;
}
