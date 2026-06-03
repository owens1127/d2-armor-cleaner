/**
 * Deep-merge missing keys from en.json into other locale files.
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

const enPath = path.join(LOCALES_DIR, `${SOURCE}.json`);
const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));

for (const locale of TARGET_LOCALES) {
  const targetPath = path.join(LOCALES_DIR, `${locale}.json`);
  let targetJson = {};
  if (fs.existsSync(targetPath)) {
    targetJson = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  }
  deepMergeMissing(targetJson, enJson);
  fs.writeFileSync(targetPath, `${JSON.stringify(targetJson, null, 2)}\n`, 'utf8');
}

console.log(`Synced en.json into ${TARGET_LOCALES.length} locales.`);
