# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

reIS (REIS.mendelu) is a Chrome browser extension that simplifies the MENDELU university Information System (IS Mendelu) for students. Built with WXT, it injects an iframe containing a React app into IS Mendelu pages. All processing is client-side — no student data is intercepted or stored externally.

## Multi-Repo Organization

Five repos live as siblings under `../`:

| Repo | Path | Role |
|------|------|------|
| **reis-extension** | `../reis-extension` | This repo — browser extension |
| **reis-scraper** | `../reis-scraper` | Playwright scraper — authenticates to IS Mendelu with real credentials, crawls data into SQLite |
| **reis-data** | `../reis-data` | Static CDN — pre-crawled subject difficulty JSON served via jsDelivr |
| **reis-admin** | `../reis-admin` | Vercel dashboard for admin/ops tooling |
| **reis-page** | `../reis-page` | Public marketing/landing page (static site, install instructions + screenshots), deployed via Vercel |

**Subject difficulty pipeline:** `reis-scraper` crawls IS Mendelu → exports JSON → committed to `reis-data` → served via jsDelivr CDN → extension fetches at runtime (`src/api/successRate.ts`, `src/api/erasmus.ts`).

**Supabase** is separate — the extension uses it directly for notifications. Not related to scraper or reis-data.

When a task involves IS Mendelu data, a new scraper, or the CDN data shape: read `../reis-scraper/scripts/` for patterns and `../reis-scraper/db/schema.sql` for the data model before designing anything. Scraper tasks run via a dedicated sub-agent. Use `/repos` for full detail.

## Commands

```bash
npm run dev              # WXT dev server
npm run dev:firefox      # WXT dev server, Firefox target
npm run build            # Production build
npm run build:firefox    # Production build, Firefox target
npm run build:watch      # Watch-mode rebuild
npm run zip              # Create deployable .zip
npm run zip:firefox      # Create deployable Firefox .zip

npm run test             # Vitest watch mode
npm run test:run         # Single test run
npm run test:coverage    # Coverage report (V8)
npm run test:e2e         # Playwright E2E (headless)
npm run test:e2e:headed  # E2E with visible browser
npm run test:serenity    # Playwright subset in e2e/serenity/specs
npm run test:smoke       # Fast Playwright smoke subset (e2e/serenity/specs/smoke.spec.ts)
npm run test:e2e:setup   # Install Playwright's chromium browser

npm run lint             # ESLint
npm run typecheck        # TypeScript strict check
```

Run a single test file: `npx vitest run src/store/slices/__tests__/someSlice.test.ts`

## Local dev with real data

To view the reIS UI at `localhost:3000` against your **real** (possibly stale) IS data, without an extension and without a live IS session:

1. **Scrape once:** put `MENDELU_USER`/`MENDELU_PASS` in `.env`, then `npm run scrape:real`. This runs `scripts/scrape-real-data.ts`: Playwright logs into IS, and the extension's **own** `src/api/*` fetchers/parsers run in Node (happy-dom + fake-indexeddb + a cookie-injecting fetch, set up in `scripts/lib/nodeRuntime.ts`) via `scripts/lib/collectRealData.ts` — a standalone mirror of `syncAllData`. It writes `public/dev-real-data.json` (gitignored, real personal data).
2. **Run the webapp:** `npm run dev:web` (Vite, `vite.web.config.ts`, root `dev/`) serves the React app as a plain page at `http://localhost:3000`. On mount, standalone (non-iframe) + dev ⇒ `useAppLogic` fetches `/dev-real-data.json` and feeds it through the real `REIS_SYNC_UPDATE` handler (`src/utils/loadRealDataSnapshot.ts`), so the UI renders exactly as in production.

**Auto-refresh:** the `reisSnapshotPlugin` (`dev/snapshotPlugin.ts`) checks the snapshot's `lastSync` on `dev:web` startup. Fresh (`< 7d`) → instant render, no work. Stale (`≥ 7d`) or missing → it spawns `scrape:real` in the **background** (rendering never blocks) and live-reloads the page when the fresh snapshot lands. A `public/.dev-real-data.lock` (gitignored) prevents double-scrapes; missing `.env` creds skip with a hint. Tunables: `REIS_SNAPSHOT_MAX_AGE_DAYS` (default 7; `0` forces a refresh — useful for testing), `REIS_SNAPSHOT_NO_AUTOFETCH=1` (disable auto-refresh). Freshness math is the tested pure module `scripts/lib/snapshotFreshness.ts`.

