import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUPE_PRESETS } from '@/lib/constants';
import {
  dupeMatchStyleCardHeadline,
  dupeMatchStyleLabel,
  mergeDupeRules,
} from '@/lib/dupes/rules';
import { classLabel } from '@/i18n/gameCopy';
import { dupeSuggestionReason } from '@/i18n/dupesCopy';
import { i18n } from '@/i18n';
import * as loadVault from '@/lib/bungie/loadVault';
import * as manifest from '@/lib/bungie/manifest';
import * as manifestDisplay from '@/lib/armor/manifestDisplay';
import {
  resetManifestLocaleSyncForTests,
  syncManifestToAppLocale,
} from '@/lib/bungie/manifestLocaleSync';
import {
  detectNavigatorLocale,
  isManifestLocale,
  MANIFEST_LOCALES,
  normalizeLocale,
} from './manifestLocales';

describe('manifest locales', () => {
  it('normalizes browser and i18n tags to manifest codes', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('fr');
    expect(normalizeLocale('es-MX')).toBe('es-mx');
    expect(normalizeLocale('es-ES')).toBe('es');
    expect(normalizeLocale('pt-BR')).toBe('pt-br');
    expect(normalizeLocale('zh-CN')).toBe('zh-chs');
    expect(normalizeLocale('zh-TW')).toBe('zh-cht');
    expect(normalizeLocale('zh-Hant')).toBe('zh-cht');
    expect(normalizeLocale('zh-Hans')).toBe('zh-chs');
    expect(normalizeLocale('unknown-xy')).toBe('en');
  });

  it('accepts manifest codes verbatim', () => {
    for (const locale of MANIFEST_LOCALES) {
      expect(normalizeLocale(locale)).toBe(locale);
      expect(isManifestLocale(locale)).toBe(true);
    }
  });

  it('detectNavigatorLocale returns a supported locale', () => {
    const detected = detectNavigatorLocale();
    expect(MANIFEST_LOCALES).toContain(detected);
  });
});

describe('i18n runtime', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('resolves Korean settings and common copy after changeLanguage(ko)', async () => {
    await i18n.changeLanguage('ko');
    expect(i18n.t('settings:title')).toBe('설정');
    expect(i18n.t('common:language')).toBe('언어');
  });

  it('resolves Korean dupe preset labels through rule helpers', async () => {
    await i18n.changeLanguage('ko');
    const setAware = mergeDupeRules(DUPE_PRESETS.setAware.rules);
    expect(dupeMatchStyleLabel(setAware)).toBe('세트 인식');
    expect(dupeMatchStyleCardHeadline(setAware)).toContain('세트 인식');
  });

  it('resolves localized class labels via gameCopy', async () => {
    await i18n.changeLanguage('ko');
    expect(classLabel('hunter')).toBe('사냥꾼');
    await i18n.changeLanguage('de');
    expect(classLabel('hunter')).toBe('Jäger');
    await i18n.changeLanguage('en');
    expect(classLabel('hunter')).toBe('Hunter');
  });

  it('resolves dupe suggestion copy with interpolation', () => {
    expect(dupeSuggestionReason('standardDefault')).toBe(
      'Standard preset for your vault size.',
    );
    expect(
      dupeSuggestionReason('setAwareHeavy', { totalT5: 12, heavyBuckets: 4 }),
    ).toContain('12');
    expect(
      dupeSuggestionReason('setAwareHeavy', { totalT5: 12, heavyBuckets: 4 }),
    ).toContain('4');
  });
});

const loadLiveVaultMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/stores/vaultStore', () => ({
  useVaultStore: {
    getState: () => ({
      loadLiveVault: loadLiveVaultMock,
    }),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      membership: { destinyMembershipId: '123', membershipType: 3, displayName: 'Test' },
    }),
  },
}));

describe('manifest locale sync', () => {
  beforeEach(() => {
    resetManifestLocaleSyncForTests();
    loadLiveVaultMock.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    resetManifestLocaleSyncForTests();
    await i18n.changeLanguage('en');
  });

  it('reloads manifest when app locale changes without an active session', async () => {
    const tables = {
      items: {},
      itemSets: {},
      sandboxPerks: {},
      stats: {},
    };
    const reload = vi.spyOn(manifest, 'reloadManifestForLocale').mockResolvedValue(tables);
    vi.spyOn(manifest, 'getLoadedManifestLocale').mockReturnValue('en');
    vi.spyOn(loadVault, 'hasActiveSession').mockReturnValue(false);

    await syncManifestToAppLocale('ko');

    expect(reload).toHaveBeenCalledWith('ko');
    expect(loadLiveVaultMock).not.toHaveBeenCalled();
    reload.mockRestore();
  });

  it('skips reload when manifest locale already matches', async () => {
    const reload = vi.spyOn(manifest, 'reloadManifestForLocale');
    vi.spyOn(manifest, 'getLoadedManifestLocale').mockReturnValue('fr');

    await syncManifestToAppLocale('fr');

    expect(reload).not.toHaveBeenCalled();
    expect(loadLiveVaultMock).not.toHaveBeenCalled();
    reload.mockRestore();
  });

  it('calls background loadLiveVault when locale changes with active session', async () => {
    vi.spyOn(manifest, 'getLoadedManifestLocale').mockReturnValue('en');
    vi.spyOn(manifest, 'clearManifestMemoryCache').mockImplementation(() => undefined);
    vi.spyOn(loadVault, 'hasActiveSession').mockReturnValue(true);
    const relocalize = vi
      .spyOn(manifestDisplay, 'relocalizeVaultDisplayFromManifest')
      .mockResolvedValue(undefined);
    const reload = vi.spyOn(manifest, 'reloadManifestForLocale');

    await syncManifestToAppLocale('de');

    expect(manifest.clearManifestMemoryCache).toHaveBeenCalled();
    expect(relocalize).toHaveBeenCalledWith('de');
    expect(loadLiveVaultMock).toHaveBeenCalledWith({ background: true, force: true });
    expect(reload).not.toHaveBeenCalled();
    relocalize.mockRestore();
    reload.mockRestore();
  });
});
