import { describe, expect, it } from 'vitest';
import type { Stat } from '@/types';
import {
  enumerateValidRollShapes,
  maxPrioritySlotScore,
  optimalEnumeratedRollShapes,
  prioritySlotScore,
  validTertiaryPriorities,
} from './prioritySlotScore';
import { computeOptimalRollShapes } from './achievability';
import { deriveOptimalRollPatterns } from './loadout';

describe('prioritySlotScore matrix', () => {
  it('Super+Weapons+Class: Powerhouse beats Specialist', () => {
    const priorities = ['super', 'weapons', 'class'] as const;
    const powerhouseClass = prioritySlotScore('powerhouse', 'class', 'super', [...priorities]);
    const specialistAttempt = prioritySlotScore('specialist', 'melee', 'class', [...priorities]);
    expect(powerhouseClass).toBeGreaterThan(specialistAttempt);
    expect(powerhouseClass).toBe(7);

    const optimal = optimalEnumeratedRollShapes([...priorities]);
    expect(optimal.every((s) => s.archetype === 'powerhouse')).toBe(true);
    expect(optimal.some((s) => s.tertiaryStat === 'class')).toBe(true);
    expect(optimal.some((s) => s.archetype === 'specialist')).toBe(false);
  });

  it('Weapons+Super 2-stat: Powerhouse beats Gunner split', () => {
    const priorities = ['weapons', 'super'] as const;
    const powerhouseFlex = prioritySlotScore('powerhouse', 'melee', 'super', [...priorities]);
    const gunnerSplit = prioritySlotScore('gunner', 'super', 'weapons', [...priorities]);
    expect(powerhouseFlex).toBeGreaterThan(gunnerSplit);
    expect(powerhouseFlex).toBe(7);
    expect(gunnerSplit).toBe(5.5);

    const max = maxPrioritySlotScore([...priorities]);
    expect(max).toBe(7);
    expect(computeOptimalRollShapes([...priorities]).every((s) => s.archetype === 'powerhouse')).toBe(
      true,
    );
  });

  it('Weapons+Super+Grenade: Powerhouse with grenade tertiary wins', () => {
    const priorities = ['weapons', 'super', 'grenade'] as const;
    const powerhouseGrenade = prioritySlotScore(
      'powerhouse',
      'grenade',
      'grenade',
      [...priorities],
    );
    const gunnerSplit = prioritySlotScore('gunner', 'super', 'weapons', [...priorities]);
    expect(powerhouseGrenade).toBeGreaterThan(gunnerSplit);
    expect(powerhouseGrenade).toBe(9);

    const shapes = computeOptimalRollShapes([...priorities]);
    expect(shapes).toEqual([{ archetype: 'powerhouse', tertiaryStat: 'grenade' }]);
  });

  it('excludes irrelevant tuning columns from valid shapes', () => {
    const priorities = ['weapons', 'super'] as const;
    const shapes = enumerateValidRollShapes([...priorities]);
    expect(shapes.every((s) => (priorities as readonly Stat[]).includes(s.tuningStat))).toBe(true);
    expect(shapes.some((s) => s.tuningStat === 'grenade')).toBe(false);
  });

  it('deriveOptimalRollPatterns sorts columns by score descending', () => {
    const patterns = deriveOptimalRollPatterns(['weapons', 'super']);
    expect(patterns).toHaveLength(2);
    expect(patterns.every((p) => p.archetype === 'powerhouse')).toBe(true);
    expect(patterns[0]!.tuningStat).toBe('weapons');
    expect(patterns[1]!.tuningStat).toBe('super');
  });

  it('Weapons+Super+Class+Grenade: both lower tertiaries with all priority tunings', () => {
    const priorities = ['weapons', 'super', 'class', 'grenade'] as const;
    expect(validTertiaryPriorities([...priorities])).toEqual(['class', 'grenade']);

    const patterns = deriveOptimalRollPatterns([...priorities]);
    expect(patterns.every((p) => p.archetype === 'powerhouse')).toBe(true);

    const classTert = patterns.filter((p) => p.tertiaryStat === 'class');
    const grenadeTert = patterns.filter((p) => p.tertiaryStat === 'grenade');
    expect(classTert).toHaveLength(4);
    expect(grenadeTert).toHaveLength(4);
    expect(classTert.map((p) => p.tuningStat).sort()).toEqual([
      'class',
      'grenade',
      'super',
      'weapons',
    ]);
    expect(grenadeTert.map((p) => p.tuningStat).sort()).toEqual([
      'class',
      'grenade',
      'super',
      'weapons',
    ]);

    const shapes = enumerateValidRollShapes([...priorities]).filter(
      (s) => s.archetype === 'powerhouse',
    );
    expect(shapes.every((s) => ([...priorities] as Stat[]).includes(s.tuningStat))).toBe(true);
    expect(shapes.some((s) => s.tertiaryStat === 'melee')).toBe(false);
  });
});
