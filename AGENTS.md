# Agent guidance

Global conventions for AI agents working in this repo.

## Punctuation and copy

- Do not use em dashes (U+2014, `—`) in user-facing copy, comments meant for users, or docs.
- Prefer short sentences, commas, hyphens, or middle dots (`·`) for labels and list-like phrases.
- Keep UI and doc text concise and plain.

## Internationalization (i18n)

- Stack: **i18next** + **react-i18next** + **i18next-browser-languagedetector** (see `src/i18n/`).
- Default locale: `en`. One JSON file per manifest locale: `src/locales/<code>.json` (e.g. `en.json`, `ko.json`).
- Each locale file is a single object whose **top-level keys are i18next namespaces** (`common`, `nav`, `dupes`, etc.). Nested keys under each namespace are unchanged from the old per-file layout.
- **Supported UI locales** match Bungie Destiny 2 manifest locales (`MANIFEST_LOCALES` in `src/i18n/manifestLocales.ts`, from `GET /Platform/Destiny2/Manifest/` → `jsonWorldComponentContentPaths` keys): `de`, `en`, `es`, `es-mx`, `fr`, `it`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-chs`, `zh-cht`.
- Browser / BCP-47 tags are normalized to those codes (e.g. `zh-CN` → `zh-chs`, `pt-BR` → `pt-br`). `manifestLocaleToI18nTag()` documents the i18next tag mapping where it differs.
- **Do not add hardcoded user-facing strings** in components or pages. Use `useTranslation('namespace')` and `t('key')`, or `<Trans>` for inline markup. Lib helpers use `i18n.t('namespace:key')` (colon namespace separator).
- Shared dupe-rule copy: `dupes` section in `src/locales/en.json`; helpers in `src/i18n/dupesCopy.ts` and `src/lib/dupes/ruleUi.ts` (re-exports). Preset labels use `dupes:presets.<id>.label`.
- Bundles load via `import.meta.glob('../locales/*.json')` in `src/i18n/resources.ts` (`SUPPORTED_LOCALES` follows `MANIFEST_LOCALES`).
- Tests: Vitest loads English via `src/i18n/vitest.setup.ts`. Prefer `data-testid` over matching translated text in tests.
- Language switcher: `LanguageSwitcher` (Settings). **Use browser language** toggle (default on) in `d2ac.locale.useBrowser`. Manual choice in `d2ac.locale` when the toggle is off. Untranslated locales fall back to `en`; each locale file needs a `common` section with native language names (`language*` keys).
- Sync missing keys from English: `node scripts/sync-locale-keys.mjs`.

### Adding a new language

1. If Bungie adds a manifest locale, add it to `MANIFEST_LOCALES` and `src/i18n/localeLabels.ts`, then add `src/locales/<code>.json` (copy `en.json` structure; translate string values).
2. Run `node scripts/sync-locale-keys.mjs` to backfill any new English keys into other locales.
3. No manual `resources.ts` imports: new `<code>.json` files are picked up by the glob.

### What stays untranslated

Only strings that should not or do not make sense to localize:

- **Product and brand names:** Bungie, DIM, DIM Sync, GitHub, etc.
- **Search/query syntax:** DIM filters (`id:`, `tag:junk`, …), not the UI labels around them.
- **Manifest-owned names:** armor piece and set names from Bungie API definitions (loaded at runtime per locale, not hand-translated in JSON).
- **Raw API errors:** verbatim Bungie error text; app hints use `errors:*`.

**Do localize** UI chrome and game taxonomy the player sees in our UI: stats, archetypes, classes, slots, buttons, instructions, etc. Prefer Bungie manifest display names for taxonomy when available; use `game:*` locale keys as fallback before manifest load.

### Phase 2 follow-up (not required for every change)

- Manifest-driven labels for stats, archetypes, classes, and slots (reduce duplicate `game.*` strings).
- Pluralization and ICU rules for non-English locales where needed.

## Code changes

- Match existing naming, imports, and patterns. Minimize scope.
- No git commits or pushes unless the user asks.
- Before finishing: run `npm test` and `npm run build`.

## Tests

- Prefer integration/flow tests over trivial unit tests.
- Assert behavior and outcomes, not implementation strings or locale JSON mirrors.
- i18n: `localeCompleteness.test.ts` for keys; runtime checks with `i18n.changeLanguage` for wired copy (see `src/i18n/locale.test.ts`).
- Avoid shallow tests: constant tables, preset field mirrors, CSS string literals, English label asserts when keys live in `src/locales/*.json`.
- See `.cursor/rules/testing.mdc` for details.

## Mobile layout

- Primary breakpoint: Tailwind `sm` (640px). Combo loadout tokens also tighten below 640px in `src/index.css` (`--loadout-column-min`, `--loadout-choose-col`, action rail).
- Class switching lives in `HeaderClassPicker` only; class-scoped pages should not duplicate class toggles.
- `Layout` main uses `pb-20` under `md` so content clears `MobileNav`; footer already pads for the bar.
- Grids: stack to one column below `sm` unless noted (browse cards, redundant dupe groups, heatmap archetype columns).
- Wide tables and heatmaps use `overflow-x-auto` wrappers; avoid fixed `min-w` on filter rows without a `sm:` fallback.
