import { STAT_LABELS, STATS } from '@/lib/constants';
import {
  intrinsicStatDelta,
  intrinsicStatValue,
  intrinsicStatsEqual,
} from '@/lib/armor/intrinsicCompare';
import type { ArmorPiece, Stat } from '@/types';

export { intrinsicStatsEqual } from '@/lib/armor/intrinsicCompare';

export function setHashesDiffer(a: ArmorPiece, b: ArmorPiece): boolean {
  return (a.armorSet?.hash ?? null) !== (b.armorSet?.hash ?? null);
}

export function tuningStatsDiffer(a: ArmorPiece, b: ArmorPiece): boolean {
  return a.tuningStat !== b.tuningStat;
}

export function archetypesDiffer(a: ArmorPiece, b: ArmorPiece): boolean {
  return a.archetype !== b.archetype;
}

export function tertiaryStatsDiffer(a: ArmorPiece, b: ArmorPiece): boolean {
  return a.tertiaryStat !== b.tertiaryStat;
}

export type DiffKind = 'tuning' | 'set' | 'power' | 'stat' | 'masterwork';

export interface ArmorDiffLine {
  kind: DiffKind;
  label: string;
  stat?: Stat;
  /** This piece's value */
  value: string | number;
  /** Opponent's value */
  other: string | number;
  /** Positive = this piece wins the comparison */
  delta?: number;
}

/** Only lines where the two pieces differ: for duel UI. */
export function armorDiffLines(a: ArmorPiece, b: ArmorPiece): ArmorDiffLine[] {
  const lines: ArmorDiffLine[] = [];

  if (a.tuningStat !== b.tuningStat) {
    lines.push({
      kind: 'tuning',
      label: 'Tuning',
      value: a.tuningStat ? STAT_LABELS[a.tuningStat] : '-',
      other: b.tuningStat ? STAT_LABELS[b.tuningStat] : '-',
    });
  }

  const setA = a.armorSet?.name ?? null;
  const setB = b.armorSet?.name ?? null;
  if (setA !== setB) {
    lines.push({
      kind: 'set',
      label: 'Set',
      value: setA ?? 'No set',
      other: setB ?? 'No set',
    });
  }

  if (a.power !== b.power) {
    lines.push({
      kind: 'power',
      label: 'Power',
      value: a.power,
      other: b.power,
      delta: a.power - b.power,
    });
  }

  if (a.isMasterwork !== b.isMasterwork) {
    lines.push({
      kind: 'masterwork',
      label: 'Masterwork',
      value: a.isMasterwork ? 'Yes' : 'No',
      other: b.isMasterwork ? 'Yes' : 'No',
    });
  }

  for (const stat of STATS) {
    const av = intrinsicStatValue(a, stat);
    const bv = intrinsicStatValue(b, stat);
    if (av !== bv && (av > 0 || bv > 0)) {
      lines.push({
        kind: 'stat',
        label: STAT_LABELS[stat],
        stat,
        value: av,
        other: bv,
        delta: intrinsicStatDelta(a, b, stat),
      });
    }
  }

  return lines;
}

/** Primary badge / inline label when intrinsic stats match. */
export function sameRollBadgeCopy(a: ArmorPiece, b: ArmorPiece): string {
  const tuningDiffers = a.tuningStat !== b.tuningStat;
  const setsDiffer = (a.armorSet?.hash ?? null) !== (b.armorSet?.hash ?? null);

  if (tuningDiffers) {
    return 'Same stat split';
  }
  if (setsDiffer) {
    return 'Same stats & tuning';
  }
  return 'Same roll';
}

/** Helper under same-roll badge / empty duel banner when intrinsic stats match. */
export function sameRollHelperCopy(a: ArmorPiece, b: ArmorPiece): string {
  const tuningDiffers = a.tuningStat !== b.tuningStat;
  const setsDiffer = (a.armorSet?.hash ?? null) !== (b.armorSet?.hash ?? null);

  if (tuningDiffers && setsDiffer) {
    return 'Decide by set or tuning';
  }
  if (tuningDiffers) {
    return 'Decide by tuning';
  }
  if (setsDiffer) {
    return 'Decide by set';
  }
  if (a.power !== b.power || a.location !== b.location) {
    return 'Same everything except power/location';
  }
  return 'Identical roll. Pick either one.';
}

/** Duel banner summary — omits power; emphasizes set and roll differences. */
export function diffSummary(a: ArmorPiece, b: ArmorPiece): string {
  const lines = armorDiffLines(a, b).filter((l) => l.kind !== 'power');
  const setA = a.armorSet?.name ?? 'No set';
  const setB = b.armorSet?.name ?? 'No set';
  const sameStats = intrinsicStatsEqual(a, b);
  const badgeCopy = sameStats ? sameRollBadgeCopy(a, b) : null;

  const parts: string[] = [];
  if (setA !== setB) {
    parts.push(`${setA} vs ${setB}`);
  }
  if (badgeCopy) {
    parts.push(badgeCopy);
  }

  for (const l of lines) {
    if (l.kind === 'set') continue;
    if (l.kind === 'stat' && sameStats) continue;
    if (l.kind === 'stat') {
      parts.push(`${l.label} ${l.value} vs ${l.other}`);
    } else if (l.kind === 'tuning') {
      parts.push(`Tuning: ${l.value} vs ${l.other}`);
    } else if (l.kind === 'masterwork') {
      parts.push(`${l.label}: ${l.value} vs ${l.other}`);
    }
  }

  if (parts.length === 0) return sameRollHelperCopy(a, b);
  if (badgeCopy && parts.length === 1 && parts[0] === badgeCopy) {
    return sameRollHelperCopy(a, b);
  }
  return parts.join(' · ');
}
