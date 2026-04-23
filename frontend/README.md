# BCAL Frontend

React + Vite dashboard for the **BioCompliance Audit Layer**. Renders a
Statistical Evidence Package (SEP) produced by the `bcal` Python CLI.

## Run locally

```bash
npm install
cp .env.example .env    # optional — only needed for LLM enhancement
npm run dev             # starts Vite (port 3000) and the API server (8787)
```

Open http://localhost:3000.

## Modes

| Mode | Trigger | Cost |
|---|---|---|
| **Deterministic (default)** | Default; also used when server is unreachable | Zero |
| **LLM-enhanced** | `GEMINI_API_KEY` set on the server **and** the client requests `?mode=llm` | Per Gemini pricing |

The API key is **only ever read by the server** (`server/index.ts`). It is
never injected into the browser bundle.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite + server, concurrently |
| `npm run build` | Type-check + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run test` | Vitest |

## Wiring to real SEPs

By default the dashboard renders `src/services/dataService.ts` mock data. To
display a real SEP, drop the JSON produced by `bcal audit` at
`public/sep.json` and update `App.tsx` to `fetch('/sep.json')` on mount.
(A follow-up iteration will add a file-picker.)

## Palette

White / cream / vivid gold / crisp near-black. WCAG AAA contrast against
`#FFFFFF`. Tokens live in `src/index.css` under `@theme`.

## Deploy (free, auto on push)

**Cloudflare Pages** — recommended. Two paths:

### Option A: Dashboard (zero-secret, simplest)
1. https://dash.cloudflare.com → **Pages → Create project → Connect to Git**
2. Root directory: `frontend`
3. Build command: `npm ci && npm run build`
4. Output directory: `dist`
5. Environment variable: `VITE_BCAL_MODE = static`

Every push to `main` redeploys. Per-PR preview URLs are automatic.

### Option B: GitHub Actions (more control)
1. Create the Pages project in the CF dashboard once (any settings — the workflow publishes over them).
2. Add repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. Push — `.github/workflows/deploy-cloudflare-pages.yml` builds and publishes.

### What gets deployed
- The SPA only. No server proxy.
- `VITE_BCAL_MODE=static` tells the client to skip the `/api/enhance` fetch
  and render the deterministic template directly — so no 404 noise in
  devtools and no cost.
- `public/_headers` sets security headers; `public/_redirects` provides SPA
  fallback so `/docs`, `/sep`, etc. resolve cleanly.

### If you ever want the LLM path live
Move `server/index.ts` behind **Cloudflare Workers** (or Vercel/Netlify
functions). Set `GEMINI_API_KEY` as a platform secret (server-side only),
and flip `VITE_BCAL_MODE=local` for the frontend. The client auto-picks up
the API without code changes.
