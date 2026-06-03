/**
 * One-off: copy missing keys from en locale JSON into other locales (English placeholders).
 * Preserves existing translations. Run: node scripts/fill-missing-locale-keys.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');
const enDir = path.join(root, 'en');

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

const namespaces = fs.readdirSync(enDir).filter((f) => f.endsWith('.json'));
const locales = fs.readdirSync(root).filter((d) => d !== 'en' && fs.statSync(path.join(root, d)).isDirectory());

let updated = 0;
for (const locale of locales) {
  for (const file of namespaces) {
    const enPath = path.join(enDir, file);
    const localePath = path.join(root, locale, file);
    if (!fs.existsSync(localePath)) continue;
    const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const localeJson = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    const merged = fillMissing(localeJson, enJson);
    const next = `${JSON.stringify(merged, null, 2)}\n`;
    const prev = `${JSON.stringify(localeJson, null, 2)}\n`;
    if (next !== prev) {
      fs.writeFileSync(localePath, next);
      updated += 1;
    }
  }
}
console.log(`Updated ${updated} locale files under ${root}`);
