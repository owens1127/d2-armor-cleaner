# D2 Armor Cleaner

Destiny 2 armor tool for gear you have tiered in-game (Tier 1-5). Set dupe rules (Tier 5 by default, or Tier 4+), compare duplicate rolls, queue keep/junk tags, and sync to [DIM](https://destinyitemmanager.com).

Inspired by [tier5.report](https://tier5.report/): extended with preference learning and batch tagging.

## Quick start

```bash
npm install
npm run dev
```

Open **https://localhost:5173** and click **Sign in with Bungie.net**.

> **HTTPS:** Bungie OAuth requires `https://localhost`. The dev server uses a self-signed cert: your browser will warn once; click **Advanced → Proceed to localhost**.

### Live Bungie login

1. Copy `.env.example` → `.env`
2. Register at [bungie.net/en/Application](https://www.bungie.net/en/Application) with redirect URL **`https://localhost:5173/oauth/callback`** (path unchanged: no Bungie portal update needed unless you change host/port)
3. Request a localhost DIM key via [DIM new app](https://api.destinyitemmanager.com/new_app) (origin `https://localhost:5173`)
4. Fill `.env` using names from `.env.example` (`VITE_D2_ARMOR_CLEANER_*`). Legacy `VITE_BUNGIE_*` / `VITE_DIM_API_KEY` still work for one release.
5. Click **Sign in with Bungie.net**

> **DIM app name:** If you registered DIM before the rename, your production API key may still show an older app label in the DIM portal. That is fine: only the origin and key matter, not the display name. No `.env` changes needed.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (HTTPS :5173) |
| `npm run build` | Production build |
| `npm test` | Unit tests (vitest) |
| `npm run test:e2e` | Playwright smoke tests |

## Deploy

### Cloudflare Pages (recommended)

Connect the repo in the [Cloudflare dashboard](https://dash.cloudflare.com) (Pages → Connect to Git). Cloudflare builds on push, no GitHub Actions workflow. See **[DEPLOY.md](./DEPLOY.md)** for build settings, environment variables, and Bungie/DIM portal steps.

- Build: `npm ci && npm run build` → output `dist/`
- SPA routing: `public/_redirects` (`/* /index.html 200`)

## Architecture

- **Client-only SPA**: Vite, React 19, TypeScript, Tailwind 4, Zustand
- **APIs**: Bungie.net (inventory) + DIM Sync (tags)
- **Storage**: localStorage (prefs, dupe rules), sessionStorage (OAuth, clean session), IndexedDB (manifest + vault cache under `d2-armor-cleaner`). On first load after upgrade, `migrateStorage()` copies any data still under pre-rename keys into current `dac-*` / `d2-armor-cleaner` stores (once per browser).

## License

TBD
