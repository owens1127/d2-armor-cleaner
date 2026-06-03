import { describe, expect, it } from 'vitest';
import { resources, SUPPORTED_LOCALES } from './resources';

const SOURCE_LOCALE = 'en';
const MAX_MISSING_KEYS_IN_MESSAGE = 25;

const localeJsonModules = import.meta.glob('../locales/*.json', {
  eager: true,
}) as Record<string, { default: unknown }>;

function localeFileKey(locale: string): string {
  return `../locales/${locale}.json`;
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      keys.push(...flattenKeys(child, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function formatMissingKeys(keys: string[]): string {
  if (keys.length <= MAX_MISSING_KEYS_IN_MESSAGE) {
    return keys.join(', ');
  }
  const shown = keys.slice(0, MAX_MISSING_KEYS_IN_MESSAGE).join(', ');
  const rest = keys.length - MAX_MISSING_KEYS_IN_MESSAGE;
  return `${shown}, … (+${rest} more)`;
}

describe('locale completeness', () => {
  it('defines every English key for each supported locale', () => {
    const enBundle = localeJsonModules[localeFileKey(SOURCE_LOCALE)]?.default;
    expect(enBundle, 'missing English locale file: en.json').toBeDefined();
    const enKeys = flattenKeys(enBundle).sort();

    const failures: string[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      const moduleKey = localeFileKey(locale);
      const localeBundle = localeJsonModules[moduleKey]?.default;

      if (localeBundle === undefined) {
        failures.push(`${locale}.json: file missing (${enKeys.length} keys expected from en)`);
        continue;
      }

      const localeKeys = new Set(flattenKeys(localeBundle));
      const missing = enKeys.filter((key) => !localeKeys.has(key));
      if (missing.length > 0) {
        failures.push(
          `${locale}.json: missing ${missing.length} key(s): ${formatMissingKeys(missing)}`,
        );
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
    expect(Object.keys(resources.en).length).toBeGreaterThan(0);
  });
});
