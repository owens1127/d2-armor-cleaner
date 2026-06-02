import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'screenshots');
const outPath = join(outDir, 'combos-copy-icons.png');

const membershipId = 'destiny-demo-1';
const slots = ['helmet', 'gauntlets', 'chest', 'legs', 'class'];
const slotLabels = {
  helmet: 'Smoke Weave Mask',
  gauntlets: 'Smoke Weave Grips',
  chest: 'Smoke Weave Vest',
  legs: 'Smoke Weave Strides',
  class: 'Smoke Weave Cloak',
};

const vaultItems = slots.map((armorSlot) => ({
  instanceId: `ws-${armorSlot}`,
  itemHash: 1,
  name: slotLabels[armorSlot],
  classType: 'hunter',
  armorSlot,
  tier: 5,
  power: 450,
  location: 'vault',
  archetype: 'gunner',
  baseStats: { weapons: 35, grenade: 20, super: 30 },
  tertiaryStat: 'super',
  tuningStat: 'weapons',
  isMasterwork: false,
  dimTag: null,
}));

const prefs = {
  version: 2,
  classPrefs: {
    hunter: {
      calibrationChoices: {},
      statWeights: {
        weapons: 1,
        grenade: 1,
        melee: 0.5,
        super: 0.5,
        class: 0.5,
        health: 0.5,
      },
      archetypeWeights: {
        gunner: 1,
        grenadier: 1,
        paragon: 0.6,
        brawler: 0.6,
        bulwark: 0.6,
        specialist: 0.6,
      },
      tertiaryWeights: {},
      tuningWeights: {},
      setWeights: {},
      desiredBuilds: [
        {
          id: 'ws',
          name: 'Weapons/Super',
          mode: 'priority',
          enabled: true,
          statTargets: [
            { stat: 'weapons', target: 200 },
            { stat: 'super', target: 150 },
          ],
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
          bungieMembershipId: 'bungie-demo-1',
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
        JSON.stringify({
          strictness: 50,
          global: prefs.defaultDupeRules,
          classOverrides: {},
        }),
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

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('PAGE ERROR:', msg.text());
});
page.on('pageerror', (err) => console.error('PAGE EXCEPTION:', err.message));

await page.goto('https://localhost:5173/');
await seedPage(page);
await page.goto('https://localhost:5173/combos/hunter?build=ws', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#root')?.innerHTML.trim().length > 0, null, {
  timeout: 30_000,
});
await page.waitForTimeout(3000);
const html = await page.content();
if (!html.includes('Copy DIM query for')) {
  await page.screenshot({ path: join(outDir, 'combos-copy-icons-debug.png'), fullPage: true });
  console.error('Copy buttons not found. URL:', page.url());
  console.error('Body snippet:', html.slice(0, 2000));
  process.exit(1);
}
await page.waitForSelector('button[aria-label^="Copy DIM query for"]', { timeout: 15_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: outPath, fullPage: true });
const zoomPath = join(outDir, 'combos-copy-icons-zoom.png');
const copyBtn = page.locator('button[aria-label^="Copy DIM query for"]').first();
await copyBtn.screenshot({ path: zoomPath });

await browser.close();
console.log(outPath);
console.log(zoomPath);
