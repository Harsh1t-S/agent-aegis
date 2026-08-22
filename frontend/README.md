# Aegis dashboard

The Aegis control centre: a Vite + React + React Router single-page app that
reads the evaluation API.

## Where its numbers come from

Every score, metric, failure count, delta and trace on these screens is fetched
from the API at request time. Nothing is seeded, cached in the bundle, or
computed from a fixture. Where the API cannot be reached, the screen says so
rather than showing a plausible substitute — a reliability tool that reports
unverified numbers has failed on its own terms.

The one exception is the execution trace on the marketing page, which is a
worked example and is labelled as one in the UI. It lives in
`src/data/showcase.ts`, uses types from `src/types/showcase.ts`, and cannot
typecheck as evaluation data.

## API access

Calls go to the same-origin `/api` prefix, so the browser never issues a
cross-origin preflight:

- **Development** — `vite.config.ts` proxies `/api` to `AEGIS_API_ORIGIN`
  (default: the deployed API). Point it at `http://127.0.0.1:8000` to develop
  against a local FastAPI instance.
- **Production** — `vercel.json` pins the Vite preset, rewrites `/api/:path*` to
  the API, and serves `index.html` for every other path so client-side routes
  survive a refresh. Rewrites run after the filesystem check, so hashed assets
  still resolve to real files.

This directory is the Vercel project root for `aegis-dashboard`.

`VITE_API_BASE_URL` overrides the prefix if you need an absolute origin. That
path requires the API's CORS policy to allow the calling origin.

## Commands

```
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run lint
npm run build
```

## Layout

```
src/lib/api.ts        typed client for every endpoint the UI uses
src/lib/format.ts     verdict bands, signed deltas, severity tones
src/hooks/            useResource — load / refresh / error, with optional polling
src/components/       presentational pieces, all driven by API types
src/pages/            marketing pages
src/pages/app/        the control centre
src/types/index.ts    mirrors the API payloads field for field
src/types/showcase.ts decorative types for the marketing page only
```
