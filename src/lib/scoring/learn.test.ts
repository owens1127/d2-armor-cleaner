import { describe, expect, it } from 'vitest';
import {
  cleanPickCalibrationKey,
  learnFromCleanPick,
} from '@/lib/scoring/learn';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import {
  getCalibrationChoiceCount,
  hasCalibrationChoice,
} from '@/lib/prefs/calibrationChoices';
import type { ArmorPiece, Archetype, Stat } from '@/types';

function piece(
  id: string,
  opts: Partial<ArmorPiece> & { archetype?: Archetype; tertiaryStat?: Stat } = {},
): ArmorPiece {
  return {
    instanceId: id,
    itemHash: 1,
    name: 'Test Armor',
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: opts.archetype ?? 'gunner',
    baseStats: opts.baseStats ?? {},
    tertiaryStat: opts.tertiaryStat ?? 'super',
    isMasterwork: false,
    dimTag: null,
    ...opts,
  };
}

describe('learnFromCleanPick', () => {
  it('bumps setWeights when only the armor set differs', () => {
    const prefs = defaultClassPreferenceProfile();
    const winner = piece('w', {
      armorSet: { hash: 100, name: 'Iron Panoply', perks: [] },
      tuningStat: 'weapons',
      baseStats: { weapons: 10, melee: 10 },
    });
    const loser = piece('l', {
      armorSet: { hash: 200, name: 'Disaster Corps', perks: [] },
      tuningStat: 'weapons',
      baseStats: { weapons: 10, melee: 10 },
    });

    const next = learnFromCleanPick(winner, loser, prefs);

    expect(next.setWeights[100]).toBeGreaterThan(0.4);
    expect(next.setWeights[200]).toBeLessThan(0.4);
    expect(hasCalibrationChoice(next, cleanPickCalibrationKey('set', '100', '200'))).toBe(true);
    expect(getCalibrationChoiceCount(next)).toBe(1);
    expect(next.tuningWeights.gunner?.weapons ?? 0.5).toBe(0.5);
    expect(next.statWeights).toEqual(prefs.statWeights);
  });

  it('bumps tuningWeights when only tuning differs on the same intrinsic roll', () => {
    const prefs = defaultClassPreferenceProfile();
    const winner = piece('w', {
      tuningStat: 'weapons',
      baseStats: { weapons: 10, melee: 10, super: 5 },
    });
    const loser = piece('l', {
      tuningStat: 'melee',
      baseStats: { weapons: 10, melee: 10, super: 5 },
    });

    const next = learnFromCleanPick(winner, loser, prefs);

    expect(next.tuningWeights.gunner?.weapons).toBe(0.6);
    expect(next.tuningWeights.gunner?.melee).toBe(0.45);
    expect(hasCalibrationChoice(next, cleanPickCalibrationKey('tuning', 'gunner', 'melee', 'weapons'))).toBe(
      true,
    );
    expect(getCalibrationChoiceCount(next)).toBe(1);
    expect(next.setWeights[100]).toBeUndefined();
    expect(next.statWeights).toEqual(prefs.statWeights);
  });

  it('learns tuning only when stat split matches but tuning differs', () => {
    const prefs = defaultClassPreferenceProfile();
    const sharedStats = { weapons: 12, melee: 8, super: 5, health: 5, grenade: 5, class: 5 };
    const winner = piece('w', { tuningStat: 'grenade', baseStats: sharedStats });
    const loser = piece('l', { tuningStat: 'super', baseStats: sharedStats });

    const next = learnFromCleanPick(winner, loser, prefs);

    expect(next.tuningWeights.gunner?.grenade).toBeGreaterThan(0.5);
    expect(next.tuningWeights.gunner?.super).toBeLessThan(0.5);
    expect(getCalibrationChoiceCount(next)).toBe(1);
  });

  it('learns stat weights when intrinsic lines differ but tuning matches', () => {
    const prefs = defaultClassPreferenceProfile();
    const winner = piece('w', {
      tuningStat: 'weapons',
      baseStats: { weapons: 5, melee: 5, super: 15, health: 5, grenade: 5, class: 5 },
    });
    const loser = piece('l', {
      tuningStat: 'weapons',
      baseStats: { weapons: 5, melee: 5, super: 5, health: 15, grenade: 5, class: 5 },
    });

    const next = learnFromCleanPick(winner, loser, prefs);

    expect(next.statWeights.super).toBeGreaterThan(prefs.statWeights.super);
    expect(next.statWeights.health).toBeLessThan(prefs.statWeights.health);
    expect(hasCalibrationChoice(next, cleanPickCalibrationKey('stat', 'health', 'super'))).toBe(true);
    expect(next.tuningWeights.gunner?.weapons ?? 0.5).toBe(0.5);
    expect(Object.keys(next.setWeights)).toHaveLength(0);
  });

  it('learns set and tuning without touching stat weights when both differ', () => {
    const prefs = defaultClassPreferenceProfile();
    const sharedStats = { weapons: 10, melee: 10, super: 5, health: 5, grenade: 5, class: 5 };
    const winner = piece('w', {
      armorSet: { hash: 100, name: 'Iron Panoply', perks: [] },
      tuningStat: 'weapons',
      baseStats: sharedStats,
    });
    const loser = piece('l', {
      armorSet: { hash: 200, name: 'Disaster Corps', perks: [] },
      tuningStat: 'melee',
      baseStats: sharedStats,
    });

    const next = learnFromCleanPick(winner, loser, prefs);

    expect(next.setWeights[100]).toBeGreaterThan(0.4);
    expect(next.setWeights[200]).toBeLessThan(0.4);
    expect(next.tuningWeights.gunner?.weapons).toBe(0.6);
    expect(next.tuningWeights.gunner?.melee).toBe(0.45);
    expect(next.statWeights).toEqual(prefs.statWeights);
    expect(getCalibrationChoiceCount(next)).toBe(2);
  });

  it('learns tuning per archetype without cross-contamination', () => {
    const prefs = defaultClassPreferenceProfile();
    const brawlerWinner = piece('w', {
      archetype: 'brawler',
      tuningStat: 'weapons',
      baseStats: { weapons: 10, melee: 10, super: 5 },
    });
    const brawlerLoser = piece('l', {
      archetype: 'brawler',
      tuningStat: 'melee',
      baseStats: { weapons: 10, melee: 10, super: 5 },
    });

    const afterBrawler = learnFromCleanPick(brawlerWinner, brawlerLoser, prefs);

    expect(afterBrawler.tuningWeights.brawler?.weapons).toBe(0.6);
    expect(afterBrawler.tuningWeights.gunner?.weapons ?? 0.5).toBe(0.5);
  });

});
