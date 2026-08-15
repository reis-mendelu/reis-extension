# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

reIS (REIS.mendelu) is a Chrome browser extension that simplifies the MENDELU university Information System (IS Mendelu) for students. Built with WXT, it injects an iframe containing a React app into IS Mendelu pages. All processing is client-side — no student data is intercepted or stored externally.

## Multi-Repo Organization

Five repos live as siblings under `../`: **reis-extension** (this repo), **reis-scraper**, **reis-data**, **reis-admin**, **reis-page**.

**Subject difficulty pipeline:** `reis-scraper` crawls IS Mendelu → exports JSON → committed to `reis-data` → served via jsDelivr CDN → extension fetches at runtime (`src/api/successRate.ts`, `src/api/erasmus.ts`).

**Supabase** is separate — the extension uses it directly for notifications. Not related to scraper or reis-data.

When a task involves IS Mendelu data, a new scraper, or the CDN data shape: read `../reis-scraper/scripts/` for patterns and `../reis-scraper/db/schema.sql` for the data model before designing anything. Scraper tasks run via a dedicated sub-agent. Use `/repos` for full detail.

## Local dev, release, and commands

- Local dev against real IS data (`npm run dev:web` at `localhost:3000`) → the `dev-real-data` skill.
- Releasing (version bump → tag → CI publishes to all three stores) → `/release`.
- Everything else is in `package.json` scripts.
- Verifying a UI change (screenshots at 320/390/430 + overflow, collision and contrast assertions) → the `verify-ui` skill. Never judge a UI change from a screenshot alone.

### Secrets (Infisical)

Local secrets live in Infisical, not in the repo. `scripts/with-secrets.mjs`
wraps the scripts that need them, so **just run the npm script** — no
`infisical run --` prefix. It prints which source it used and falls back to
`.env` / the ambient environment when the CLI is missing or the login has
expired. One-time machine setup is `infisical login` (`.infisical.json` is
committed, so `infisical init` is not needed per worktree).

Testing the admin console against real Supabase:

```bash
npm run dev:web:admin              # signs in as reis_admin; picker covers every society
REIS_ADMIN_SOCIETY=esn npm run dev:web:admin   # sign in as one association instead
```

Plain `npm run dev:web` is unaffected: it keeps `VITE_DEV_SOCIETY=reis`, which
fakes a session **and routes every write to an in-memory store** — publishes
there never reach Supabase, so never cite them as evidence a write works.
`dev:web:admin` clears that flag.

## Architecture

The manifest is generated from `wxt.config.ts` — never hand-edited.

### State & Storage (3-Tier)
1. **Zustand** (in-memory, reactive) — all UI reads go through `useAppStore` synchronously
2. **IndexedDB** via `IndexedDBService` — persistent heavy data, survives reloads
3. **Chrome Sync** — small user settings that follow across devices

Store uses the **slice pattern**: `src/store/slices/create*Slice.ts` composed into `useAppStore.ts`.

### Data Flow
- Components read from store synchronously; background sync (`src/services/sync/`) is the only authorized writer to persistent state

### Dual-Language (CZ/EN)
- Language-sensitive data stored as `{ cz: Data, en: Data }`
- Sync services fetch both languages in parallel for instant switching
- The app's language code is `'cz'`/`'en'` everywhere — `Language` in `src/store/types.ts` is
  `'cz' | 'en'`, and that is the same vocabulary IS Mendelu's `lang=` takes, so store values pass
  to the API layer unmapped. Do **not** add a `cs`→`cz` mapping at a store call site.
- `'cs'` is a **BCP-47 locale**, not an app language code. It appears only where a value is handed
  to `Intl` / `toLocaleDateString` or names a locale file, and those sites convert at the boundary
  (`language === 'cz' ? 'cs' : language`).
- UI strings via `useTranslation()` hook reading from `src/i18n/locales/{cs,en}.json` — the
  filenames are locales, which is why they read `cs` while the language code is `cz`

## Host Integration Contract

The extension uses a **push-based postMessage IPC** for each injected host. There are exactly two execution contexts: the **content script** (runs on the host page, has auth cookies) and the **iframe app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse. Per-host file/role tables and ISKAM behaviors: `src/injector/CLAUDE.md`.

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

## Google Drive Backup

One-way mirror of the student's current-semester IS files into their own Google Drive. Details: `src/services/drive/CLAUDE.md`.

- **Never escalate the OAuth scope** past `drive.file` — not to `drive`, `drive.readonly`, or `documents`.
- **Never build bidirectional sync.** Phase 2 (notes) is strictly one-way, drawer-as-source.
- **Never dedupe backed-up files by filename** — IS legitimately serves many files with the same display name; only the `appProperties.reisLink` hash is unique.

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
