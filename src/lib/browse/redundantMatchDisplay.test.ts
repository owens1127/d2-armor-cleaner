import { describe, expect, it } from 'vitest';
import { armorPiece } from '@/test/armorFixtures';
import type { DismantleDisplayGroup } from '@/lib/dupes/dismantle';
import {
  analyzeRedundantGroupMatch,
  formatRedundantGroupLowerLine,
  formatRedundantGroupMatchingLine,
} from '@/lib/browse/redundantMatchDisplay';

describe('analyzeRedundantGroupMatch', () => {
  it('summarizes shared tertiary, tuning, and stat lines for tuning duplicates', () => {
    const keeper = armorPiece({
      instanceId: 'keep',
      name: 'Keeper Mask',
      baseStats: { weapons: 30, grenade: 25, super: 20 },
      tuningStat: 'weapons',
      tertiaryStat: 'super',
    });
    const dup = armorPiece({
      instanceId: 'dup',
      name: 'Dup Mask',
      baseStats: { weapons: 30, grenade: 25, super: 20 },
      tuningStat: 'weapons',
      tertiaryStat: 'super',
    });
    const group: DismantleDisplayGroup = {
      id: 'tuning-1',
      slot: 'helmet',
      reason: 'tuning-duplicate',
      members: [
        { piece: keeper, role: 'keeper', copyCount: 1, instanceIds: ['keep'] },
        {
          piece: dup,
          role: 'redundant',
          copyCount: 1,
          instanceIds: ['dup'],
          candidate: {
            item: dup,
            peer: keeper,
            reason: 'tuning-duplicate',
            tuningCoverage: { peer: keeper, mutual: true },
          },
        },
      ],
    };

    const match = analyzeRedundantGroupMatch(group);
    expect(match.sharedTertiary).toBe('super');
    expect(match.sharedTuning).toBe('weapons');
    expect(match.sharedStatEntries.map((e) => `${e.stat}:${e.value}`)).toEqual([
      'weapons:30',
      'grenade:25',
      'super:20',
    ]);
    expect(formatRedundantGroupMatchingLine(match, 'tuning-duplicate')).toBe(
      'Matching: Super tertiary · Weapons tuning',
    );
  });

  it('summarizes lower stats for stat-lower groups', () => {
    const keeper = armorPiece({
      instanceId: 'keep',
      baseStats: { weapons: 35, grenade: 25, super: 23 },
      tertiaryStat: 'super',
      tuningStat: undefined,
    });
    const junk = armorPiece({
      instanceId: 'junk',
      baseStats: { weapons: 28, grenade: 25, super: 20 },
      tertiaryStat: 'super',
      tuningStat: undefined,
    });
    const group: DismantleDisplayGroup = {
      id: 'stat-1',
      slot: 'helmet',
      reason: 'stat-lower',
      members: [
        { piece: keeper, role: 'keeper', copyCount: 1, instanceIds: ['keep'] },
        {
          piece: junk,
          role: 'redundant',
          copyCount: 1,
          instanceIds: ['junk'],
          candidate: {
            item: junk,
            peer: keeper,
            reason: 'stat-lower',
            dominatorResult: {
              dominator: keeper,
              beatsOn: [
                { stat: 'weapons', delta: 7 },
                { stat: 'super', delta: 3 },
              ],
            },
          },
        },
      ],
    };

    const match = analyzeRedundantGroupMatch(group);
    expect(formatRedundantGroupMatchingLine(match, 'stat-lower')).toBe(
      'Matching: Super tertiary',
    );
    expect(formatRedundantGroupLowerLine(match)).toBe(
      'Lower on: Weapons −7 · Super −3',
    );
  });
});
