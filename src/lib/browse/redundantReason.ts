import { intrinsicStatDeltas } from '@/lib/armor/intrinsicCompare';
import type { DismantleCandidate } from '@/lib/dupes/dismantle';
import { comparableStatDeltas, formatBeatsOn } from '@/lib/scoring/dominance';

/** Plain-English section header for a redundant dupe group. */
export function redundantGroupReasonLabel(reason: DismantleCandidate['reason']): string {
  return reason === 'stat-lower'
    ? 'Strictly lower · pick one to keep'
    : 'Same tuning · pick one to keep';
}

/** Short comparison line under a redundant grid tile. */
export function formatRedundantMemberDetail(candidate: DismantleCandidate): string | null {
  if (candidate.reason === 'tuning-duplicate' && candidate.tuningCoverage?.mutual) {
    return null;
  }
  const beats =
    candidate.reason === 'stat-lower'
      ? (candidate.dominatorResult?.beatsOn ??
        comparableStatDeltas(candidate.peer, candidate.item))
      : intrinsicStatDeltas(candidate.peer, candidate.item);
  const detail = formatBeatsOn(beats);
  return detail || null;
}

/** @deprecated Flat-list reason line; browse uses grouped grids now. */
export function formatRedundantReasonLine(candidate: DismantleCandidate): string {
  const keeper = candidate.peer.name;
  if (candidate.reason === 'tuning-duplicate') {
    const mutual = candidate.tuningCoverage?.mutual ?? false;
    if (mutual) {
      return `Same tuning layouts as ${keeper} · keep one`;
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

/** @deprecated Use redundantGroupReasonLabel for browse headers. */
export function redundantReasonBadge(
  reason: DismantleCandidate['reason'],
): 'Strictly lower' | 'Tuning duplicate' {
  return reason === 'stat-lower' ? 'Strictly lower' : 'Tuning duplicate';
}
