# E2E tests (live Bungie)

Playwright tests use **real Bungie OAuth tokens** and load your live Destiny vault — no demo vault flow.

## Required env vars

Add to `.env` (never commit secrets):

| Variable | Source |
|----------|--------|
| `VITE_D2_ARMOR_CLEANER_BUNGIE_API_KEY` | Bungie app (legacy `VITE_BUNGIE_API_KEY` still works) |
| `VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_ID` | Bungie app |
| `VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET` | Bungie app |
| `VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI` | `https://localhost:5173/oauth/callback` |
| `E2E_BUNGIE_REFRESH_TOKEN` | After signing in locally once, copy `dac-bungie-refresh-token` from DevTools → Application → Session Storage |

Optional (not implemented — Bungie login often blocks automation):

| Variable | Purpose |
|----------|---------|
| `E2E_BUNGIE_USERNAME` | Full OAuth in browser (2FA/captcha may block) |
| `E2E_BUNGIE_PASSWORD` | Full OAuth in browser |

## How auth works in tests

1. Node refreshes `E2E_BUNGIE_REFRESH_TOKEN` against Bungie’s token endpoint.
2. Resolves your Destiny membership via Bungie API.
3. Injects `dac-bungie-token`, `dac-bungie-refresh-token`, and `dac-membership` into `sessionStorage` before navigation.
4. App bootstrap calls `loadLiveVault()` (manifest + inventory — first run can take 1–3 minutes).

Tests call `test.skip()` when `E2E_BUNGIE_REFRESH_TOKEN` is missing so CI without credentials does not fail.

## Run

```bash
npm run test:e2e
```

Dev server must be reachable at `https://localhost:5173` (Playwright starts it via `npm run dev` unless already running).
