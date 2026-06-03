import {
  armorDiffLabelCopy,
  armorDiffLineLabelCopy,
  armorDiffNoSetCopy,
  armorDiffYesNoCopy,
  statLabel,
} from '@/i18n/gameCopy';
import { STATS } from '@/lib/constants';
import { intrinsicStatDelta, intrinsicStatValue } from '@/lib/armor/intrinsicCompare';
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
      label: armorDiffLineLabelCopy('Tuning'),
      value: a.tuningStat ? statLabel(a.tuningStat) : '-',
      other: b.tuningStat ? statLabel(b.tuningStat) : '-',
    });
  }

  const setA = a.armorSet?.name ?? null;
  const setB = b.armorSet?.name ?? null;
  if (setA !== setB) {
    lines.push({
      kind: 'set',
      label: armorDiffLineLabelCopy('Set'),
      value: setA ?? armorDiffNoSetCopy(),
      other: setB ?? armorDiffNoSetCopy(),
    });
  }

  if (a.power !== b.power) {
    lines.push({
      kind: 'power',
      label: armorDiffLineLabelCopy('Power'),
      value: a.power,
      other: b.power,
      delta: a.power - b.power,
    });
  }

  if (a.isMasterwork !== b.isMasterwork) {
    lines.push({
      kind: 'masterwork',
      label: armorDiffLineLabelCopy('Masterwork'),
      value: armorDiffYesNoCopy(a.isMasterwork),
      other: armorDiffYesNoCopy(b.isMasterwork),
    });
  }

  for (const stat of STATS) {
    const av = intrinsicStatValue(a, stat);
    const bv = intrinsicStatValue(b, stat);
    if (av !== bv && (av > 0 || bv > 0)) {
      lines.push({
        kind: 'stat',
        label: statLabel(stat),
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
    return armorDiffLabelCopy('Same stat split');
  }
  if (setsDiffer) {
    return armorDiffLabelCopy('Same stats & tuning');
  }
  return armorDiffLabelCopy('Same roll');
}

/** Helper under same-roll badge / empty duel banner when intrinsic stats match. */
export function sameRollHelperCopy(a: ArmorPiece, b: ArmorPiece): string {
  const tuningDiffers = a.tuningStat !== b.tuningStat;
  const setsDiffer = (a.armorSet?.hash ?? null) !== (b.armorSet?.hash ?? null);

  if (tuningDiffers && setsDiffer) {
    return armorDiffLabelCopy('Decide by set or tuning');
  }
  if (tuningDiffers) {
    return armorDiffLabelCopy('Decide by tuning');
  }
  if (setsDiffer) {
    return armorDiffLabelCopy('Decide by set');
  }
  if (a.power !== b.power || a.location !== b.location) {
    return armorDiffLabelCopy('Same everything except power/location');
  }
  return armorDiffLabelCopy('Identical roll. Pick either one.');
}
