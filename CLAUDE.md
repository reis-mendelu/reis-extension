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

## Branches and releasing

`feature branch → test → main`. Never commit directly on `test` or `main`.

- **Base every PR on `test`**: `gh pr create --base test`. `main` is still the
  repository default branch — this is a public repo, and the default branch is
  what a visitor's Code tab, a fresh clone and every load-unpacked instruction
  resolve to, so it points at released code. The cost is that PRs open with the
  wrong base; the release gate catches it.
- A branch cut from `main` must merge `origin/test` in and retarget before
  going further, or it goes stale and conflicts at the next release.
- `test` auto-deploys to the Vercel preview. It enters the app's own demo mode
  (`enterDemo()`), which is the synthetic `demo` dataset, so **documents,
  holidays, campus events and profile render empty there** — expected, not a
  bug — and writes go to an in-memory store, so a publish that appears to work
  on the preview is not evidence a publish works.
- `main` accepts only the `test` → `main` release PR, and merging it submits to
  the stores. Use `/release`.
- **Do not merge into `test` while a release PR is open.**
- **Two previews, deliberately different.** `test` auto-deploys a **public**
  build on the synthetic demo dataset — that link is shareable. `npm run
  preview:real` scrapes your own IS data, strips other students' identities,
  builds, and serves it from **your machine** with `--host`, so a phone or iPad
  on the same Wi-Fi can open it. It is never hosted: Vercel Hobby cannot put a
  login in front of a deployed page, and a build carrying real data was briefly
  public before that was discovered. Your MENDELU credentials never leave the
  laptop and are never in CI. The real-data build shows how old its snapshot is,
  because you refresh it by hand.

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

The extension injects **one** host, `is.mendelu.cz`, over a **push-based postMessage IPC**. There are exactly two execution contexts: the **content script** (runs on the host page, has auth cookies) and the **iframe app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse. File/role tables: `src/injector/CLAUDE.md`.

A second host (WebISKAM, `webiskam.mendelu.cz`) existed until the integration was removed. If you add another host, `src/injector/CLAUDE.md` has the checklist and the isolation rules it has to satisfy — a separate store, a `<HOST>_*` message family, and its origin added to `utils/trustedOrigin.ts`.

## Error Reporting & Privacy

**reIS transmits nothing about a failure.** No error type, message, stack, file
path or session id leaves a device, on any platform. There is no error-reporting
service, no opt-out toggle (nothing to opt out of), and no Supabase table or RPC
behind it — `error_reports`, `error_groups`, `report_error` and
`report_error_v2` were all dropped in `supabase/migrations/20260904120000_drop_error_telemetry.sql`.

`logError(context, err, extra?)` (`src/utils/reportError.ts`) is still the single
funnel for non-fatal errors, and is still worth calling — it is now purely a
local `console.error` with the stack and any `extra`. Context naming convention
is unchanged: `Slice.method`, `Api.fetchX`, `Sync.stepY`, `Parser.parseX`,
`useHookName.action`.

**Do not reintroduce transmission.** `src/test/guards/noStudentDataLeaves.test.ts`
fails on `sendTelemetry`, `initTelemetry`, `report_error` or `report_error_v2`
appearing anywhere under `src/`. If the project genuinely changes its mind, the
order is: update `PRIVACY.md`, `docs/privacy-policy-app.md` and the published
policy gist first, then the guard.

**What this costs, recorded so it is not rediscovered as a surprise:** the only
early warning that IS Mendelu changed its HTML and a parser broke. That failure
is silent and hits everyone at once. Given the Parser Rules below, the
compensating control is a human opening reIS against live IS — particularly at
the start of a semester.

### What reIS still sends

Only three things, all disclosed in `docs/privacy-policy-app.md`:

1. **Daily install count** — a random per-install UUID (`services/identity/installId.ts`),
   never anything derived from the student. Deliberately counts installs, not people.
2. **Feedback the student typed** — via the `submit_suggestion` RPC (`src/api/suggestions.ts`),
   with screen name, app version, browser and viewport.
3. **Society event view/click counters** — a post row id and nothing else.

`SUPABASE_CALLERS` in the guard test is the authoritative list of files allowed
to talk to Supabase at all; adding one requires a written justification there.

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
