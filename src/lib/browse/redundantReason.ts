import type { DismantleCandidate } from '@/lib/dupes/dismantle';
import { intrinsicStatDeltas } from '@/lib/armor/intrinsicCompare';
import { comparableStatDeltas, formatBeatsOn } from '@/lib/scoring/dominance';

/** One-line explanation for redundant browse list rows. */
export function formatRedundantReasonLine(candidate: DismantleCandidate): string {
  const keeper = candidate.peer.name;
  if (candidate.reason === 'tuning-duplicate') {
    const mutual = candidate.tuningCoverage?.mutual ?? false;
    if (mutual) {
      return `Same tuning layouts as ${keeper} — keep one`;
    }
    const beats = intrinsicStatDeltas(candidate.peer, candidate.item);
    const detail = formatBeatsOn(beats);
    if (detail && detail !== 'every tuning config') {
      return `Covered after tuning by ${keeper} · ${detail}`;
    }
    return `Covered after tuning by ${keeper}`;
  }
  const beats =
    candidate.dominatorResult?.beatsOn ??
    comparableStatDeltas(candidate.peer, candidate.item);
  const detail = formatBeatsOn(beats);
  return detail
    ? `Strictly lower than ${keeper} · ${detail}`
    : `Strictly lower than ${keeper}`;
}

export function redundantReasonBadge(
  reason: DismantleCandidate['reason'],
): 'Stat-lower' | 'Tuning dup' {
  return reason === 'stat-lower' ? 'Stat-lower' : 'Tuning dup';
}
