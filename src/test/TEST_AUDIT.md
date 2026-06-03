# Vitest test audit (2026-06)

Baseline: **49** files, **309** tests (`npm test`). After audit: **49** files, **302** tests (all pass). Playwright e2e: `e2e/home-smoke.spec.ts`, `e2e/vault-smoke.spec.ts` (live Bungie; out of Vitest scope).

`localeCompleteness.test.ts` (untracked WIP) failed until missing keys were filled from `en` via `node scripts/fill-missing-locale-keys.mjs` (English placeholders for translators).

## High-value (keep)

- **Integration flows** (`src/test/flows/*.integration.test.ts`): store + prefs + navigation outcomes (dupe heatmap toggle, calibrate back-stack, tag apply, duel undo, auto-filter browse, etc.).
- **Algorithm / domain** with fixtures: `dupes/duel`, `group`, `dismantle`, `queue`, `coverage/analyze`, `armor/parse*`, `scoring/*`, `auto-filter/match`.
- **`localeCompleteness.test.ts`**: regression guard for missing translation keys (structural, not UI smoke).
- **`nav.test.ts`**, **`prefs/storage.test.ts`**, **`hashScroll.test.ts`**: routing, migration, and persistence behavior.

## Shallow patterns removed or narrowed

| Area | Issue | Action |
|------|--------|--------|
| `locale.test.ts` | Asserted full `MANIFEST_LOCALES` array (duplicate of source constant) | Removed; kept `normalizeLocale` / `isManifestLocale` behavior |
| `rules.test.ts` | English label/card copy mirrors `dupes.json`; preset field asserts duplicate `DUPE_PRESETS` | Removed copy/constant tests; preset round-trip + `respectDimKeepFavoritePatch` kept |
| `redundantReason.test.ts` | Standalone badge/group label string table | Removed; fixture-based reason lines kept |
| `inventorySnapshot.test.ts` | `DEFAULT_VAULT_CAPACITY` / keep-target number table | Removed; trim/snapshot behavior tests kept |
| `buildCoverageLayout.test.ts` | CSS `gridTemplateColumns` string literals | Removed; viewport width math kept |

## Added / strengthened

- **`locale.test.ts` → `i18n runtime`** (2 tests): `changeLanguage('ko')` + `i18n.t()` and `dupeMatchStyleLabel` / card headline via real bundles (not JSON key parity alone).

## Removed / consolidated (9 shallow cases)

| File | Removed |
|------|---------|
| `locale.test.ts` | `MANIFEST_LOCALES` sorted array mirror |
| `rules.test.ts` | English label/card copy; Tuning/Loose preset field mirrors |
| `redundantReason.test.ts` | Standalone `redundantGroupReasonLabel` table |
| `inventorySnapshot.test.ts` | `DEFAULT_VAULT_CAPACITY` / keep-target constant table |
| `buildCoverageLayout.test.ts` | CSS `gridTemplateColumns` literals (2 tests) |

## Still acceptable but watch

- **`redundantReason.test.ts`**: English copy on `formatRedundantReasonLine` (pre-i18n helpers); prefer migrating helpers to i18n then asserting via `changeLanguage`, not raw strings.
- **`buildCoverageLayout`**: layout helpers are thin; cover via flow/UI if regressions appear.
- **E2e smokes**: import-only page load; keep minimal count.

## Guidance for new tests

1. Prefer `src/test/flows/` when state, prefs, or stores change.
2. Do not assert exported constant tables or English UI strings that live in locale JSON.
3. i18n: use `localeCompleteness` for keys; add runtime tests with `i18n.changeLanguage` for critical copy.
4. Use `data-testid` in component tests; avoid `@testing-library` text matching on translations unless testing i18n wiring explicitly.

See also `.cursor/rules/testing.mdc` and `AGENTS.md` (Tests).
