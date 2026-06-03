# Dead code audit (2026-06-02)

Static analysis: `npx knip` failed (oxc native binding / Node engine on this machine). Used **`npx ts-prune`** (unused exports), **`npm run build`** (`tsc -b` with `noUnusedLocals` / `noUnusedParameters`), and ripgrep cross-checks. No new permanent tooling was added.

## Removed

| Category | Count | Notes |
|----------|------:|-------|
| Source files deleted | **8** | Orphan components, `statTrace.ts`, `hash.ts`, `interactiveCursor.ts` |
| Unused exports / functions trimmed | **~35** | Across `constants`, `dismantle`, `learn`, `gameCopy`, `env`, `nav`, `cache`, etc. |
| `package.json` dependencies | **0** | None were unused |

### Files deleted

- `src/components/ClassSwitcher.tsx` (replaced by `HeaderClassPicker`)
- `src/components/SetCalibratePickCard.tsx`, `SwipePickCard.tsx`
- `src/components/dashboard/PieceLoadoutFitSummary.tsx`, `PrefsSummaryBar.tsx`
- `src/lib/armor/statTrace.ts`, `src/lib/hash.ts`, `src/lib/ui/interactiveCursor.ts`

## Intentionally kept

- **LEGACY** storage keys and `migrate.ts` paths
- All **locale JSON** under `src/locales/`
- **Test fixtures** and exports still referenced from `*.test.ts` / flow tests (e.g. `buildDismantleDisplayGroups`, `redundantReasonBadge`, deprecated dismantle/browse aliases)
- Large **`@deprecated`** surfaces in `loadout.ts`, `types/index.ts`, `dominance.ts`, etc. that remain part of migration or public re-exports
- **Legacy routes** in `App.tsx` (`/clean/:class`, `/build/:class`, `/dismantle/:class`)

## Verification

- `npm test`: 50 files, 310 tests passed
- `npm run build`: `tsc -b` + Vite production build succeeded
