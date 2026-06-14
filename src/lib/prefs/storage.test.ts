import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCalibrationChoiceCount } from '@/lib/prefs/calibrationChoices';
import { createAutoFilterRule } from '@/lib/auto-filter/match';
import { loadPrefs, parseImportedPrefs, savePrefs } from './storage';
import {
  defaultPreferenceProfile,
  getClassPrefs,
  migrateProfile,
} from '@/lib/prefs/profile';

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

describe('parseImportedPrefs', () => {
  it('merges partial exports with defaults per class', () => {
    const base = defaultPreferenceProfile();
    const imported = parseImportedPrefs(
      JSON.stringify({
        statWeights: { weapons: 99 },
        calibrationChoices: {
          mode: { key: 'mode', recordedAt: 1 },
        },
      }),
    );
    const hunter = getClassPrefs(imported, 'hunter');
    expect(hunter.statWeights.weapons).toBe(99);
    expect(hunter.statWeights.grenade).toBe(base.classPrefs.hunter.statWeights.grenade);
    expect(getCalibrationChoiceCount(hunter)).toBe(1);
  });

  it('drops legacy buildMode from imported prefs', () => {
    const imported = parseImportedPrefs(
      JSON.stringify({
        classPrefs: {
          hunter: { buildMode: 'pvp', statWeights: { weapons: 99 } },
        },
      }),
    );
    expect(getClassPrefs(imported, 'hunter')).not.toHaveProperty('buildMode');
  });

});

describe('migrateProfile', () => {
  it('copies v1 global prefs to all classes', () => {
    const migrated = migrateProfile({
      version: 1,
      statWeights: { weapons: 0.9 },
      tertiaryWeights: { super: 0.88, weapons: 0.22 },
      tuningWeights: { weapons: 0.85, melee: 0.2 },
      calibrationCount: 10,
    });
    expect(migrated.version).toBe(2);
    expect(getClassPrefs(migrated, 'titan').statWeights.weapons).toBe(0.9);
    expect(getClassPrefs(migrated, 'hunter').tertiaryWeights.gunner?.super).toBe(0.88);
    expect(getClassPrefs(migrated, 'hunter').tertiaryWeights.paragon?.super).toBe(0.88);
    expect(getClassPrefs(migrated, 'hunter').tuningWeights.brawler?.weapons).toBe(0.85);
    expect(getClassPrefs(migrated, 'hunter').tuningWeights.gunner?.weapons).toBe(0.85);
    expect(getCalibrationChoiceCount(getClassPrefs(migrated, 'hunter'))).toBe(0);
  });

  it('strips legacy redundant roll grouping prefs from profile', () => {
    const migrated = migrateProfile({
      version: 2,
      classPrefs: {},
      redundantGroupBySet: true,
      redundantGroupByTuning: false,
    });
    expect(migrated).not.toHaveProperty('redundantGroupBySet');
    expect(migrated).not.toHaveProperty('redundantGroupByTuning');
  });

  it('fills missing archetype weights and infers tertiary weights for new archetypes', () => {
    const legacyArchetypes = {
      gunner: 1,
      grenadier: 0.9,
      paragon: 0.8,
      brawler: 0.7,
      bulwark: 0.6,
      specialist: 0.5,
    };
    const migrated = migrateProfile({
      version: 2,
      classPrefs: {
        hunter: {
          archetypeWeights: legacyArchetypes,
          tertiaryWeights: {
            gunner: { super: 0.9, melee: 0.4 },
            grenadier: { weapons: 0.7, melee: 0.5 },
          },
        },
      },
    });
    const hunter = getClassPrefs(migrated, 'hunter');
    expect(hunter.archetypeWeights.reaver).toBe(0.6);
    expect(hunter.archetypeWeights.gunner).toBe(1);
    expect(hunter.tertiaryWeights.demolitionist?.weapons).toBeCloseTo(0.7);
  });

  it('strips legacy dupe rule keys from stored defaultDupeRules', () => {
    const migrated = migrateProfile({
      version: 2,
      classPrefs: {},
      defaultDupeRules: {
        dupeModeBogOnMyDog: true,
        dupeModeMarruk: true,
        sameArmorSet: true,
      },
    });
    expect(migrated.defaultDupeRules).not.toHaveProperty('dupeModeBogOnMyDog');
    expect(migrated.defaultDupeRules).not.toHaveProperty('dupeModeMarruk');
    expect(migrated.defaultDupeRules.sameArmorSet).toBe(true);
  });
});

describe('autoFilterRules storage', () => {
  beforeEach(() => {
    local.clear();
  });

  it('roundtrips class-only rules through save and load', () => {
    const rule = createAutoFilterRule({ classType: 'hunter' });
    const profile = { ...defaultPreferenceProfile(), autoFilterRules: [rule] };
    savePrefs(profile);
    const loaded = loadPrefs();
    expect(loaded.autoFilterRules).toHaveLength(1);
    expect(loaded.autoFilterRules?.[0]).toMatchObject({
      id: rule.id,
      classType: 'hunter',
      enabled: true,
    });
  });

  it('persists enable, edit, and delete changes', () => {
    const rule = createAutoFilterRule({ classType: 'hunter', archetype: 'bulwark' });
    let profile = { ...defaultPreferenceProfile(), autoFilterRules: [rule] };
    savePrefs(profile);

    profile = {
      ...profile,
      autoFilterRules: profile.autoFilterRules!.map((r) =>
        r.id === rule.id ? { ...r, enabled: false, archetype: 'gunner' as const } : r,
      ),
    };
    savePrefs(profile);
    expect(loadPrefs().autoFilterRules?.[0]).toMatchObject({
      enabled: false,
      archetype: 'gunner',
    });

    profile = { ...profile, autoFilterRules: [] };
    savePrefs(profile);
    expect(loadPrefs().autoFilterRules).toEqual([]);
  });
});
