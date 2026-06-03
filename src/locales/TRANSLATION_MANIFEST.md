# Translation manifest (English source)

English JSON in `src/locales/en.json` is the single source of truth before per-locale translation subagents run.

## Namespace key counts

| Namespace | Keys |
|-----------|-----:|
| autoFilters | 6 |
| browse | 42 |
| build | 8 |
| calibrate | 20 |
| common | 49 |
| dashboard | 81 |
| duel | 44 |
| dupes | 30 |
| errors | 34 |
| footer | 4 |
| game | 24 |
| home | 5 |
| layout | 3 |
| nav | 13 |
| onboarding | 25 |
| review | 31 |
| rulesOnboarding | 26 |
| settings | 49 |
| vault | 12 |
| **Total** | **506** |

Registered in `src/i18n/resources.ts` and loaded in `src/i18n/index.ts` / `src/i18n/test.ts`.

## Translator instructions

1. Copy `src/locales/en.json` to `src/locales/<locale>.json` for each manifest locale (`de`, `es`, `es-mx`, `fr`, `it`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-chs`, `zh-cht`).
2. Translate string values only; keep JSON keys and top-level namespace structure identical.
3. Do **not** translate:
   - Interpolation tokens: `{{name}}`, `{{count}}`, `<1>...</1>` (i18next / Trans component markup).
   - Destiny proper nouns and armor set names from the Bungie manifest (in-game item names stay as returned by the API).
   - DIM query syntax (`id:`, `tag:junk`, etc.).
4. Game terms in `CLASS_LABELS`, `STAT_LABELS`, `ARCHETYPE_LABELS`, `SLOT_LABELS` in `src/lib/constants.ts` may remain English until a dedicated `game.json` expansion; UI chrome around them should use locale files.
5. Plural keys use i18next suffixes (`_one`, `_other`) where present (e.g. `onboarding:piece_one`).
6. After translating a locale, run `node scripts/sync-locale-keys.mjs` so new English keys propagate; `src/i18n/resources.ts` loads all `src/locales/*.json` via glob.

## Lib copy helpers (non-React)

Use these from algorithm/lib code so strings stay in JSON:

| Helper | Namespace |
|--------|-----------|
| `src/i18n/dupesCopy.ts` | dupes |
| `src/i18n/errorsCopy.ts` | errors |
| `src/i18n/dashboardCopy.ts` | dashboard |
| `src/i18n/onboardingCopy.ts` | onboarding |
| `src/i18n/browseCopy.ts` | browse |
| `src/i18n/reviewCopy.ts` | review |
| `src/i18n/gameCopy.ts` | game (partial) |

## Documented exceptions (hardcoded English still in UI)

Phase 1 migrated core pages, vault/settings flows, and shared lib messages. The following surfaces still have hardcoded English and should be wired to the listed namespaces in a follow-up pass:

| Area | Examples | Target namespace |
|------|----------|------------------|
| `BrowsePage.tsx` | Filter labels, DIM tag options, sort options, page title | browse |
| `DuelPage.tsx` | Compare chrome, empty states, confirmations | duel |
| `CalibratePage.tsx` | Step titles, instructions, bonus toggle | calibrate |
| `InventorySnapshotPage.tsx` | Vault trim copy, keep-goal section | onboarding |
| `ReviewPage.tsx` | Table headers, apply/clear actions, confirms | review |
| `SettingsPage.tsx` | Developer block, review-tags block, class prefs actions | settings / common |
| `BuildCoveragePanel.tsx`, `DesiredBuildsSection.tsx` | Combo coverage UI | build / dashboard |
| `AutoFilterRulesSection.tsx` | Rule builder copy | autoFilters |
| Duel/browse components | `ArmorCard`, `DuelComparePanel`, `BucketWrapUpPanel`, etc. | duel / browse |
| `lib/armor/diff.ts`, `lib/coverage/achievability.ts`, `lib/scoring/fitDisplay.ts` | Roll comparison labels | game (via `gameCopy.ts`) |

Bungie API error strings returned verbatim are not translated (only hints from `vaultErrorHint` use `errors:vault.*`).

## Verification

```bash
npm test
npm run build
```
