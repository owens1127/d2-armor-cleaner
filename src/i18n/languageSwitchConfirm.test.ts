import { describe, expect, it } from 'vitest';
import { getLanguageChangeConfirmCopy } from '@/i18n/languageSwitchConfirm';
import { collectManifestVaultIdbKeys } from '@/lib/storage/clearManifestVaultCache';
import { IDB_MANIFEST_KEY } from '@/lib/storage/keys';
import { manifestCacheKey } from '@/lib/bungie/manifestCache';

describe('getLanguageChangeConfirmCopy', () => {
  it('uses target locale for message and confirm, current locale for cancel', () => {
    const copy = getLanguageChangeConfirmCopy('es', 'en');
    expect(copy.message).toContain('cambiar el idioma');
    expect(copy.confirm).toBe('Sí, cambiar');
    expect(copy.cancel).toBe('Cancel');
  });

  it('returns English copy when target and current are en', () => {
    const copy = getLanguageChangeConfirmCopy('en', 'en');
    expect(copy.message).toContain('Switching language');
    expect(copy.confirm).toBe('Yes, switch');
    expect(copy.cancel).toBe('Cancel');
  });
});

describe('collectManifestVaultIdbKeys', () => {
  it('includes legacy and per-locale manifest keys', () => {
    const keys = collectManifestVaultIdbKeys();
    expect(keys).toContain(IDB_MANIFEST_KEY);
    expect(keys).toContain(manifestCacheKey('en'));
    expect(keys).toContain(manifestCacheKey('ko'));
    expect(keys.length).toBeGreaterThanOrEqual(13);
  });
});
