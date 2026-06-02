# Deploy to Cloudflare Pages

Static Vite + React SPA. No Cloudflare Workers are required for Bungie OAuth or DIM Sync—the browser calls `bungie.net` and `api.destinyitemmanager.com` directly (same as local HTTPS dev and Vercel). If token exchange fails with a CORS error in production only, you would need a small OAuth proxy Worker; that has not been required for this app’s existing client-only flow.

**No GitHub workflow needed** — connect the repo in the Cloudflare dashboard; Cloudflare builds and deploys on every push to your production branch.

## Build settings

| Setting | Value |
|---------|--------|
| Framework preset | None (or Vite) |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |

SPA client routing: `public/_redirects` ships `/* /index.html 200` into `dist/` at build time.

## Connect GitHub in Cloudflare

1. Push this repo to GitHub (no remote is configured in a fresh clone).
2. [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the repository and branch (`main`).
4. Use the build settings in the table above.
5. Under **Settings → Environment variables**, add the variables below for **Production** (and **Preview** if you want preview deployments to sign in).
6. Deploy. Note your URL: `https://<project>.pages.dev` or your custom domain.
7. Set `VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI` to `https://<your-host>/oauth/callback` and redeploy.
8. In [Bungie API portal](https://www.bungie.net/en/Application), add the same redirect URI.
9. Request a production DIM API key with your Pages origin (see [dim-api](https://github.com/DestinyItemManager/dim-api)).

Cloudflare rebuilds automatically on each push; you do not need `CLOUDFLARE_API_TOKEN`, GitHub Actions, or Wrangler for production deploys.

## Environment variables (Vite)

All `VITE_*` values are embedded at **build time**. Changing them in the dashboard requires a new deployment.

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_D2_ARMOR_CLEANER_BUNGIE_API_KEY` | Yes | From your Bungie application |
| `VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_ID` | Yes | OAuth client ID |
| `VITE_D2_ARMOR_CLEANER_BUNGIE_CLIENT_SECRET` | Yes | Confidential client; exposed in the static bundle (same pattern as `.env` local dev) |
| `VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI` | Yes | **Exact** match with Bungie portal, e.g. `https://<project>.pages.dev/oauth/callback` |
| `VITE_D2_ARMOR_CLEANER_DIM_API_KEY` | Yes for DIM sync | Register app origin with DIM for your production URL |

Legacy names (`VITE_BUNGIE_*`, `VITE_DIM_API_KEY`) still work for one release; prefer `VITE_D2_ARMOR_CLEANER_*`.

Copy `.env.example` for local development. **Do not commit** `.env`.

### Bungie redirect URI checklist

1. Deploy once to learn the hostname (`*.pages.dev` or custom domain).
2. Set `VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI=https://<host>/oauth/callback`.
3. Add the same URL in Bungie.net → your application → **OAuth Client Properties**.
4. Trigger a new build/deploy.

If `VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI` is unset at build time, the app falls back to `window.location.origin + '/oauth/callback'` at runtime—which works only if that origin is registered in Bungie.

## Custom domain (optional)

Cloudflare Pages → your project → **Custom domains** → add domain and follow DNS instructions. Update `VITE_D2_ARMOR_CLEANER_BUNGIE_REDIRECT_URI` and Bungie redirect URIs to the custom host, then redeploy.

## Local verification

```bash
npm ci
npm run build
npm run preview          # Vite preview of dist/
npx wrangler pages dev dist   # Cloudflare Pages local preview (optional; wrangler.toml)
```

`wrangler.toml` is for local `wrangler pages dev` only, not for CI or dashboard deploys.

## Local dev vs production

| | Local | Cloudflare Pages |
|---|--------|------------------|
| URL | `https://localhost:5173` | `https://<project>.pages.dev` or custom domain |
| HTTPS | Dev server self-signed (`@vitejs/plugin-basic-ssl`) | Cloudflare TLS |
| Redirect URI | `https://localhost:5173/oauth/callback` | `https://<host>/oauth/callback` |
| Env source | `.env` | Cloudflare Pages environment variables |
