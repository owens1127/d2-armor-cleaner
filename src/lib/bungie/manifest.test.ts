import { describe, expect, it } from 'vitest';
import type { AppLocale } from '@/i18n/manifestLocales';
import { getManifestComponentPaths } from './manifest';

describe('getManifestComponentPaths', () => {
  const info = {
    version: 'test',
    jsonWorldComponentContentPaths: {
      en: { DestinyInventoryItemDefinition: '/en/items' },
      ko: { DestinyInventoryItemDefinition: '/ko/items' },
    },
  };

  it('uses the requested locale when paths exist', () => {
    expect(getManifestComponentPaths(info, 'ko').DestinyInventoryItemDefinition).toBe(
      '/ko/items',
    );
  });

  it('falls back to English when locale paths are missing', () => {
    expect(getManifestComponentPaths(info, 'ja' as AppLocale).DestinyInventoryItemDefinition).toBe(
      '/en/items',
    );
  });
});
