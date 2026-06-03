/**
 * Deep-merge missing keys from en into other locale namespace files.
 * Existing translations are preserved; only missing keys get English fallbacks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');
const SOURCE = 'en';
const TARGET_LOCALES = [
  'de',
  'es',
  'es-mx',
  'fr',
  'it',
  'ja',
  'ko',
  'pl',
  'pt-br',
  'ru',
  'zh-chs',
  'zh-cht',
];

function deepMergeMissing(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMergeMissing(target[key], value);
    } else if (!(key in target)) {
      target[key] = value;
    }
  }
  return target;
}

const enDir = path.join(LOCALES_DIR, SOURCE);
const namespaces = fs.readdirSync(enDir).filter((f) => f.endsWith('.json'));

for (const locale of TARGET_LOCALES) {
  const localeDir = path.join(LOCALES_DIR, locale);
  if (!fs.existsSync(localeDir)) fs.mkdirSync(localeDir, { recursive: true });

  for (const file of namespaces) {
    const enPath = path.join(enDir, file);
    const targetPath = path.join(localeDir, file);
    const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    let targetJson = {};
    if (fs.existsSync(targetPath)) {
      targetJson = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    }
    deepMergeMissing(targetJson, enJson);
    fs.writeFileSync(targetPath, `${JSON.stringify(targetJson, null, 2)}\n`, 'utf8');
  }
}

console.log(`Synced ${namespaces.length} namespaces into ${TARGET_LOCALES.length} locales.`);
