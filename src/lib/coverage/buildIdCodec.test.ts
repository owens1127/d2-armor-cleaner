import { describe, expect, it } from 'vitest';
import {
  BUILD_ID_PREFIX,
  decodeBuildId,
  encodeBuildId,
  encodeDesiredBuildId,
  ENCODED_BUILD_ID_PATTERN,
  isEncodedBuildId,
} from './buildIdCodec';
import type { DesiredBuild } from '@/types';

const CLASS = 'hunter' as const;

const baseBuild: DesiredBuild = {
  id: '',
  name: 'Melee',
  mode: 'priority',
  targetsMode: 'tier',
  enabled: true,
  statTargets: [
    { stat: 'melee', target: 200 },
    { stat: 'super', target: 150 },
  ],
};

describe('encodeBuildId / decodeBuildId', () => {
  it('round-trips a build definition', () => {
    const id = encodeDesiredBuildId(baseBuild, CLASS);
    expect(id).toMatch(ENCODED_BUILD_ID_PATTERN);
    const decoded = decodeBuildId(id);
    expect(decoded?.classType).toBe(CLASS);
    expect(decoded?.statTargets).toEqual(baseBuild.statTargets);
    expect(decoded?.targetsMode).toBe('tier');
    expect(decoded?.enabled).toBe(true);
  });

  it('is stable for identical configs', () => {
    const a = encodeDesiredBuildId(baseBuild, CLASS);
    const b = encodeDesiredBuildId({ ...baseBuild }, CLASS);
    expect(a).toBe(b);
  });

  it('differs when stat priorities change', () => {
    const other: DesiredBuild = {
      ...baseBuild,
      statTargets: [
        { stat: 'grenade', target: 200 },
        { stat: 'super', target: 150 },
      ],
    };
    expect(encodeDesiredBuildId(baseBuild, CLASS)).not.toBe(
      encodeDesiredBuildId(other, CLASS),
    );
  });

  it('includes set bonuses in the id', () => {
    const withBonus: DesiredBuild = {
      ...baseBuild,
      setBonus2pc: 100,
      setBonus4pc: 100,
    };
    expect(encodeDesiredBuildId(baseBuild, CLASS)).not.toBe(
      encodeDesiredBuildId(withBonus, CLASS),
    );
  });

  it('rejects invalid definitions', () => {
    expect(() =>
      encodeBuildId({
        classType: CLASS,
        targetsMode: 'tier',
        enabled: true,
        statTargets: [{ stat: 'melee', target: 200 }],
      }),
    ).toThrow();
  });

  it('rejects non-encoded ids', () => {
    expect(isEncodedBuildId('melee')).toBe(false);
    expect(isEncodedBuildId(`${BUILD_ID_PREFIX}bad`)).toBe(true);
    expect(decodeBuildId('melee')).toBeNull();
  });
});
