import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'scripts', 'screenshots');
const outPath = join(outDir, 'piece-picker.png');

const membershipId = 'destiny-piece-picker';
const ferro = { hash: 100, name: 'Ferropotent', perks: [] };

const slotNames = {
  helmet: 'Wayward Psyche Crown',
  gauntlets: 'Ferropotent Grips',
  chest: 'Ferropotent Vest',
  legs: 'Ferropotent Greaves',
  classItem: 'Ferropotent Cloak',
};

function buildVaultItems() {
  const tunings = ['weapons', 'grenade', 'super'];
  const items = [];
  for (const [armorSlot, name] of Object.entries(slotNames)) {
    for (let i = 0; i < tunings.length; i++) {
      items.push({
        instanceId: `ferro-${armorSlot}-${i}`,
        itemHash: 1000 + items.length,
        name: i === 0 ? name : `${name} (${i + 1})`,
        classType: 'hunter',
        armorSlot,
        tier: 5,
        power: 450,
        location: 'vault',
        archetype: 'grenadier',
        baseStats: { weapons: 35, grenade: 28, super: 10 },
        tertiaryStat: 'weapons',
        tuningStat: tunings[i],
        armorSet: ferro,
        isMasterwork: false,
        dimTag: null,
      });
    }
  }
  return items;
}

const vaultItems = buildVaultItems();

const prefs = {
  version: 2,
  classPrefs: {
    hunter: {
      calibrationChoices: {},
      statWeights: { weapons: 1, grenade: 1, melee: 0.5, super: 1, class: 0.5, health: 0.5 },
      archetypeWeights: { gunner: 1, grenadier: 1, paragon: 0.6, brawler: 0.6, bulwark: 0.6, specialist: 0.6 },
      tertiaryWeights: {},
      tuningWeights: {},
      setWeights: {},
      desiredBuilds: [
        {
          id: 'ferro-build',
          name: 'Ferropotent test',
          mode: 'priority',
          enabled: true,
          statTargets: [
            { stat: 'weapons', target: 200 },
            { stat: 'grenade', target: 150 },
          ],
          setBonus2pc: ferro.hash,
        },
      ],
    },
    titan: { calibrationChoices: {}, statWeights: {}, archetypeWeights: {}, tertiaryWeights: {}, tuningWeights: {}, setWeights: {}, desiredBuilds: [] },
    warlock: { calibrationChoices: {}, statWeights: {}, archetypeWeights: {}, tertiaryWeights: {}, tuningWeights: {}, setWeights: {}, desiredBuilds: [] },
  },
  defaultDupeRules: {
    minTier: 5,
    sameArmorSet: false,
    sameTuningStat: false,
    ignoreTaggedInfuse: true,
    ignoreTaggedJunk: true,
    ignoreTaggedKeep: true,
    ignoreTaggedFavorite: true,
    ignoreTaggedArchive: true,
    filterArmorSetHashes: [],
  },
  autoFilterRules: [],
};

async function seedPage(page) {
  await page.evaluate(
    async ({ membershipId, vaultItems, prefs }) => {
      localStorage.setItem(
        'dac-membership',
        JSON.stringify({
          bungieMembershipId: 'bungie-piece-picker',
          destinyMembershipId: membershipId,
          membershipType: 3,
          displayName: 'Demo',
        }),
      );
      localStorage.setItem('dac-bungie-token', 'demo-token');
      localStorage.setItem('dac-bungie-token-expires', String(Date.now() + 86_400_000));
      localStorage.setItem('dac-onboarding', 'true');
      localStorage.setItem('dac-storage-migrated-v1', '1');
      localStorage.setItem('d2-armor-cleaner-prefs', JSON.stringify(prefs));
      localStorage.setItem(
        'dac-dupe-rules',
        JSON.stringify({ strictness: 50, global: prefs.defaultDupeRules, classOverrides: {} }),
      );

      const vaultEntry = {
        schemaVersion: 5,
        destinyMembershipId: membershipId,
        items: vaultItems,
        lastParsedCount: vaultItems.length,
        dimTags: {},
        fetchedAt: Date.now(),
      };

      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('d2-armor-cleaner', 2);
        req.onupgradeneeded = () => {
          const database = req.result;
          if (!database.objectStoreNames.contains('snapshots')) {
            database.createObjectStore('snapshots');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('idb open failed'));
      });

      await new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put(vaultEntry, membershipId);
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => reject(tx.error);
      });
      db.close();

      sessionStorage.setItem(
        'dac-vault-meta',
        JSON.stringify({
          destinyMembershipId: membershipId,
          fetchedAt: Date.now(),
          lastParsedCount: vaultItems.length,
        }),
      );
    },
    { membershipId, vaultItems, prefs },
  );
}

async function measurePickerRows(page) {
  return page.evaluate(() => {
    const menu = document.querySelector('[role="listbox"][aria-label^="Choose"]');
    if (!menu) return { error: 'picker not open' };
    const column = menu.closest('[data-loadout-column]') ?? document.querySelector('[data-loadout-column]');
    const menuRect = menu.getBoundingClientRect();
    const columnRect = column?.getBoundingClientRect();
    const rows = [...menu.querySelectorAll('[role="option"]')];
    return {
      menuWidth: Math.round(menuRect.width),
      columnWidth: columnRect ? Math.round(columnRect.width) : null,
      widthDelta: columnRect ? Math.round(menuRect.width - columnRect.width) : null,
      rows: rows.map((row) => {
        const inner = row.querySelector('.grid');
        const name = row.querySelector('[class*="truncate"]');
        const copy = row.querySelector('button[title*="DIM"], button[aria-label*="DIM"]');
        const nr = name?.getBoundingClientRect();
        const cr = copy?.getBoundingClientRect();
        const style = inner ? getComputedStyle(inner) : null;
        return {
          name: name?.textContent?.trim(),
          gridTemplateColumns: style?.gridTemplateColumns,
          truncated: name ? name.scrollWidth > name.clientWidth + 1 : null,
          gapPx: nr && cr ? Math.round(cr.left - nr.right) : null,
        };
      }),
    };
  });
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto('https://localhost:5173/');
await seedPage(page);
await page.goto('https://localhost:5173/combos/hunter?build=ferro-build', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#root')?.innerHTML.trim().length > 0, null, {
  timeout: 30_000,
});
await page.getByRole('heading', { name: 'Recommended pieces' }).waitFor({ timeout: 20_000 });
await page.waitForTimeout(600);

const chooseBtn = page.getByRole('button', { name: /Choose piece/i }).first();
await chooseBtn.click();
await page.waitForSelector('[role="listbox"][aria-label^="Choose"]', { timeout: 10_000 });
await page.waitForTimeout(400);

const metrics = await measurePickerRows(page);
console.log(JSON.stringify(metrics, null, 2));

const listbox = page.locator('[role="listbox"][aria-label^="Choose"]');
await listbox.screenshot({ path: outPath });
console.log('Screenshot:', outPath);

await context.close();
await browser.close();