Why not `npm run dev` (WXT)? `wxt dev` builds an **extension** and its dev server does not serve the app HTML over HTTP — the app can't be opened at a localhost URL that way. The `dev/` harness (`chromeShim.ts` + `main.web.tsx` + `index.html`) runs the same app as a normal webapp instead; a minimal `chrome.*` shim covers the extension APIs the app touches at mount. `@source "../src/**"` in `src/index.css` lets Tailwind scan components when Vite's root is `dev/`.

Anti-drift is enforced by `scripts/lib/__tests__/no-parser-reimpl.test.ts` (the scraper must reuse `@/api/*`, never reimplement parsers). The `build:publicAssets` hook in `wxt.config.ts` strips `dev-real-data.json` from production extension builds so real data never ships.

## Release

Pushing a `v*` tag triggers `.github/workflows/publish.yml` → builds Chrome + Firefox zips → submits to all three stores via `wxt submit`. Use `/release` to automate the full flow.

**Manual steps (or use `/release`):**
1. Bump version in `package.json` and `wxt.config.ts` (manifest) — both must match
2. Commit: `chore: bump to X.Y.Z - <one-line description>`
3. Tag + push: `git tag vX.Y.Z && git push origin main vX.Y.Z`

**Store review SLAs** (version goes live after review):

| Store | Typical review time |
|-------|-------------------|
| Chrome Web Store | 1–3 days |
| Firefox AMO | days–weeks (manual review) |
| Edge Add-ons | 1–7 days |

**GitHub Secrets** (repo → Settings → Secrets → Actions):

