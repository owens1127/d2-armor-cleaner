/**
 * Find keys where 3+ non-en locales still equal en.json verbatim (likely untranslated).
 * Prints JSON report; exit 1 if any actionable keys remain after allowlist.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');

const NON_EN = [
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

/** Keys or suffixes intentionally matching English across locales. */
const ALLOW_KEY_PATTERNS = [
  /^common\.language/,
  /^browse\.dimTags\.(keep|junk|favorite|infuse|archive)$/,
  /^browse\.copyIds$/,
  /^browse\.copied$/,
  /^game\.archetypes\./,
  /^game\.classes\.(hunter|titan|warlock)$/, // DIM examples; ko/ja have localized tests
  /^game\.stats\.super$/,
  /^game\.slots\./,
  /^duel\.vs$/,
  /^dashboard\.combo/i,
  /\.setFallback$/,
  /\.hash\}\}$/,
  /^settings\.developer\./,
  /^footer\./,
  /bungie/i,
  /dim\./i,
  /tag:junk/i,
  /id:/,
];

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

function isAllowed(key, value) {
  if (ALLOW_KEY_PATTERNS.some((re) => re.test(key))) return true;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.includes('id:') || value.includes('tag:')) return true;
  if (/^\{\{/.test(value) && value.length < 40) return true;
  return false;
}

const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
const enFlat = flatten(en);

const localeFlat = Object.fromEntries(
  NON_EN.map((loc) => [
    loc,
    flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${loc}.json`), 'utf8'))),
  ]),
);

const hits = [];

for (const [key, enVal] of Object.entries(enFlat)) {
  if (!enVal.trim() || /^[\d\s%:→·+\-]+$/.test(enVal)) continue;
  if (isAllowed(key, enVal)) continue;

  const matching = NON_EN.filter((loc) => localeFlat[loc][key] === enVal);
  if (matching.length >= 3) {
    hits.push({ key, en: enVal, locales: matching, count: matching.length });
  }
}

hits.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

console.log(JSON.stringify({ total: hits.length, hits }, null, 2));
