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

Ivory / cream / gold / warm grey. No pure blacks; WCAG AA contrast against
`#FAF7F0`. Tokens live in `src/index.css` under `@theme`.
