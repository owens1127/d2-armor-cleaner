import { beforeEach, describe, expect, it, vi } from 'vitest';

const { localStorageMock, local } = vi.hoisted(() => {
  const local = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => {
      local.set(key, value);
    },
    removeItem: (key: string) => {
      local.delete(key);
    },
    clear: () => {
      local.clear();
    },
  };
  return { localStorageMock, local };
});

vi.stubGlobal('localStorage', localStorageMock);
import { encodeBuildId } from '@/lib/coverage/buildIdCodec';
import {
  authenticatedLandingPath,
  browseRedundantPath,
  buildAuthenticatedNavLinks,
  classSwitchPath,
  resolveCombosBuildId,
  settingsPath,
} from './nav';
import { LS_ONBOARDING } from '@/lib/storage/keys';
import type { DesiredBuild } from '@/types';

const MELEE_SUPER_ID = encodeBuildId({
  classType: 'hunter',
  targetsMode: 'tier',
  enabled: true,
  statTargets: [
    { stat: 'melee', target: 200 },
    { stat: 'super', target: 150 },
  ],
});

const FERRO_ID = encodeBuildId({
  classType: 'hunter',
  targetsMode: 'tier',
  enabled: true,
  statTargets: [
    { stat: 'weapons', target: 200 },
    { stat: 'super', target: 150 },
  ],
  setBonus2pc: 100,
  setBonus4pc: 200,
});

function build(id: string): Pick<DesiredBuild, 'id' | 'enabled'> {
  return { id, enabled: true };
}

beforeEach(() => {
  local.clear();
});

describe('buildAuthenticatedNavLinks', () => {
  it('omits Home and starts with Dashboard for the active class', () => {
    const links = buildAuthenticatedNavLinks('warlock');
    expect(links.map((l) => l.label)).not.toContain('Home');
    expect(links[0]).toEqual({
      label: 'Dashboard',
      match: '/dashboard',
      to: '/dashboard/warlock',
    });
    expect(links.find((l) => l.label === 'Settings')).toEqual({
      label: 'Settings',
      match: '/settings',
      to: settingsPath('warlock'),
    });
  });
});

describe('authenticatedLandingPath', () => {
  it('returns class dashboard when onboarding is complete', () => {
    local.set(LS_ONBOARDING, 'true');
    expect(authenticatedLandingPath('titan')).toBe('/dashboard/titan');
  });
});

describe('classSwitchPath', () => {
  it('swaps class segment on class-aware routes and preserves query and hash', () => {
    expect(classSwitchPath('/dashboard/hunter', '', '', 'titan')).toBe('/dashboard/titan');
    expect(
      classSwitchPath(
        '/combos/hunter',
        `?build=${encodeURIComponent(MELEE_SUPER_ID)}`,
        '#combos',
        'titan',
      ),
    ).toBe(`/combos/titan?build=${encodeURIComponent(MELEE_SUPER_ID)}#combos`);
    expect(
      classSwitchPath(
        '/browse/warlock',
        `?build=${encodeURIComponent(FERRO_ID)}`,
        '',
        'hunter',
      ),
    ).toBe(`/browse/hunter?build=${encodeURIComponent(FERRO_ID)}`);
    expect(classSwitchPath('/duel/titan', '', '', 'warlock')).toBe('/duel/warlock');
    expect(classSwitchPath('/settings/warlock', '', '', 'hunter')).toBe('/settings/hunter');
  });

  it('maps legacy clean and build routes to duel and combos', () => {
    expect(classSwitchPath('/clean/hunter', '?bucket=helmet', '', 'titan')).toBe(
      '/duel/titan?bucket=helmet',
    );
    expect(
      classSwitchPath(
        '/build/hunter',
        `?build=${encodeURIComponent(MELEE_SUPER_ID)}`,
        '#desired-builds',
        'warlock',
      ),
    ).toBe(`/combos/warlock?build=${encodeURIComponent(MELEE_SUPER_ID)}#combos`);
  });

  it('updates calibrate class query param without dropping other params', () => {
    expect(
      classSwitchPath('/onboarding/calibrate', '?step=archetype&class=hunter', '', 'titan'),
    ).toBe('/onboarding/calibrate?step=archetype&class=titan');
  });

  it('returns null on class-agnostic routes so the page type is preserved', () => {
    for (const pathname of ['/review', '/auto-filters', '/', '/home']) {
      expect(classSwitchPath(pathname, '', '', 'titan')).toBeNull();
    }
    expect(classSwitchPath('/onboarding/rules', '', '', 'warlock')).toBeNull();
    expect(classSwitchPath('/onboarding/inventory', '', '', 'hunter')).toBeNull();
  });
});

describe('browseRedundantPath', () => {
  it('links browse with redundant query', () => {
    expect(browseRedundantPath('hunter')).toBe('/browse/hunter?redundant=1');
  });
});

describe('resolveCombosBuildId', () => {
  const builds = [build(MELEE_SUPER_ID), build(FERRO_ID)];

  it('returns matching encoded param when valid', () => {
    expect(resolveCombosBuildId(MELEE_SUPER_ID, builds, 'hunter')).toBe(MELEE_SUPER_ID);
    expect(resolveCombosBuildId(FERRO_ID, builds, 'hunter')).toBe(FERRO_ID);
  });

  it('accepts decoded share ids not yet saved locally', () => {
    expect(resolveCombosBuildId(MELEE_SUPER_ID, [], 'hunter')).toBe(MELEE_SUPER_ID);
  });

  it('falls back to first enabled combo when param is missing or invalid', () => {
    expect(resolveCombosBuildId(null, builds, 'hunter')).toBe(MELEE_SUPER_ID);
    expect(resolveCombosBuildId('melee', builds, 'hunter')).toBe(MELEE_SUPER_ID);
    expect(resolveCombosBuildId('b1.invalid!!!', builds, 'hunter')).toBe(MELEE_SUPER_ID);
  });

  it('returns empty string when no combos exist and param is invalid', () => {
    expect(resolveCombosBuildId('melee', [], 'hunter')).toBe('');
    expect(resolveCombosBuildId(null, [], 'hunter')).toBe('');
  });
});
