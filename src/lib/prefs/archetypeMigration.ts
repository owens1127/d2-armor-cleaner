import { ARCHETYPES, STATS, tertiaryStatsForArchetype } from '@/lib/constants';
import type { Archetype, Stat } from '@/types';

export type PerArchetypeStatWeights = Partial<
  Record<Archetype, Partial<Record<Stat, number>>>
>;

/** Preserve saved ranking and append any archetypes added since calibration. */
export function normalizeArchetypeOrder(order: readonly Archetype[]): Archetype[] {
  const seen = new Set<Archetype>();
  const deduped: Archetype[] = [];
  for (const arch of order) {
    if (!ARCHETYPES.includes(arch) || seen.has(arch)) continue;
    seen.add(arch);
    deduped.push(arch);
  }
  for (const arch of ARCHETYPES) {
    if (!seen.has(arch)) deduped.push(arch);
  }
  return deduped;
}

/** Ensure every current archetype has a weight after registry grows. */
export function normalizeArchetypeWeights(
  saved: Partial<Record<Archetype, number>> | undefined,
  base: Record<Archetype, number>,
): Record<Archetype, number> {
  const merged = { ...base, ...saved };
  return Object.fromEntries(
    ARCHETYPES.map((arch) => [arch, merged[arch] ?? base[arch]]),
  ) as Record<Archetype, number>;
}

function averagePeerStatWeights(
  partial: PerArchetypeStatWeights,
  archetype: Archetype,
  validStats: Stat[],
): Partial<Record<Stat, number>> {
  const peers = ARCHETYPES.filter(
    (arch) =>
      arch !== archetype && partial[arch] && Object.keys(partial[arch]!).length > 0,
  );
  if (peers.length === 0) return {};

  const weights: Partial<Record<Stat, number>> = {};
  for (const stat of validStats) {
    let sum = 0;
    let count = 0;
    for (const peer of peers) {
      const value = partial[peer]?.[stat];
      if (value === undefined) continue;
      sum += value;
      count++;
    }
    if (count > 0) weights[stat] = sum / count;
  }
  return weights;
}

/** Seed new archetypes from peer averages so expanded registries keep scoring sane. */
export function fillMissingPerArchetypeStatWeights(
  partial: PerArchetypeStatWeights,
  validStatsFor: (archetype: Archetype) => Stat[],
): PerArchetypeStatWeights {
  const result: PerArchetypeStatWeights = {};
  for (const arch of ARCHETYPES) {
    if (partial[arch] && Object.keys(partial[arch]!).length > 0) {
      result[arch] = { ...partial[arch] };
    }
  }

  for (const arch of ARCHETYPES) {
    if (result[arch] && Object.keys(result[arch]!).length > 0) continue;
    const inferred = averagePeerStatWeights(result, arch, validStatsFor(arch));
    if (Object.keys(inferred).length > 0) result[arch] = inferred;
  }

  return result;
}

export function fillMissingTertiaryWeights(raw: PerArchetypeStatWeights): PerArchetypeStatWeights {
  return fillMissingPerArchetypeStatWeights(raw, tertiaryStatsForArchetype);
}

export function fillMissingTuningWeights(raw: PerArchetypeStatWeights): PerArchetypeStatWeights {
  return fillMissingPerArchetypeStatWeights(raw, () => [...STATS]);
}

export function fillMissingStatOrders(
  partial: Partial<Record<Archetype, Stat[]>>,
  defaultOrderFor: (archetype: Archetype) => Stat[],
): Partial<Record<Archetype, Stat[]>> {
  const result: Partial<Record<Archetype, Stat[]>> = { ...partial };
  for (const arch of ARCHETYPES) {
    if (result[arch]?.length) continue;
    result[arch] = [...defaultOrderFor(arch)];
  }
  return result;
}