| Store | Secrets |
|-------|---------|
| Chrome | `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` |
| Firefox | `FIREFOX_EXTENSION_ID`, `FIREFOX_API_KEY`, `FIREFOX_API_SECRET` |
| Edge | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY` |

> `CHROME_REFRESH_TOKEN` is permanent only while the Google OAuth consent screen is set to **"In production"** (currently set). If it ever reverts to "Testing", tokens expire after 7 days.

## Architecture

### Extension Structure (WXT)
- **Content script** (`src/entrypoints/content.ts`) — injects an iframe into IS Mendelu pages
- **Iframe app** (`src/entrypoints/main/`) — React 19 app rendered inside the iframe
- **Injector** (`src/injector/`) — DOM manipulation, iframe lifecycle, postMessage IPC between content script and app
- Manifest is generated from `wxt.config.ts` (never hand-edited)

### State & Storage (3-Tier)
1. **Zustand** (in-memory, reactive) — all UI reads go through `useAppStore` synchronously
2. **IndexedDB** via `IndexedDBService` — persistent heavy data, survives reloads
3. **Chrome Sync** — small user settings that follow across devices

Store uses the **slice pattern**: `src/store/slices/create*Slice.ts` composed into `useAppStore.ts`.

### Data Flow
- `src/api/` — stateless fetch functions (network only)
- `src/services/sync/` — background sync orchestrator (IS Mendelu → IndexedDB → Zustand)
- Components read from store synchronously; background sync is the only authorized writer to persistent state

### Dual-Language (CZ/EN)
- Language-sensitive data stored as `{ cz: Data, en: Data }`
- Sync services fetch both languages in parallel for instant switching
- Internal code uses `'cs'`/`'en'`; IS Mendelu API uses `'cz'`/`'en'` — mapping applied in API layer
- UI strings via `useTranslation()` hook reading from `src/i18n/locales/{cs,en}.json`

## Host Integration Contract

The extension uses a **push-based postMessage IPC** for each injected host. There are exactly two execution contexts: the **content script** (runs on the host page, has auth cookies) and the **iframe app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse.

### IS Mendelu (`is.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/content.ts` | Registers `handleMessage`, calls `startInjection()` |
| Iframe injection + queue | `injector/iframeManager.ts` | `injectIframe()`, `markIframeReady()`, `sendToIframe()` |
| Data fetching | `injector/syncService.ts` | `startSyncService()` → `syncAllData()` → `sendToIframe(REIS_SYNC_UPDATE)` |
| Message routing | `injector/messageHandler.ts` | Handles `REIS_READY` → flush queue; handles actions/fetch/data |
| Iframe bootstrap | `entrypoints/main/main.tsx` → `hooks/useAppLogic.ts` | IDB hydration → signal `REIS_READY` → listen for `REIS_SYNC_UPDATE` |
| Skeleton guard | `store/slices/createSyncSlice.ts` | `handshakeDone` / `handshakeTimedOut` (10s) unblock skeletons |

### WebISKAM (`webiskam.mendelu.cz`)
| Role | File | Responsibility |
|------|------|----------------|
| Content script entry | `entrypoints/webiskam.content.ts` | `document.open/write/close` to take over the page, registers `handleIskamMessage`, calls `startIskamSync()` |
| Iframe injection + queue | `injector/iskamInjector.ts` | `startIskamInjection()`, `markIskamIframeReady()`, `sendToIskamIframe()` |
| Data fetching | `injector/iskamSyncService.ts` | `startIskamSync()` → `syncIskamData()` → `sendToIskamIframe(ISKAM_SYNC_UPDATE)` |
| Message routing | `injector/iskamMessageHandler.ts` | Handles `ISKAM_READY` → flush queue + send current state; handles `ISKAM_FETCH_BLOCK` and `logout` |
| Iframe bootstrap | `entrypoints/iskam/IskamApp.tsx` | IDB hydration → signal `ISKAM_READY` → listen for `ISKAM_SYNC_UPDATE` |
| Skeleton guard | `store/iskamStore.ts` | `handshakeDone` / `handshakeTimedOut` (10s) unblock skeletons |

**ISKAM-specific behaviors:**
- The content script replaces the entire WebISKAM page via `document.open/write/close` — it owns the DOM entirely, there is no partial injection.
- `syncIskamData()` calls `fetchDualLanguageIskam()` (fetches profile + reservations in CZ and EN in parallel). If the session is expired, the fetch throws `IskamAuthError`; the handler then redirects to `${ISKAM_BASE}/ObjednavkyStravovani` to re-authenticate, rather than sending an error to the iframe.
- `ISKAM_FETCH_BLOCK` is a message type the iframe sends to request a block fetch. The handler in `iskamMessageHandler.ts` performs the fetch and sends the result back.
- On `logout`, the message handler clears all IDB data then redirects to the IS Mendelu logout URL.

### Isolation rules
- `useIskamStore` is separate from `useAppStore`. They share only theme/language (via `loadTheme`/`loadLanguage`).
- `IskamMessages` factory is separate from `Messages` factory. ISKAM message types begin with `ISKAM_`.
- The ISKAM iframe never calls the WebISKAM API directly. Only the content script calls `fetchDualLanguageIskam()`.
- IDB writes for ISKAM data happen in the iframe (`IskamApp.tsx`), not in the content script — mirrors IS Mendelu pattern.
- Adding a new host: create `injector/<host>Injector.ts`, `injector/<host>SyncService.ts`, `injector/<host>MessageHandler.ts`, message types (`ISKAM_*` → `<HOST>_*`), and iframe bootstrap logic.

## Error Reporting & Privacy

### Pipeline
`logError(context, err, extra?)` (`src/utils/reportError.ts`) is the single call site for all non-fatal errors. It logs to `console.error` locally and calls `sendTelemetry(context, err)` (`src/services/errorReporter/telemetry.ts`). The `extra` object is **never** transmitted.

**Three reporting paths — all funnel to `sendTelemetry`:**
1. **Automatic** — `installErrorReporter()` catches `window.onerror` and `unhandledrejection` events in the iframe app.
2. **Explicit** — `logError(...)` at structured `try/catch` sites throughout the codebase.
3. **Content-script bridge** — content scripts have no Supabase access; they call `sendToIframe(Messages.telemetryError(context, err))` or `sendToIskamIframe(Messages.telemetryError(...))` to route the report through the iframe.

Context naming convention: `Slice.method`, `Api.fetchX`, `Sync.stepY`, `Iskam.fetchX`, `Parser.parseX`, `useHookName.action`.

### What is (and isn't) transmitted

Telemetry is sent via the `report_error_v2` Supabase RPC (`src/services/errorReporter/telemetry.ts`), which additionally aggregates reports into an `error_groups` table by fingerprint for triage. Fields transmitted: `p_session_id`, `p_error_type`, `p_error_message`, `p_file_path`, `p_line_number`, `p_stack_excerpt`, `p_client_ts`, `p_extension_version`, `p_browser_name`, `p_browser_version`. The legacy `report_error` RPC (7 fields, no session/stack/timestamp) still exists for back-compat but is no longer the primary path.

**Sanitization** (`src/services/errorReporter/sanitize.ts`) runs on message and file path before transmission:
- Redacts bearer/cookie tokens, all email addresses, all `*.mendelu.cz` URLs, and 6–7-digit student/staff IDs.
- Strips query strings and fragments from file paths; strips extension ID prefix from `chrome-extension://` paths.
- `normalizeFromRejection` in `reporter.ts` emits `<non-error rejection: typeof X>` instead of `JSON.stringify(reason)` to prevent object payloads (parsed API responses with grades, names) from leaking.

