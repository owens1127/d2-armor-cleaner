import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '@/lib/constants';
import {
  fillMissingTertiaryWeights,
  fillMissingTuningWeights,
  normalizeArchetypeOrder,
  normalizeArchetypeWeights,
} from './archetypeMigration';
import { defaultClassPreferenceProfile } from './profile';

describe('normalizeArchetypeOrder', () => {
  it('preserves a legacy six-archetype ranking and appends new archetypes', () => {
    const legacy = [
      'gunner',
      'grenadier',
      'paragon',
      'brawler',
      'bulwark',
      'specialist',
    ] as const;
    const normalized = normalizeArchetypeOrder(legacy);
    expect(normalized.slice(0, 6)).toEqual([...legacy]);
    expect(normalized).toHaveLength(ARCHETYPES.length);
    expect(normalized.slice(6)).toEqual(ARCHETYPES.slice(6));
  });

  it('dedupes and fills when given a partial list', () => {
    expect(normalizeArchetypeOrder(['gunner'])).toEqual(ARCHETYPES);
  });
});

describe('normalizeArchetypeWeights', () => {
  it('fills missing archetypes from defaults without dropping saved weights', () => {
    const base = defaultClassPreferenceProfile().archetypeWeights;
    const saved = {
      gunner: 1,
      specialist: 0.2,
    };
    const normalized = normalizeArchetypeWeights(saved, base);
    expect(normalized.gunner).toBe(1);
    expect(normalized.specialist).toBe(0.2);
    expect(normalized.reaver).toBe(base.reaver);
  });
});

describe('fillMissingPerArchetypeStatWeights', () => {
  it('infers tertiary weights for new archetypes from calibrated peers', () => {
    const filled = fillMissingTertiaryWeights({
      grenadier: { weapons: 0.7, melee: 0.5 },
    });
    expect(filled.demolitionist?.weapons).toBeCloseTo(0.7);
    expect(filled.demolitionist?.melee).toBeCloseTo(0.5);
  });

  it('infers tuning weights for new archetypes from calibrated peers', () => {
    const filled = fillMissingTuningWeights({
      brawler: { melee: 0.95, weapons: 0.5 },
    });
    expect(filled.skirmisher?.melee).toBeCloseTo(0.95);
    expect(filled.skirmisher?.weapons).toBeCloseTo(0.5);
  });
});
