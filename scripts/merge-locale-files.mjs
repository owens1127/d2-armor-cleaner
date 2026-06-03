/**
 * One-off: merge src/locales/<locale>/*.json into src/locales/<locale>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

const locales = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const locale of locales) {
  const dir = path.join(LOCALES_DIR, locale);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const merged = {};
  for (const file of files.sort()) {
    const ns = file.replace(/\.json$/, '');
    merged[ns] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  const outPath = path.join(LOCALES_DIR, `${locale}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${locale}.json (${files.length} namespaces)`);
}

console.log(`Merged ${locales.length} locales.`);
