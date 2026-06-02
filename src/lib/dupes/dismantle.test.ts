import { describe, expect, it } from 'vitest';
import {
  allDismantleCandidates,
  findDismantleBySlot,
} from './dismantle';
import { buildDismantleDisplayGroups, buildRedundantBrowseGroups } from '@/lib/browse/redundantGroups';
import { DEFAULT_REDUNDANT_PEER_SCOPE } from '@/lib/scoring/peerScope';
import type { ArmorPiece } from '@/types';

function piece(
  id: string,
  stats: Partial<Record<'weapons' | 'grenade' | 'super' | 'melee' | 'health' | 'class', number>>,
  opts: Partial<ArmorPiece> = {},
): ArmorPiece {
  return {
    instanceId: id,
    itemHash: 1,
    name: `Piece ${id}`,
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'gunner',
    baseStats: stats,
    tertiaryStat: 'super',
    isMasterwork: false,
    dimTag: null,
    armorSet: { hash: 1, name: 'Ferropotent', perks: [] },
    ...opts,
  };
}

describe('findDismantleBySlot', () => {
  it('includes stat-lower dominated pieces', () => {
    const keeper = piece('keep', { weapons: 35, grenade: 25, super: 23 });
    const junk = piece('junk', { weapons: 28, grenade: 25, super: 20 });
    const helmet = findDismantleBySlot([keeper, junk], 'hunter').get('helmet') ?? [];
    expect(helmet[0]?.reason).toBe('stat-lower');
    expect(helmet[0]?.item.instanceId).toBe('junk');
  });

  it('includes tuning-duplicate pieces and respects set scope', () => {
    const a = piece('a', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons' });
    const b = piece('b', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons', power: 460 });
    const candidates = allDismantleCandidates([a, b], 'hunter');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].reason).toBe('tuning-duplicate');

    const ferro = piece('ferro', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons' });
    const otherSet = piece('other', { weapons: 28, grenade: 25, super: 20 }, {
      tuningStat: 'weapons',
      armorSet: { hash: 2, name: 'Other', perks: [] },
    });
    expect(allDismantleCandidates([ferro, otherSet], 'hunter')).toHaveLength(0);

    const junk = piece('junk', { weapons: 28, grenade: 25, super: 20 }, {
      tuningStat: 'weapons',
      armorSet: { hash: 2, name: 'Other', perks: [] },
    });
    const scoped = allDismantleCandidates(
      [piece('keep', { weapons: 35, grenade: 25, super: 23 }, { tuningStat: 'weapons' }), junk],
      'hunter',
      { ...DEFAULT_REDUNDANT_PEER_SCOPE, groupBySet: false },
    );
    expect(scoped[0]?.reason).toBe('stat-lower');
  });

  it('does not flag sidegrades or mixed tuning as redundant', () => {
    const keeper = piece('keep', { weapons: 35, grenade: 25, super: 20 });
    const sidegrade = piece('side', { weapons: 25, grenade: 25, super: 20 });
    expect(allDismantleCandidates([keeper, sidegrade], 'hunter')).toHaveLength(0);
    expect(
      allDismantleCandidates(
        [
          piece('a', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons' }),
          piece('b', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'grenade', power: 460 }),
        ],
        'hunter',
      ),
    ).toHaveLength(0);
  });
});

describe('buildDismantleDisplayGroups', () => {
  it('groups stat-lower candidates with their keeper in one grid', () => {
    const keeper = piece('keep', { weapons: 35, grenade: 25, super: 23 });
    const junkA = piece('junk-a', { weapons: 28, grenade: 25, super: 20 });
    const junkB = piece('junk-b', { weapons: 30, grenade: 22, super: 20 });
    const candidates = allDismantleCandidates([keeper, junkA, junkB], 'hunter');
    const groups = buildDismantleDisplayGroups(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.reason).toBe('stat-lower');
    expect(groups[0]?.members).toHaveLength(3);
    expect(groups[0]?.members[0]?.role).toBe('keeper');
    expect(groups[0]?.members[0]?.piece.instanceId).toBe('keep');
    expect(groups[0]?.members.filter((m) => m.role === 'redundant')).toHaveLength(2);
  });

  it('includes keeper and redundant copies for tuning duplicates', () => {
    const keeper = piece('keep', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons' });
    const dup = piece('dup', { weapons: 30, grenade: 25, super: 20 }, {
      tuningStat: 'weapons',
      power: 440,
    });
    const candidates = allDismantleCandidates([keeper, dup], 'hunter');
    const groups = buildRedundantBrowseGroups(candidates, [keeper, dup]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.reason).toBe('tuning-duplicate');
    const ids = groups[0]?.members.map((m) => m.piece.instanceId).sort();
    expect(ids).toEqual(['dup', 'keep']);
    expect(groups[0]?.members.find((m) => m.role === 'keeper')?.piece.instanceId).toBe('keep');
  });

  it('shows every piece in a mutual tuning cluster', () => {
    const a = piece('a', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons', power: 460 });
    const b = piece('b', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons', power: 450 });
    const c = piece('c', { weapons: 30, grenade: 25, super: 20 }, { tuningStat: 'weapons', power: 440 });
    const items = [a, b, c];
    const candidates = allDismantleCandidates(items, 'hunter');
    expect(candidates).toHaveLength(2);
    const groups = buildRedundantBrowseGroups(candidates, items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members).toHaveLength(3);
    expect(groups[0]?.members[0]?.role).toBe('keeper');
    expect(groups[0]?.members.filter((m) => m.role === 'redundant')).toHaveLength(2);
  });
});
