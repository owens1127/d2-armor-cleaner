import { describe, expect, it } from 'vitest';
import {
  LS_DUPE_RULES,
  LS_ONBOARDING,
  LS_PREFS,
  LS_REVIEW_TAGS,
} from '@/lib/storage/keys';
import { LOCALE_STORAGE_KEY } from '@/i18n/localePreferences';
import { collectRemovableStorageKeys } from './clearLocalDataKeys';

function mockStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  } as Storage;
}

describe('collectRemovableStorageKeys', () => {
  it('removes dac caches and auth while keeping prefs when requested', () => {
    const storage = mockStorage({
      [LS_PREFS]: '{}',
      [LS_DUPE_RULES]: '{}',
      [LS_ONBOARDING]: 'true',
      [LOCALE_STORAGE_KEY]: 'ko',
      'dac-review-tags': '[]',
      'dac-bungie-token': 'x',
      'd2ac.locale.useBrowser': 'true',
      unrelated: 'stay',
    });

    const keys = collectRemovableStorageKeys(storage, 'local', true);

    expect(keys).toContain('dac-review-tags');
    expect(keys).toContain('dac-bungie-token');
    expect(keys).not.toContain('d2ac.locale.useBrowser');
    expect(keys).not.toContain(LOCALE_STORAGE_KEY);
    expect(keys).not.toContain(LS_PREFS);
    expect(keys).not.toContain(LS_DUPE_RULES);
    expect(keys).not.toContain(LS_ONBOARDING);
    expect(keys).not.toContain(LOCALE_STORAGE_KEY);
    expect(keys).not.toContain('unrelated');
  });

  it('removes prefs and onboarding on full reset', () => {
    const storage = mockStorage({
      [LS_PREFS]: '{}',
      [LS_ONBOARDING]: 'true',
      [LS_REVIEW_TAGS]: '[]',
    });

    const keys = collectRemovableStorageKeys(storage, 'local', false);

    expect(keys).toContain(LS_PREFS);
    expect(keys).toContain(LS_ONBOARDING);
    expect(keys).toContain(LS_REVIEW_TAGS);
  });
});
