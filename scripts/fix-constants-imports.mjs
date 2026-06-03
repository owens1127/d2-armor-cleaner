import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

const NEEDS = {
  'lib/coverage/builds.ts': ['ARMOR_SLOTS', 'STATS'],
  'lib/dupes/queue.ts': ['ARMOR_SLOTS', 'ARCHETYPES', 'STATS'],
  'lib/coverage/loadout.ts': ['ARMOR_SLOTS', 'STATS', 'ARCHETYPE_STATS'],
  'lib/coverage/analyze.ts': ['ARMOR_SLOTS', 'STATS', 'ARCHETYPE_STATS', 'ARCHETYPES'],
  'lib/coverage/patternLoadoutGrid.ts': ['ARMOR_SLOTS'],
  'lib/scoring/dominance.ts': ['ARCHETYPE_STATS', 'STATS'],
  'lib/browse/redundantMatchDisplay.ts': ['ARCHETYPE_STATS', 'STATS'],
  'components/duel/ArmorCard.tsx': ['ARCHETYPE_STATS', 'STATS'],
  'pages/SettingsPage.tsx': ['CLASSES', 'STATS', 'ARCHETYPES'],
  'pages/DashboardPage.tsx': ['CLASSES', 'ARCHETYPES', 'ARMOR_SLOTS'],
  'pages/CalibratePage.tsx': ['CLASSES', 'ARCHETYPE_STATS', 'ARCHETYPES', 'STATS'],
  'pages/BuildPage.tsx': ['CLASSES'],
  'pages/BrowsePage.tsx': ['CLASSES', 'ARMOR_SLOTS', 'ARCHETYPES'],
  'components/AutoFilterRulesSection.tsx': ['CLASSES', 'ARCHETYPES', 'STATS', 'ARMOR_SLOTS'],
  'components/settings/DesiredBuildsSection.tsx': ['STATS'],
  'components/heatmap/Heatmap.tsx': ['ARCHETYPES', 'ARMOR_SLOTS'],
};

function ensureImport(filePath, names) {
  let content = fs.readFileSync(filePath, 'utf8');
  const missing = names.filter((n) => new RegExp(`\\b${n}\\b`).test(content) && !new RegExp(`import[^;]*\\b${n}\\b`).test(content));
  if (missing.length === 0) return;

  const existing = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/constants['"];/);
  if (existing) {
    const current = existing[1].split(',').map((s) => s.trim()).filter(Boolean);
    const merged = [...new Set([...current, ...missing])].sort();
    const replacement = `import { ${merged.join(', ')} } from '@/lib/constants';`;
    content = content.replace(existing[0], replacement);
  } else {
    const gameImport = content.match(/import \{[^}]+\} from '@\/i18n\/gameCopy';\n/);
    const line = `import { ${missing.join(', ')} } from '@/lib/constants';\n`;
    if (gameImport) {
      content = content.replace(gameImport[0], gameImport[0] + line);
    } else {
      content = line + content;
    }
  }
  fs.writeFileSync(filePath, content);
  console.log('Fixed', path.relative(SRC, filePath), missing.join(', '));
}

for (const [rel, names] of Object.entries(NEEDS)) {
  ensureImport(path.join(SRC, rel), names);
}
