import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildClassVaultState } from '@/lib/dupes/suggest';
import { bucketKeyString } from '@/lib/dupes/queue';
import { armorPiece, splitSetHelmVault } from '@/test/armorFixtures';
import type { CleanSessionSnapshot } from '@/lib/session/cleanSession';
import { mergeDupeRules } from '@/lib/dupes/rules';
import { emptyBucketSessionFields } from '@/lib/session/bucketSession';
import { planCleanMount, resolveDuelMountBucketKey } from '@/lib/session/cleanSession';
import {
  clearLastDuelBucketKey,
  getLastDuelBucketKey,
  setLastDuelBucketKey,
} from '@/lib/session/lastDuelBucket';

const { localStorageMock } = vi.hoisted(() => {
  const local: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => local[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      local[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete local[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(local)) delete local[k];
    }),
  };
  return { localStorageMock, local };
});

vi.stubGlobal('localStorage', localStorageMock);

function emptyCleanSession(): CleanSessionSnapshot {
  return {
    cleanClassType: null,
    duelQueue: [],
    ...emptyBucketSessionFields(),
  };
}

describe('planCleanMount', () => {
  const rules = mergeDupeRules();
  const setA = { hash: 101, name: 'Set Alpha', perks: [] };
  const setB = { hash: 202, name: 'Set Beta', perks: [] };
  const vault = buildClassVaultState(
    'hunter',
    [
      ...splitSetHelmVault(),
      armorPiece({ instanceId: 'chest-a1', armorSlot: 'chest', armorSet: setA }),
      armorPiece({ instanceId: 'chest-a2', armorSlot: 'chest', armorSet: setA, tuningStat: 'grenade' }),
      armorPiece({ instanceId: 'chest-b1', armorSlot: 'chest', armorSet: setB }),
      armorPiece({ instanceId: 'chest-b2', armorSlot: 'chest', armorSet: setB, tuningStat: 'grenade' }),
    ],
    rules,
  );
  const bucketKeys = vault.buckets.filter((b) => b.hasDupes).map((b) => bucketKeyString(b.key));
  const helmAKey = bucketKeys[0]!;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('awaits bucket choice on fresh visit with no URL or saved bucket', () => {
    const plan = planCleanMount('hunter', null, emptyCleanSession(), vault, null, []);
    expect(plan).toEqual({ action: 'awaitBucket' });
  });

  it('restores queue with URL bucket as head', () => {
    const plan = planCleanMount('hunter', helmAKey, emptyCleanSession(), vault, null, []);
    expect(plan.action).toBe('restore');
    if (plan.action !== 'restore') return;
    expect(plan.duelQueue[0]).toBe(helmAKey);
    expect(plan.duelQueue.length).toBeGreaterThan(1);
  });

  it('restores from last saved bucket when URL is absent', () => {
    setLastDuelBucketKey('hunter', helmAKey);
    const plan = planCleanMount('hunter', null, emptyCleanSession(), vault, null, []);
    expect(plan.action).toBe('restore');
    if (plan.action !== 'restore') return;
    expect(plan.duelQueue[0]).toBe(helmAKey);
  });

  it('prefers explicit URL bucket over last saved bucket', () => {
    expect(bucketKeys.length).toBeGreaterThanOrEqual(2);
    const otherKey = bucketKeys[1]!;
    setLastDuelBucketKey('hunter', helmAKey);
    const plan = planCleanMount('hunter', otherKey, emptyCleanSession(), vault, null, []);
    if (plan.action !== 'restore') return;
    expect(plan.duelQueue[0]).toBe(otherKey);
  });

  it('preserves in-flight session without forcing bucket choice', () => {
    const plan = planCleanMount(
      'hunter',
      null,
      {
        ...emptyCleanSession(),
        cleanClassType: 'hunter',
        duelQueue: [helmAKey],
        bucketJunkedIds: ['helm-a1'],
      },
      vault,
      null,
      [],
    );
    expect(plan.action).toBe('restore');
    if (plan.action !== 'restore') return;
    expect(plan.bucketJunkedIds).toContain('helm-a1');
  });
});

describe('resolveDuelMountBucketKey', () => {
  const vault = buildClassVaultState('hunter', splitSetHelmVault(), mergeDupeRules());
  const key = bucketKeyString(vault.buckets[0]!.key);

  beforeEach(() => {
    clearLastDuelBucketKey('hunter');
  });

  it('returns URL key when valid', () => {
    expect(resolveDuelMountBucketKey('hunter', vault, key)).toBe(key);
  });

  it('falls back to last saved key', () => {
    setLastDuelBucketKey('hunter', key);
    expect(resolveDuelMountBucketKey('hunter', vault, null)).toBe(key);
  });

  it('returns null when neither URL nor saved key is valid', () => {
    expect(resolveDuelMountBucketKey('hunter', vault, 'invalid|key')).toBeNull();
    expect(getLastDuelBucketKey('hunter')).toBeNull();
  });
});
