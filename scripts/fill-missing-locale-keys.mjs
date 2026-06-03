/**
 * One-off: copy missing keys from en.json into other locales (English placeholders).
 * Preserves existing translations. Run: node scripts/fill-missing-locale-keys.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');
const enPath = path.join(LOCALES_DIR, 'en.json');

function fillMissing(target, source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return target !== undefined ? target : source;
  }
  const out =
    target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(source)) {
    if (
      key in out &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = fillMissing(out[key], value);
    } else if (!(key in out)) {
      out[key] = value;
    }
  }
  return out;
}

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const locales = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .map((f) => f.replace(/\.json$/, ''));

let updated = 0;
for (const locale of locales) {
  const localePath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(localePath)) continue;
  const localeJson = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  const merged = fillMissing(localeJson, enJson);
  const next = `${JSON.stringify(merged, null, 2)}\n`;
  const prev = `${JSON.stringify(localeJson, null, 2)}\n`;
  if (next !== prev) {
    fs.writeFileSync(localePath, next);
    updated += 1;
  }
}
console.log(`Updated ${updated} locale files under ${LOCALES_DIR}`);
