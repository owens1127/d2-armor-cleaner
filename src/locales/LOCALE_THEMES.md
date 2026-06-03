# Locale audit themes (2026-06)

Recurring patterns from two full read-through passes per manifest locale (`de`, `es`, `es-mx`, `fr`, `it`, `ja`, `ko`, `pl`, `pt-br`, `ru`, `zh-chs`, `zh-cht`) plus a cross-locale batch fix for keys where **3+** non-English files still matched `en.json` verbatim.

## 1. Wrong-locale bleed (highest severity)

**Symptom:** Entire namespaces or blocks copied from another locale during `sync-locale-keys.mjs` or manual merge (e.g. French paragraphs in `es.json`, German in `pl.json` / `ru.json`, Korean in `ja.json` / `zh-chs.json`).

**Fix:** Re-read the target file against `en.json` only; grep suspicious scripts (Hangul in non-Korean files, umlauts in non-German files, etc.).

## 2. English bleed (untranslated UI chrome)

**Symptom:** User-facing labels still English while surrounding copy is localized (`Combo`, `Combos`, `Keep` / `Junk` in filters, nav, duel keyboard hints).

**Fix:** Translate chrome; keep product names where noted below.

**Batch keys often affected:**

| Theme | Example keys | Notes |
|--------|----------------|-------|
| Combo wording | `browse.filters.combo`, `build.combosHeading`, `nav.combos`, `review.table.combo`, `build.coverage.comboFallback` | Loanword OK in some langs; German/Polish prefer *Kombination* |
| DIM tag labels (UI) | `browse.dimTags.*`, `duel.keyboard.*`, `duel.compare.actionKeep` | DIM app tags stay English in queries; **filter dropdown labels** should be localized |
| Duel compare | `duel.compare.vs`, `duel.compare.setFootnote` | Short *vs* localized (`gegen`, `contre`, `frente a`, `対`, etc.) |
| Armor set fallback | `autoFilters.setFallback`, `game.diff.set`, `game.diff.setFootnote` | Translate “Set” where grammar needs it (`Conjunto`, `Satz`, …); keep `{{hash}}` |
| Archetype names | `game.archetypes.*` | Destiny terms: localize in DE/PL/RU/ZH; Romance langs often keep or adapt loanwords |
| Stat label | `game.stats.super` | Often kept as *Super* in Romance langs; localized in DE/ZH |

## 3. DIM tags and query syntax (do not translate)

- Filter/query strings: `id:`, `tag:junk`, `tag:keep`, etc.
- DIM product tag names in **search help** may stay English.
- `review.copy.junk` and similar **must** keep `tag:junk` syntax.

## 4. Class names and game constants

- `game.classes.hunter|titan|warlock`: localized for UI (`locale.test.ts` expects Korean **사냥꾼**, German **Jäger**, etc.).
- DIM example lines may still show English class names where they mirror in-game search.

## 5. Vault wording (Spanish variants)

- **es (Spain):** often *cámara* / *conjunto*.
- **es-mx:** **bóveda** / *conjunto* — avoid Spain-only *cámara* in Mexico file.

## 6. Language picker labels

- `common.language*` values stay in **native script** (e.g. `languageKo`: 한국어) in every file.

## 7. Brands, URLs, developer strings

- `Bungie`, `DIM`, `DIM Sync`, `GitHub`, `newo.report` — proper nouns; colons/spacing may follow locale typography only.
- `settings.developer.bungie` / `dimSync` status lines keep brand names.

## 8. Punctuation-only or identical words

- `game.labels.separator` (` · `) — same in all locales.
- `duel.subtitle.bucketProgress` — interpolation only.
- `game.diff.no` → **No** in Spanish/Italian is correct (not English bleed).
- `dupes.presets.standard.label` → **Standard** is a valid loanword in DE/FR/IT.

## 9. Plural / i18next suffixes

- Keys like `rulesOnboarding.impact.roll_one` must be translated per language (*tirada*, *tirage*, *rotolo*, *配装*, …), not left as English *roll*.

## Verification

```bash
node scripts/find-verbatim-en-bleed.mjs   # actionable 3+ locale matches
npm test                                   # expect 315 tests
npm run build
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/sync-locale-keys.mjs` | Propagate new keys from `en.json` (can introduce English placeholders — re-audit after) |
| `scripts/find-verbatim-en-bleed.mjs` | Report keys still identical to English in 3+ locales (see allowlist in script) |
