import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'scripts', 'screenshots');
const outPath = join(outDir, 'combo-row-fix.png');

const membershipId = 'destiny-combo-row-fix';
const ferro = { hash: 100, name: 'Ferropotent', perks: [] };
const smoke = { hash: 200, name: 'Smoke Jumper Set', perks: [] };

const slotNames = {
  helmet: 'Ferropotent Mask',
  gauntlets: 'Ferropotent Grips',
  chest: 'Ferropotent Vest',
  legs: 'Ferropotent Greaves',
  classItem: 'Ferropotent Cloak',
};

/** Multiple tuning variants per slot so Choose N appears on every row. */
function buildVaultItems() {
  const tunings = ['weapons', 'grenade', 'super'];
  const items = [];
  for (const [armorSlot, name] of Object.entries(slotNames)) {
    for (let i = 0; i < tunings.length; i++) {
      items.push({
        instanceId: `ferro-${armorSlot}-${i}`,
        itemHash: 1000 + items.length,
        name,
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
  for (const [armorSlot, baseName] of Object.entries({
    helmet: 'Smoke Jumper Mask',
    gauntlets: 'Smoke Jumper Grips',
    chest: 'Smoke Jumper Vest',
    legs: 'Smoke Jumper Strides',
    classItem: 'Smoke Jumper Cloak',
  })) {
    items.push({
      instanceId: `smoke-${armorSlot}`,
      itemHash: 2000 + items.length,
      name: baseName,
      classType: 'hunter',
      armorSlot,
      tier: 5,
      power: 450,
      location: 'vault',
      archetype: 'gunner',
      baseStats: { weapons: 30, grenade: 25, super: 20 },
      tertiaryStat: 'super',
      tuningStat: 'super',
      armorSet: smoke,
      isMasterwork: false,
      dimTag: null,
    });
  }
  return items;
}

const vaultItems = buildVaultItems();

const prefs = {
  version: 2,
  classPrefs: {
    hunter: {
      calibrationChoices: {},
      statWeights: {
        weapons: 1,
        grenade: 1,
        melee: 0.5,
        super: 1,
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
          id: 'ferro-smoke',
          name: 'Weapons/Grenade · Ferropotent 2 + Smoke 2',
          mode: 'priority',
          enabled: true,
          statTargets: [
            { stat: 'weapons', target: 200 },
            { stat: 'grenade', target: 150 },
          ],
          setBonus2pc: ferro.hash,
          setBonus4pc: smoke.hash,
        },
      ],
    },
    titan: {
      calibrationChoices: {},
      statWeights: {},
      archetypeWeights: {},
      tertiaryWeights: {},
      tuningWeights: {},
      setWeights: {},
      desiredBuilds: [],
    },
    warlock: {
      calibrationChoices: {},
      statWeights: {},
      archetypeWeights: {},
      tertiaryWeights: {},
      tuningWeights: {},
      setWeights: {},
      desiredBuilds: [],
    },
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
          bungieMembershipId: 'bungie-combo-row-fix',
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

/** Returns overlap pairs where name text rect intersects copy button rect. */
async function detectNameCopyOverlap(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('section h3')].find(
      (h) => h.textContent?.trim() === 'Recommended pieces',
    )?.parentElement?.querySelectorAll('[class*="grid-cols"]') ?? [];

    const overlaps = [];
    for (const row of document.querySelectorAll('[class*="grid-cols-\\[auto_minmax"]')) {
      const nameEl = row.querySelector('[class*="truncate"]');
      const copyBtn = row.querySelector('button[title*="Copy DIM"]');
      if (!nameEl || !copyBtn) continue;
      const nameRect = nameEl.getBoundingClientRect();
      const copyRect = copyBtn.getBoundingClientRect();
      const intersects =
        nameRect.right > copyRect.left &&
        nameRect.left < copyRect.right &&
        nameRect.bottom > copyRect.top &&
        nameRect.top < copyRect.bottom;
      if (intersects) {
        overlaps.push({
          name: nameEl.textContent?.trim(),
          nameRight: Math.round(nameRect.right),
          copyLeft: Math.round(copyRect.left),
        });
      }
    }
    return overlaps;
  });
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const width of [1280, 960]) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://localhost:5173/');
  await seedPage(page);
  await page.goto('https://localhost:5173/combos/hunter?build=ferro-smoke', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => document.querySelector('#root')?.innerHTML.trim().length > 0, null, {
    timeout: 30_000,
  });
  await page.getByRole('heading', { name: 'Recommended pieces' }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const overlaps = await detectNameCopyOverlap(page);
  const metrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div')].filter(
      (el) => typeof el.className === 'string' && el.className.includes('grid-cols-['),
    );
    return rows
      .map((row) => {
        const style = getComputedStyle(row);
        const name = row.querySelector('[class*="truncate"]');
        const copy = [...row.querySelectorAll('button')].find((b) =>
          (b.getAttribute('title') ?? b.getAttribute('aria-label') ?? '').includes('DIM'),
        );
        const nr = name?.getBoundingClientRect();
        const cr = copy?.getBoundingClientRect();
        return {
          gridTemplateColumns: style.gridTemplateColumns,
          rowWidth: Math.round(row.getBoundingClientRect().width),
          name: name?.textContent?.trim(),
          gapPx: nr && cr ? Math.round(cr.left - nr.right) : null,
          truncated: name ? name.scrollWidth > name.clientWidth : null,
          overlap: nr && cr ? nr.right > cr.left + 1 : null,
        };
      })
      .filter((r) => r.name?.includes('Ferropotent Grips') || r.name?.includes('Ferropotent Greaves'));
  });
  console.log(`\n=== viewport ${width} ===`);
  console.log(JSON.stringify(metrics, null, 2));
  console.log('Overlap check:', overlaps.length === 0 ? 'PASS' : overlaps);

  if (width === 1280 || width === 960) {
    const path =
      width === 1280 ? outPath : join(outDir, 'combo-row-fix-narrow.png');
    const row = page
      .locator('div')
      .filter({ has: page.locator('span', { hasText: 'Ferropotent Grips' }) })
      .filter({ has: page.locator('button[title*="DIM"], button[aria-label*="DIM"]') })
      .first();
    if (await row.count()) {
      await row.screenshot({ path });
    } else {
      const section = page.locator('section').filter({ hasText: 'Recommended pieces' });
      await section.screenshot({ path });
    }
    console.log('Screenshot:', path);
  }

  await context.close();
}

await browser.close();
console.log('Done');
