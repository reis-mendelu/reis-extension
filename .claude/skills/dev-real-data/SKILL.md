---
name: dev-real-data
description: Use when running the reIS UI locally against real IS Mendelu data — the localhost:3000 dev webapp, the scrape-real-data snapshot, snapshot auto-refresh, or why `npm run dev` (WXT) can't serve the app over HTTP.
---

# Local dev with real data

To view the reIS UI at `localhost:3000` against your **real** (possibly stale) IS data, without an extension and without a live IS session:

1. **Scrape once:** put `MENDELU_USER`/`MENDELU_PASS` in `.env`, then `npm run scrape:real`. This runs `scripts/scrape-real-data.ts`: Playwright logs into IS, and the extension's **own** `src/api/*` fetchers/parsers run in Node (happy-dom + fake-indexeddb + a cookie-injecting fetch, set up in `scripts/lib/nodeRuntime.ts`) via `scripts/lib/collectRealData.ts` — a standalone mirror of `syncAllData`. It writes `public/dev-real-data.json` (gitignored, real personal data).
2. **Run the webapp:** `npm run dev:web` (Vite, `vite.web.config.ts`, root `dev/`) serves the React app as a plain page at `http://localhost:3000`. On mount, standalone (non-iframe) + dev ⇒ `useAppLogic` fetches `/dev-real-data.json` and feeds it through the real `REIS_SYNC_UPDATE` handler (`src/services/loadRealDataSnapshot.ts`), so the UI renders exactly as in production.

**Auto-refresh:** the `reisSnapshotPlugin` (`dev/snapshotPlugin.ts`) checks the snapshot's `lastSync` on `dev:web` startup. Fresh (`< 7d`) → instant render, no work. Stale (`≥ 7d`) or missing → it spawns `scrape:real` in the **background** (rendering never blocks) and live-reloads the page when the fresh snapshot lands. A `public/.dev-real-data.lock` (gitignored) prevents double-scrapes; missing `.env` creds skip with a hint. Tunables: `REIS_SNAPSHOT_MAX_AGE_DAYS` (default 7; `0` forces a refresh — useful for testing), `REIS_SNAPSHOT_NO_AUTOFETCH=1` (disable auto-refresh). Freshness math is the tested pure module `scripts/lib/snapshotFreshness.ts`.

Why not `npm run dev` (WXT)? `wxt dev` builds an **extension** and its dev server does not serve the app HTML over HTTP — the app can't be opened at a localhost URL that way. The `dev/` harness (`chromeShim.ts` + `main.web.tsx` + `index.html`) runs the same app as a normal webapp instead; a minimal `chrome.*` shim covers the extension APIs the app touches at mount. `@source "../src/**"` in `src/index.css` lets Tailwind scan components when Vite's root is `dev/`.

Anti-drift is enforced by `scripts/lib/__tests__/no-parser-reimpl.test.ts` (the scraper must reuse `@/api/*`, never reimplement parsers). The `build:publicAssets` hook in `wxt.config.ts` strips `dev-real-data.json` from production extension builds so real data never ships.
