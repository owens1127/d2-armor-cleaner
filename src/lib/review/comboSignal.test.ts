import { describe, expect, it } from 'vitest';
import { buildBuildOptimalLookups } from '@/lib/coverage/buildOptimal';
import { getDesiredBuilds } from '@/lib/coverage/builds';
import { defaultPreferenceProfile, migrateProfile } from '@/lib/prefs/profile';
import { buildReviewComboSignalMap } from '@/lib/review/comboSignal';
import { weaponsSuperVault } from '@/test/armorFixtures';
import type { PendingTag, PreferenceProfile } from '@/types';

function profileWithWsDemo(): PreferenceProfile {
  const profile = defaultPreferenceProfile();
  profile.classPrefs.hunter = {
    ...profile.classPrefs.hunter,
    desiredBuilds: [
      {
        id: 'ws-demo',
        name: 'Weapons/Super Demo',
        mode: 'priority',
        targetsMode: 'tier',
        statTargets: [
          { stat: 'weapons', target: 200 },
          { stat: 'super', target: 150 },
        ],
        enabled: true,
      },
    ],
  };
  return profile;
}

const demoTags: PendingTag[] = [
  {
    instanceId: 'demo-combo-tag-k',
    itemName: 'Verify Keep',
    classType: 'hunter',
    tag: 'keep',
    archetype: 'powerhouse',
    tertiaryStat: 'melee',
    tuningStat: 'weapons',
  },
  {
    instanceId: 'demo-combo-tag-j',
    itemName: 'Verify Junk',
    classType: 'hunter',
    tag: 'junk',
    archetype: 'powerhouse',
    tertiaryStat: 'melee',
    tuningStat: 'weapons',
  },
];

describe('buildReviewComboSignalMap', () => {
  it('shows combo signal for pending tag roll without vault item', () => {
    const profile = profileWithWsDemo();
    const vault = weaponsSuperVault('hunter');
    const lookups = buildBuildOptimalLookups(profile, vault);
    const itemsById = new Map(vault.map((item) => [item.instanceId, item]));

    const signalMap = buildReviewComboSignalMap(demoTags, itemsById, lookups);

    expect(signalMap.get('demo-combo-tag-k')?.count).toBeGreaterThan(0);
    expect(signalMap.get('demo-combo-tag-j')?.count).toBeGreaterThan(0);
  });

  it('shows combo signal when tag lacks roll fields but vault item exists', () => {
    const profile = profileWithWsDemo();
    const vault = weaponsSuperVault('hunter');
    const helm = vault.find((i) => i.armorSlot === 'helmet')!;
    const lookups = buildBuildOptimalLookups(profile, vault);
    const itemsById = new Map(vault.map((item) => [item.instanceId, item]));

    const tags: PendingTag[] = [
      {
        instanceId: helm.instanceId,
        itemName: helm.name,
        classType: 'hunter',
        tag: 'keep',
      },
    ];

    const signalMap = buildReviewComboSignalMap(tags, itemsById, lookups);
    expect(signalMap.get(helm.instanceId)?.count).toBeGreaterThan(0);
  });

  it('matches migrated browser prefs (ws-demo + encoded build ids)', () => {
    const profile = migrateProfile({
      version: 2,
      classPrefs: {
        hunter: {
          desiredBuilds: [
            {
              id: 'ws-demo',
              name: 'Weapons/Super Demo',
              mode: 'priority',
              targetsMode: 'tier',
              statTargets: [
                { stat: 'weapons', target: 200 },
                { stat: 'super', target: 150 },
              ],
              enabled: true,
            },
            {
              id: '01KT0NTGB3F2ZK7M5SX3111ANT',
              name: 'Weapons/Grenade · Ferropotent 2 + Smoke Jumper Set 2',
              mode: 'priority',
              targetsMode: 'tier',
              statTargets: [
                { stat: 'weapons', target: 200 },
                { stat: 'grenade', target: 150 },
              ],
              setBonus2pc: 3734029045,
              setBonus4pc: 2751989785,
              enabled: true,
            },
          ],
        },
      },
    });
    expect(getDesiredBuilds(profile.classPrefs.hunter, 'hunter').length).toBeGreaterThan(0);

    const lookups = buildBuildOptimalLookups(profile, []);
    const signalMap = buildReviewComboSignalMap(demoTags, new Map(), lookups);
    expect(signalMap.get('demo-combo-tag-k')?.count).toBeGreaterThan(0);
  });

  it('empty context map yields no signals (Review must consume BuildOptimal inside Layout)', () => {
    const profile = profileWithWsDemo();
    const lookups = buildBuildOptimalLookups(profile, weaponsSuperVault('hunter'));

    expect(buildReviewComboSignalMap(demoTags, new Map(), new Map()).size).toBe(0);
    expect(
      buildReviewComboSignalMap(demoTags, new Map(), lookups).get('demo-combo-tag-k')?.count,
    ).toBeGreaterThan(0);
  });
});
