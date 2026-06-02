import { describe, expect, it } from 'vitest';
import {
  createAutoFilterRule,
  criterionMatches,
  findAutoFilterMatches,
  isProtectedFromAutoJunk,
  normalizeAutoFilterRules,
  pieceMatchesRule,
} from '@/lib/auto-filter/match';
import type { ArmorPiece, AutoFilterRule, PendingTag } from '@/types';

function piece(id: string, opts: Partial<ArmorPiece> = {}): ArmorPiece {
  return {
    instanceId: id,
    itemHash: 1,
    name: `Piece ${id}`,
    classType: 'hunter',
    armorSlot: 'helmet',
    tier: 5,
    power: 450,
    location: 'vault',
    archetype: 'bulwark',
    baseStats: { health: 30, class: 25, weapons: 20 },
    tertiaryStat: 'health',
    isMasterwork: false,
    dimTag: null,
    ...opts,
  };
}

const emptyExclusions = {
  bucketJunkedIds: [] as string[],
  bucketKeptBothIds: [] as string[],
  bucketKeptSideIds: [] as string[],
  pendingTags: [] as PendingTag[],
};

describe('pieceMatchesRule', () => {
  const rule: AutoFilterRule = createAutoFilterRule({
    classType: 'hunter',
    archetype: 'bulwark',
    tertiaryStat: 'health',
  });

  it('matches positive criteria', () => {
    expect(pieceMatchesRule(piece('a'), rule)).toBe(true);
    expect(pieceMatchesRule(piece('a', { classType: 'titan' }), rule)).toBe(false);
  });

  it.each([
    ['NOT archetype', createAutoFilterRule({ classType: 'hunter', archetype: 'bulwark', archetypeMatchMode: 'not' }), { archetype: 'gunner' as const }, true],
    ['anyOf archetype', createAutoFilterRule({ classType: 'hunter', archetype: 'bulwark', archetypeMatchMode: 'anyOf', archetypes: ['bulwark', 'gunner'] }), { archetype: 'gunner' as const }, true],
  ])('%s', (_label, testRule, opts, expected) => {
    expect(pieceMatchesRule(piece('a', opts), testRule)).toBe(expected);
  });
});

describe('isProtectedFromAutoJunk', () => {
  it('blocks DIM tags, pending tags, and session keep decisions', () => {
    const item = piece('a');
    expect(isProtectedFromAutoJunk(item, emptyExclusions)).toBe(false);
    expect(isProtectedFromAutoJunk({ ...item, dimTag: 'keep' }, emptyExclusions)).toBe(true);
    expect(
      isProtectedFromAutoJunk(item, {
        ...emptyExclusions,
        pendingTags: [{ instanceId: 'a', tag: 'junk', itemName: 'x', classType: 'hunter' }],
      }),
    ).toBe(true);
    expect(
      isProtectedFromAutoJunk(item, { ...emptyExclusions, bucketKeptSideIds: ['a'] }),
    ).toBe(true);
  });
});

describe('findAutoFilterMatches', () => {
  it('returns matching unprotected items and dedupes overlapping rules', () => {
    const rule = createAutoFilterRule({ classType: 'hunter', archetype: 'bulwark' });
    const items = [piece('a'), piece('b', { archetype: 'gunner' })];
    const matches = findAutoFilterMatches(items, [rule, { ...rule, id: 'copy' }], emptyExclusions);
    expect(matches.map((m) => m.instanceId)).toEqual(['a']);
  });
});

describe('normalizeAutoFilterRules', () => {
  it('drops invalid entries and coerces match modes', () => {
    const normalized = normalizeAutoFilterRules([
      { id: '1', classType: 'hunter', enabled: true, archetype: 'bulwark', archetypeMatchMode: 'not' },
      { id: 'bad' },
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.archetypeMatchMode).toBe('not');
    expect(criterionMatches('gunner', 'bulwark', 'not')).toBe(true);
  });
});
