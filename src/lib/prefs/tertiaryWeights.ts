import { ARCHETYPES, STATS } from '@/lib/constants';
import type { Archetype, Stat } from '@/types';

const STAT_SET = new Set<string>(STATS);
const ARCHETYPE_SET = new Set<string>(ARCHETYPES);

export type TertiaryWeightsMap = Partial<Record<Archetype, Partial<Record<Stat, number>>>>;

function isFlatTertiaryWeights(raw: Record<string, unknown>): boolean {
  const keys = Object.keys(raw);
  if (keys.length === 0) return false;
  return keys.every((k) => STAT_SET.has(k));
}

/**
 * Normalize tertiary weights to per-archetype shape.
 * Legacy flat `{ weapons: 0.8 }` is copied to every archetype.
 */
export function normalizeTertiaryWeights(raw: unknown): TertiaryWeightsMap {
  if (!raw || typeof raw !== 'object') return {};

  const data = raw as Record<string, unknown>;
  const keys = Object.keys(data);
  if (keys.length === 0) return {};

  if (isFlatTertiaryWeights(data)) {
    const flat = data as Partial<Record<Stat, number>>;
    const result: TertiaryWeightsMap = {};
    for (const arch of ARCHETYPES) {
      result[arch] = { ...flat };
    }
    return result;
  }

  const result: TertiaryWeightsMap = {};
  for (const key of keys) {
    if (!ARCHETYPE_SET.has(key)) continue;
    const archWeights = data[key];
    if (archWeights && typeof archWeights === 'object') {
      result[key as Archetype] = { ...(archWeights as Partial<Record<Stat, number>>) };
    }
  }
  return result;
}
