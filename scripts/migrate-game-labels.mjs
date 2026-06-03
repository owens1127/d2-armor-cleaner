/**
 * One-off: replace CLASS_LABELS[x] etc. with gameCopy helpers in src/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

const SKIP = new Set([
  path.normalize('lib/constants.ts'),
  path.normalize('lib/bungie/manifest.ts'),
  path.normalize('i18n/gameCopy.ts'),
]);

const REPLACEMENTS = [
  [/CLASS_LABELS\[([^\]]+)\]/g, 'classLabel($1)'],
  [/STAT_LABELS\[([^\]]+)\]/g, 'statLabel($1)'],
  [/ARCHETYPE_LABELS\[([^\]]+)\]/g, 'archetypeLabel($1)'],
  [/SLOT_LABELS\[([^\]]+)\]/g, 'slotLabel($1)'],
];

const IMPORT_LINE =
  "import { archetypeLabel, classLabel, slotLabel, statLabel } from '@/i18n/gameCopy';\n";

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'locales' || name === 'test') continue;
      walk(full, files);
    } else if (/\.(tsx?)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function rel(p) {
  return path.normalize(path.relative(SRC, p));
}

function needsGameCopy(content) {
  return /\b(classLabel|statLabel|archetypeLabel|slotLabel)\(/.test(content);
}

function hasGameCopyImport(content) {
  return /from ['"]@\/i18n\/gameCopy['"]/.test(content);
}

function addImport(content) {
  if (hasGameCopyImport(content)) return content;
  const m = content.match(/^import .+;\n/m);
  if (m) {
    const idx = content.indexOf(m[0]) + m[0].length;
    return content.slice(0, idx) + IMPORT_LINE + content.slice(idx);
  }
  return IMPORT_LINE + content;
}

function stripOldImports(content) {
  return content
    .replace(
      /import\s*\{[^}]*\b(CLASS_LABELS|STAT_LABELS|ARCHETYPE_LABELS|SLOT_LABELS)\b[^}]*\}\s*from\s*['"]@\/lib\/constants['"];\n?/g,
      '',
    )
    .replace(/,\s*(CLASS_LABELS|STAT_LABELS|ARCHETYPE_LABELS|SLOT_LABELS)\b/g, '')
    .replace(/\b(CLASS_LABELS|STAT_LABELS|ARCHETYPE_LABELS|SLOT_LABELS),?\s*/g, '');
}

for (const file of walk(SRC)) {
  const r = rel(file);
  if (SKIP.has(r)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [re, rep] of REPLACEMENTS) {
    const next = content.replace(re, rep);
    if (next !== content) {
      content = next;
      changed = true;
    }
  }
  if (!changed) continue;
  content = stripOldImports(content);
  if (needsGameCopy(content)) content = addImport(content);
  fs.writeFileSync(file, content);
  console.log('Updated', r);
}
