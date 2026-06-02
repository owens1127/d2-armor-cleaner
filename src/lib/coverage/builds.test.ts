import { describe, expect, it } from 'vitest';
import {
  assignEncodedBuildId,
  createDesiredBuild,
  defaultBuildName,
  getDesiredBuilds,
  normalizeDesiredBuild,
  normalizeDesiredBuilds,
  normalizeRollPatternSlotRepresentatives,
  normalizeSlotRepresentatives,
  patchDesiredBuildSetBonus,
  resolveDesiredBuild,
} from './builds';
import { encodeDesiredBuildId, isEncodedBuildId } from '@/lib/coverage/buildIdCodec';
import { STATS } from '@/lib/constants';
import { defaultClassPreferenceProfile } from '@/lib/prefs/profile';
import type { DesiredBuild } from '@/types';
import { armorPiece } from '@/test/armorFixtures';

const CLASS = 'hunter' as const;

describe('normalizeDesiredBuild', () => {
  it.each([
    ['priority targets', { id: 'a', name: 'Melee stack', mode: 'priority', statTargets: [{ stat: 'melee', target: 200 }, { stat: 'super', target: 150 }] }],
    ['legacy preset', { id: 'a', name: 'Melee stack', preset: 'melee_super' }],
  ])('%s', (_label, raw) => {
    const build = normalizeDesiredBuild(raw, CLASS);
    expect(build?.statTargets.length).toBeGreaterThanOrEqual(2);
    expect(isEncodedBuildId(build!.id)).toBe(true);
  });

  it('drops invalid builds and stores representatives', () => {
    expect(
      normalizeDesiredBuild({ id: 'a', name: 'X', mode: 'priority', statTargets: [{ stat: 'melee', target: 200 }] }, CLASS),
    ).toBeNull();
    const build = normalizeDesiredBuild(
      {
        id: 'a',
        name: 'Picks',
        mode: 'priority',
        statTargets: [{ stat: 'melee', target: 200 }, { stat: 'super', target: 150 }],
        slotRepresentatives: { chest: 'abc' },
        rollPatternSlotRepresentatives: { 'paragon:weapons:super': { chest: 'abc' } },
      },
      CLASS,
    );
    expect(build?.slotRepresentatives).toEqual({ chest: 'abc' });
    expect(normalizeSlotRepresentatives({ chest: ' x ', bad: 'y' })).toEqual({ chest: 'x' });
    expect(
      normalizeRollPatternSlotRepresentatives({ 'paragon:weapons:super': { chest: 'x' }, bad: { chest: 'y' } }),
    ).toEqual({ 'paragon:weapons:super': { chest: 'x' } });
  });
});

describe('normalizeDesiredBuilds', () => {
  it('dedupes by content id and caps at eight', () => {
    const shared = {
      name: 'Shared',
      mode: 'priority' as const,
      statTargets: [{ stat: 'melee' as const, target: 200 }, { stat: 'super' as const, target: 150 }],
    };
    const normalized = normalizeDesiredBuilds(
      [...Array.from({ length: 4 }, (_, i) => ({ id: 'dup', ...shared, name: `Dup ${i}` })),
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `legacy-${i}`,
          name: `Build ${i}`,
          mode: 'priority' as const,
          statTargets: [
            { stat: STATS[i % STATS.length]!, target: 200 },
            { stat: STATS[(i + 2) % STATS.length]!, target: 150 + i },
          ],
        }))],
      CLASS,
    );
    expect(normalized).toHaveLength(8);
  });
});

describe('getDesiredBuilds and createDesiredBuild', () => {
  it('filters disabled builds and creates distinct ids', () => {
    const enabled = {
      id: 'a',
      name: 'Grenade',
      mode: 'priority' as const,
      statTargets: [{ stat: 'grenade' as const, target: 200 }, { stat: 'super' as const, target: 150 }],
    };
    const prefs = {
      ...defaultClassPreferenceProfile(),
      desiredBuilds: [enabled, { ...enabled, id: 'b', name: 'Off', enabled: false }],
    };
    expect(getDesiredBuilds(prefs, CLASS)).toHaveLength(1);
    const first = createDesiredBuild(prefs, CLASS);
    const second = createDesiredBuild(prefs, CLASS, undefined, 'tier', [first]);
    expect(second.id).not.toBe(first.id);
  });
});

describe('encodeDesiredBuildId', () => {
  const base: DesiredBuild = {
    id: '',
    name: 'Melee',
    mode: 'priority',
    targetsMode: 'tier',
    enabled: true,
    statTargets: [{ stat: 'melee', target: 200 }, { stat: 'super', target: 150 }],
  };

  it('is stable and changes when config changes', () => {
    expect(encodeDesiredBuildId(base, CLASS)).toBe(encodeDesiredBuildId({ ...base }, CLASS));
    const other: DesiredBuild = { ...base, statTargets: [{ stat: 'grenade', target: 200 }, { stat: 'super', target: 150 }] };
    expect(encodeDesiredBuildId(base, CLASS)).not.toBe(encodeDesiredBuildId(other, CLASS));
  });

  it('reassigns id when build config changes on save', () => {
    const saved = normalizeDesiredBuild(
      { id: 'melee', name: 'Melee stack', mode: 'priority', statTargets: [{ stat: 'melee', target: 200 }, { stat: 'super', target: 150 }] },
      CLASS,
    )!;
    expect(saved.legacyId).toBe('melee');
    expect(saved.id).not.toBe('melee');
    expect(isEncodedBuildId(saved.id)).toBe(true);
    const edited: DesiredBuild = { ...saved, statTargets: [{ stat: 'grenade', target: 200 }, { stat: 'super', target: 150 }] };
    const canonical = assignEncodedBuildId(edited, CLASS, saved.id);
    expect(canonical.id).not.toBe(saved.id);
    expect(isEncodedBuildId(canonical.id)).toBe(true);
  });
});

describe('resolveDesiredBuild and naming', () => {
  it('passes through stats and auto-updates default set names', () => {
    const prefs = defaultClassPreferenceProfile();
    const build = createDesiredBuild(prefs, CLASS, 'My melee');
    expect(resolveDesiredBuild(build, prefs).label).toBe('My melee');
    const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
    const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };
    const wsTargets = [{ stat: 'weapons' as const, target: 200 }, { stat: 'super' as const, target: 150 }];
    const named: DesiredBuild = { id: 'b', name: 'Weapons/Super', mode: 'priority', statTargets: wsTargets };
    expect(patchDesiredBuildSetBonus(named, ferro.hash, smoke.hash, [
      armorPiece({ instanceId: 'f', armorSet: ferro }),
      armorPiece({ instanceId: 's', armorSet: smoke }),
    ]).name).toContain('Ferropotent');
    expect(defaultBuildName(wsTargets, ferro.hash, ferro.hash, [armorPiece({ instanceId: 'f', armorSet: ferro })])).toContain('4pc');
  });
});
