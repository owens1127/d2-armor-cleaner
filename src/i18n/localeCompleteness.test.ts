import { describe, expect, it } from 'vitest';
import { resources, SUPPORTED_LOCALES, type AppNamespaces } from './resources';

const SOURCE_LOCALE = 'en';
const MAX_MISSING_KEYS_IN_MESSAGE = 25;

const localeJsonModules = import.meta.glob('../locales/*/*.json', {
  eager: true,
}) as Record<string, { default: unknown }>;

function localeNamespaceKey(locale: string, namespace: string): string {
  return `../locales/${locale}/${namespace}.json`;
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
  it('defines every English key for each supported locale and namespace', () => {
    const namespaces = Object.keys(resources.en) as AppNamespaces[];
    const enKeysByNamespace = Object.fromEntries(
      namespaces.map((namespace) => {
        const moduleKey = localeNamespaceKey(SOURCE_LOCALE, namespace);
        const enJson = localeJsonModules[moduleKey]?.default;
        expect(enJson, `missing English namespace file: ${namespace}.json`).toBeDefined();
        return [namespace, flattenKeys(enJson).sort()];
      }),
    ) as Record<AppNamespaces, string[]>;

    const failures: string[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      for (const namespace of namespaces) {
        const expectedKeys = enKeysByNamespace[namespace];
        const moduleKey = localeNamespaceKey(locale, namespace);
        const localeJson = localeJsonModules[moduleKey]?.default;

        if (localeJson === undefined) {
          failures.push(
            `${locale}/${namespace}.json: file missing (${expectedKeys.length} keys expected from en)`,
          );
          continue;
        }

        const localeKeys = new Set(flattenKeys(localeJson));
        const missing = expectedKeys.filter((key) => !localeKeys.has(key));
        if (missing.length > 0) {
          failures.push(
            `${locale}/${namespace}.json: missing ${missing.length} key(s): ${formatMissingKeys(missing)}`,
          );
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
