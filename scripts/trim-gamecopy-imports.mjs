import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const NAMES = ['classLabel', 'statLabel', 'archetypeLabel', 'slotLabel'];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'locales') continue;
      walk(full, files);
    } else if (/\.(tsx?)$/.test(name)) files.push(full);
  }
  return files;
}

for (const file of walk(SRC)) {
  let content = fs.readFileSync(file, 'utf8');
  const m = content.match(
    /import \{([^}]+)\} from '@\/i18n\/gameCopy';\n/,
  );
  if (!m) continue;
  const used = NAMES.filter((n) => {
    const re = new RegExp(`\\b${n}\\s*\\(`, 'g');
    return re.test(content);
  });
  if (used.length === 0) {
    content = content.replace(m[0], '');
    fs.writeFileSync(file, content);
    console.log('Removed empty gameCopy import', path.relative(SRC, file));
    continue;
  }
  const replacement = `import { ${used.join(', ')} } from '@/i18n/gameCopy';\n`;
  if (m[0] !== replacement) {
    content = content.replace(m[0], replacement);
    fs.writeFileSync(file, content);
    console.log('Trimmed', path.relative(SRC, file), used.join(', '));
  }
}
