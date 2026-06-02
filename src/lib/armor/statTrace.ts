import type { ArmorPiece, Stat } from '@/types';
import { STAT_LABELS, STATS } from '@/lib/constants';
import { effectiveStats, MASTERWORK_STAT_BONUS, rollStats } from '@/lib/armor/effectiveStats';

export interface ParsedStatLine {
  stat: Stat;
  /** Intrinsic roll from parse (ItemStats minus mods minus MW). */
  intrinsic: number;
  /** Equipped stat mod from socket investmentStats. */
  mod: number;
  /** +2 when masterworked and stat is on the piece. */
  masterwork: number;
  /** Intrinsic + MW (dominance / dismantle comparison). */
  roll: number;
  /** Intrinsic + MW + mods (in-game / card display). */
  effective: number;
}

/** Reconstruct per-stat breakdown from parsed ArmorPiece fields (no live API needed). */
export function statLinesFromPiece(piece: ArmorPiece): ParsedStatLine[] {
  const eff = effectiveStats(piece);
  const roll = rollStats(piece);
  const lines: ParsedStatLine[] = [];

  for (const stat of STATS) {
    const intrinsic = piece.baseStats[stat] ?? 0;
    const mod = piece.modStats?.[stat] ?? 0;
    const masterwork =
      piece.isMasterwork && intrinsic > 0 ? MASTERWORK_STAT_BONUS : 0;
    const rollVal = roll[stat] ?? 0;
    const effVal = eff[stat] ?? 0;
    if (intrinsic === 0 && mod === 0 && rollVal === 0 && effVal === 0) continue;
    lines.push({
      stat,
      intrinsic,
      mod,
      masterwork,
      roll: rollVal,
      effective: effVal,
    });
  }

  return lines;
}

export function formatStatLineSummary(line: ParsedStatLine): string {
  const parts = [`${STAT_LABELS[line.stat]} ${line.intrinsic}`];
  if (line.mod) parts.push(`+${line.mod} mod`);
  if (line.masterwork) parts.push(`+${line.masterwork} MW`);
  if (line.mod || line.masterwork) parts.push(`→ ${line.effective} in-game`);
  return parts.join(' ');
}
