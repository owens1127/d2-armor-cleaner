import { resolveArmorSetDisplayName } from '@/lib/items/setIcons';
import type { ArmorPiece } from '@/types';
import type { BuildProfile } from '@/lib/coverage/builds';

const UNKNOWN_SET_LABEL = 'Unknown set';

/** Strip trailing " Set" for compact combo copy (matches build name suffix style). */
export function compactArmorSetDisplayName(name: string): string {
  return name.replace(/\s+Set$/i, '');
}

export interface SetBonusTarget {
  hash: number;
  /** Pieces required from this set to activate the bonus tier. */
  pieces: 2 | 4;
}

/** Parse stored set bonus fields into concrete piece quotas. */
export function parseSetBonusTargets(
  setBonus2pc?: number,
  setBonus4pc?: number,
): SetBonusTarget[] {
  if (setBonus2pc === undefined && setBonus4pc === undefined) return [];
  if (setBonus4pc === undefined) {
    return [{ hash: setBonus2pc!, pieces: 2 }];
  }
  if (setBonus2pc === undefined) {
    return [{ hash: setBonus4pc, pieces: 4 }];
  }
  if (setBonus2pc === setBonus4pc) {
    return [{ hash: setBonus4pc, pieces: 4 }];
  }
  return [
    { hash: setBonus2pc, pieces: 2 },
    { hash: setBonus4pc, pieces: 2 },
  ];
}

export function isDualTwoPieceMix(
  setBonus2pc?: number,
  setBonus4pc?: number,
): boolean {
  return (
    setBonus2pc !== undefined &&
    setBonus4pc !== undefined &&
    setBonus2pc !== setBonus4pc
  );
}

export function totalSetPiecesRequired(targets: SetBonusTarget[]): number {
  return targets.reduce((sum, t) => sum + t.pieces, 0);
}

export function setBonusConfigFromBuild(
  build: Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'>,
): Pick<BuildProfile, 'setBonus2pc' | 'setBonus4pc'> {
  return {
    setBonus2pc: build.setBonus2pc,
    setBonus4pc: build.setBonus4pc,
  };
}

export function countSetPiecesInLoadout(items: ArmorPiece[], setHash: number): number {
  return items.filter((i) => i.armorSet?.hash === setHash).length;
}

/** Armor slots where vault has at least one piece of this set. */
export function countSetSlotsWithPieces(items: ArmorPiece[], setHash: number): number {
  const slots = new Set<string>();
  for (const item of items) {
    if (item.armorSet?.hash === setHash) slots.add(item.armorSlot);
  }
  return slots.size;
}

export function resolveSetName(items: ArmorPiece[], setHash: number): string {
  return resolveArmorSetDisplayName(setHash, items) ?? UNKNOWN_SET_LABEL;
}

/** Unique armor sets present in vault items, sorted by name. */
export function collectArmorSetsFromItems(
  items: ArmorPiece[],
): { hash: number; name: string }[] {
  const map = new Map<number, string>();
  for (const item of items) {
    if (item.armorSet) map.set(item.armorSet.hash, item.armorSet.name);
  }
  return [...map.entries()]
    .map(([hash, name]) => ({ hash, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatSetBonusTargetLabel(
  hash: number,
  pieces: 2 | 4,
  items: ArmorPiece[],
): string {
  const name = compactArmorSetDisplayName(resolveSetName(items, hash));
  return `${pieces}pc ${name}`;
}

export function formatSetBonusTargetsSummary(
  setBonus2pc: number | undefined,
  setBonus4pc: number | undefined,
  items: ArmorPiece[],
): string {
  const targets = parseSetBonusTargets(setBonus2pc, setBonus4pc);
  if (targets.length === 0) return '';
  return targets
    .map((t) => formatSetBonusTargetLabel(t.hash, t.pieces, items))
    .join(' + ');
}

/** Compact set suffix for auto-generated combo names, e.g. `Ferropotent 4pc` or `Ferro 2 + Smoke 2`. */
export function formatSetBonusBuildNameSuffix(
  setBonus2pc?: number,
  setBonus4pc?: number,
  items: ArmorPiece[] = [],
): string {
  const targets = parseSetBonusTargets(setBonus2pc, setBonus4pc);
  if (targets.length === 0) return '';
  if (targets.length === 1) {
    const { hash, pieces } = targets[0];
    return `${resolveSetName(items, hash)} ${pieces}pc`;
  }
  return targets.map((t) => `${resolveSetName(items, t.hash)} 2`).join(' + ');
}

/** Prefer pieces from configured target sets when comparing loadout candidates. */
export function setPreferenceScore(
  piece: ArmorPiece,
  targets: SetBonusTarget[],
  currentCounts?: ReadonlyMap<number, number>,
): number {
  const hash = piece.armorSet?.hash;
  if (hash === undefined || targets.length === 0) return 0;
  const target = targets.find((t) => t.hash === hash);
  if (!target) return 0;
  if (currentCounts) {
    const have = currentCounts.get(hash) ?? 0;
    if (have >= target.pieces) return 0;
    return target.pieces - have;
  }
  return 1;
}

export function isSetTargetPiece(
  piece: ArmorPiece | null | undefined,
  targets: SetBonusTarget[],
): boolean {
  const hash = piece?.armorSet?.hash;
  return hash !== undefined && targets.some((t) => t.hash === hash);
}