**Never sent:** student name, UIC/student ID (raw or hashed), session cookies, IS Mendelu data (grades, schedules, exams), IndexedDB contents.

### Supabase schema
- Table: `error_reports` — RLS enabled, zero policies (deny-all for direct row access).
- Table: `error_groups` — fingerprint-based aggregation of reports for triage (added with v2 pipeline).
- RPC: `report_error_v2(...)` — `SECURITY DEFINER`, grants `EXECUTE` to `anon` role, enforces 500 reports/hour server-side rate limit per `(browser, version)` window. Migration: `supabase/migrations/20260520120000_error_reports_v2.sql`. Legacy `report_error(...)` RPC (migration `supabase/migrations/20260506120000_error_reports_rate_limit.sql`) still exists for back-compat.

## Google Drive Backup (Phase 1)

One-way mirror of the student's **current-semester** IS files into their own Google Drive. Phase 0 (OAuth plumbing), Phase 1 (file backup), and Phase 2 (notes → one Google Doc + JSON sidecar per subject) are all done. Phase 2 is **strictly one-way, drawer-as-source — never build bidirectional sync**.

- **Scope = `drive.file` only** — non-sensitive, no Google verification/CASA. The app can see only files it created. Never escalate to `drive`/`drive.readonly`/`documents`.
- **Auth:** `launchWebAuthFlow` + PKCE, run in the **background SW** (`chrome.identity` is not exposed to the iframe). Token exchange/refresh goes through the **Supabase `google-oauth` Edge Function**, which holds `GOOGLE_CLIENT_SECRET` — the secret never ships in the bundle. Tokens live in `chrome.storage.local`.
- **Where it runs:** the **content script** (`syncService.ts` → `syncDriveBackup`), the only context with IS cookies (binary `fetchWithAuth`), the Google token, and the googleapis host permission. It reuses listings already in `cachedData.files` — no extra IS crawling.
- **Idempotency (the core invariant):** the manifest (`reis_drive_manifest` in `chrome.storage.local`) is a **cache, not the source of truth**. Folders are **find-or-create by name+parent**; files are deduped by an **`appProperties.reisLink` hash** checked before upload. An interrupted run therefore cannot create duplicates. **Never dedupe files by filename** — IS legitimately serves many files with the same display name (e.g. several "Materiály"); only the IS-link hash is unique. Structure mirrors IS one level: `reIS/<CODE - name>/<subfolder?>/<file>`.

