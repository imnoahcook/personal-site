# personal-site

Personal website: a retro-styled homepage plus a set of non-euclidean 3D scenes
built with React Three Fiber. Deployed on Vercel with a Postgres-backed
guestbook/visitor-counter API.

## Stack

- Vite + React 19 + TypeScript
- three.js / @react-three/fiber, drei, cannon, rapier for the 3D scenes
- Vercel serverless functions (`api/`) + Drizzle ORM + Postgres for the
  guestbook, star counts, and visitor counter
- Biome for linting/formatting, Vitest for tests

## Getting started

```bash
npm install
npm run dev        # frontend only, at http://localhost:5173
npm run dev:api    # frontend + API via `vercel dev`
```

The API routes need a `DATABASE_URL` env var (Postgres connection string) —
set it in `.env` for local dev with `vercel dev`, or in the Vercel project
settings for deploys. Without it, `dev` still works but guestbook/visitor
features will no-op.

## Scripts

- `npm run build` — typecheck (`tsc -b`) + Vite production build
- `npm run lint` — Biome check (lint + format check)
- `npm run lint:fix` — Biome check with autofix
- `npm run typecheck` — TypeScript project build, no emit
- `npm test` — run the Vitest suite once
- `npm run preview` — preview a production build locally

## Structure

- `src/pages/` — top-level routes, including the non-euclidean 3D scenes
  (`NonEuclidean*.tsx`, `Inspection.tsx`) and the main retro homepage
  (`Main.tsx`)
- `src/db/schema.ts` — single source of truth for the Drizzle table schemas,
  imported by every `api/*.ts` handler
- `api/` — Vercel serverless functions backing the guestbook, stars, visitor
  counter, and geolocation lookup
- `docs/` — scratch design notes for in-progress scenes/levels