| Role | File |
|------|------|
| Pure diff/flatten/hash logic | `src/services/drive/driveDiff.ts` (tested) |
| Manifest persistence | `src/services/drive/driveManifest.ts` |
| Orchestrator (content script) | `src/services/drive/driveBackup.ts` |
| Notes backup (Phase 2) + Docs renderer | `src/services/drive/driveNotesBackup.ts`, `src/services/drive/notesDoc.ts` |
| Drive REST (find/ensure/upload/delete) | `src/api/googleDrive.ts` |
| OAuth + token refresh via proxy | `src/api/googleAuth.ts` |
| Backup UI (status + connect) | `src/components/SubjectFileDrawer/Header/DriveBackupStatus.tsx`, `src/hooks/data/useDriveBackup.ts` |

**Dev surface:** backup status/connect UI lives in the file drawer header (`DriveBackupStatus.tsx`); the standalone `GoogleDevPanel` was removed (the dev-panel era ended in commit `7a8ec01`). `resetDriveBackup()` (delete `reIS` root + clear manifest for a clean repave) still exists in `driveBackup.ts` but is no longer wired to UI — call it from a temporary hook if you need a repave. `VITE_GOOGLE_DEV=true` still gates dev-only behavior.

> **Operational gotcha:** the OAuth **consent screen must be "In production"** (not "Testing"), or every user's refresh token expires after 7 days and the backup silently stops. `drive.file` is non-sensitive, so Production needs no review.

**Before shipping to real users** (a backup's worst failure is silent): verify the consent screen is in Production; verify drive.file reinstall access (disconnect→reconnect must `reuse`, not re-upload); rate-limit the proxy. *(Done: cross-tab TTL lock via `acquireBackupLock`/`releaseBackupLock` in `driveManifest.ts`; last-success/failing-since surfaced in `DriveBackupStatus.tsx`.)*

## Parser Rules

IS Mendelu HTML parsers (`src/api/documents/parser.ts`, `src/api/cvicneTests.ts`, `src/utils/parsers/`) are **extremely brittle** and must almost never be altered.

- **Never modify a parser to fix a lint or vitest error.** If a lint rule flags parser code, suppress the rule with a comment. If a vitest test fails because the parser was changed, revert the parser and fix the test fixture instead.
- When a test fixture uses a headerless table (`<table>` with no `<thead>`), add proper headers to the fixture — do not relax the parser guard to accept headerless tables.
- Any parser change requires a real IS Mendelu HTML sample as evidence that the change is correct. Without it, revert.
- Column index constants in parsers are load-bearing — a one-off change silently breaks production data.

## Iron Rules

These are enforced by linting and project convention:

- **NO `localStorage`/`sessionStorage`** — use `IndexedDBService`
- **NO proxy/re-export files** — import directly from implementation files
- **NO `useEffect` for data fetching** — fetch in services/store, not components
- **NO custom CSS** — use DaisyUI semantic classes (`btn-primary`, `bg-base-200`)
- **NO generic state** — all state lives in Zustand slices
- **Max 200 lines per file** — convention, not lint-enforced; split proactively when a file grows past this
- **Direct imports only** — no middleman re-export barrels; import from the specific file
- **Test first** — write a failing test before implementation

## Tech Stack

- **Framework**: WXT (Web Extension Toolkit)
- **UI**: React 19 + Tailwind CSS 4 + DaisyUI 5
- **State**: Zustand (sliced) + Immer
- **Storage**: IndexedDB (`idb`) + Chrome Storage API
- **Testing**: Vitest + happy-dom (unit), Playwright (E2E)
- **Language**: TypeScript (strict mode)
- **Path alias**: `@/*` → `src/*`

## Key Directories

| Path | Purpose |
|------|---------|
| `src/entrypoints/` | WXT entry points (content script, main iframe app) |
| `src/components/` | Feature UI (Calendar, Exams, SubjectFileDrawer, etc.) |
| `src/store/slices/` | Zustand domain slices (schedule, exam, files, i18n, theme, sync) |
| `src/services/` | Business logic: `storage/` (IDB), `sync/` (background sync) |
| `src/api/` | Network fetch functions per domain |
| `src/injector/` | Content script DOM injection and IPC |
| `src/hooks/` | React hooks (prefer store hooks for data) |
| `src/types/` | TypeScript type definitions |
| `AGENTS.md` | Root-level project rules/constraints doc (parallel to this file) |
