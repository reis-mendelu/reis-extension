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

### What to run locally, and what CI owns

CI runs four jobs on every PR — `lint`, `typecheck` + `nuia:gate`, the full
`test:run`, and `build:web` + `check:app`. Running all of that locally as well
is duplicated work, and for some of it the local answer is the *less* reliable
one.

**Run locally, every time:**

- the tests covering what you touched — `npx vitest run <pattern>`, not `test:run`
- `npm run typecheck`

That is the evidence your change works. It takes seconds.

**Leave to CI:** repo-wide `lint` and `format:check`, the full `test:run`,
`build:web`, `check:app` and the e2e suites. They are slow here, and CI runs
them in a clean checkout, which is the only place they mean anything —
`format:check` reports differently after an Android build has touched the tree,
and the nuia ratchet fails PRs that pass locally either way. A local green on
those is not the signal; the PR's is.

**Exception:** when a change is *about* one of those gates (a lint rule, the
formatter, a build script, `check:app` itself), run that gate locally — you are
changing the thing it measures.

This machine often has a dozen sibling worktrees running at once. At load 40+,
vitest's worker handshake times out before a test file loads; `--no-file-parallelism
--maxWorkers=1` gets a run through when that happens.

### Worktrees own their node_modules

`.claude/hooks/worktree-bootstrap.sh` gives each worktree its own `node_modules`
by APFS-cloning the main checkout's (copy-on-write: instant, and near-zero disk
until the trees diverge). **So `npm ci` in a worktree is safe** — it touches
nothing but that worktree.

It used to symlink instead, and that is a trap worth remembering: sharing one
install is fine while every session only reads it, and destroys every session at
once the moment one runs `npm ci`, because that deletes and rebuilds the whole
tree. Two sessions doing it concurrently leave every worktree half-installed and
npm dying on `ENOTEMPTY`. If the hook ever reports `node_modules is SHARED`
(clonefile unavailable), believe it and do not install from the worktree.

The dev snapshot and `.env` are still symlinks, deliberately: they are read and
never rewritten, so a fresh scrape in the main checkout reaches every worktree.

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
- Every PR runs `check:app`: CI builds the app and loads it in a real browser,
  failing if it boots onto skeletons, calls IS Mendelu, writes to Supabase, or
  carries a real snapshot in the output. That check passing for the exact commit
  is what the release gate requires.
- `main` accepts only the `test` → `main` release PR, and merging it submits to
  the stores. Use `/release`.
- **Do not merge into `test` while a release PR is open.**
- **Testing against your own data is local.** `npm run preview:real` scrapes
  your IS data, strips other students' identities, builds the production bundle
  and serves it on localhost. `npm run preview:real:lan` adds `--host` for a
  phone or iPad — that exposes your academic record to **everyone on the
  network**, so use it only on a network you trust. Your MENDELU credentials
  never leave the laptop and are never in CI. Nothing is ever hosted.

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

Only these, all disclosed in `docs/privacy-policy-app.md`:

1. **Daily install count** — a random per-install UUID (`services/identity/installId.ts`),
   never anything derived from the student. Deliberately counts installs, not people.
2. **Feedback the student typed** — via the `submit_suggestion` RPC (`src/api/suggestions.ts`),
   with screen name, app version, browser and viewport.
3. **Society event view/click counters** — a post row id and nothing else.
4. **Three feature counters** (`src/api/featureUsage.ts`, September 2026) — the same random
   install UUID plus one label from a database-enforced whitelist: `map_dwell_3s`,
   `eduroam_wifi_configured`, `eduroam_profile_delivered`. Counts installs, not people.
5. **Map views per event** (same file) — a society event's row id and *no* identifier at all,
   rolled up per event per day in `event_map_views`, kept clear of the Novinky `view_count`.
   The server stamps the date; the request carries only the event id.

4 and 5 are deliberately **unjoinable**: nothing records which event a given install looked
at, because that pairing would be a behavioural profile. Keep it that way.

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
- **NO custom CSS** — use DaisyUI semantic classes (`btn-primary`, `bg-base-200`).
  The one standing exception is **Leaflet-generated DOM**: Leaflet builds its
  own tooltip and marker elements and accepts a single `className`, so its
  labels are styled by class in `src/index.css` (`.room-label`,
  `.building-label`, `.place-label`, `.walk-chip`, `.reis-hide-building-labels`).
  Tailwind utilities cannot reach that DOM without `!important` fighting
  Leaflet's own `.leaflet-tooltip` background, border and shadow — which is more
  custom CSS, not less. The rule is about app chrome, where DaisyUI applies.
- **NO generic state** — all state lives in Zustand slices
- **Max 200 lines per file** — convention, not lint-enforced; split proactively when a file grows past this
- **Direct imports only** — no middleman re-export barrels; import from the specific file
- **Test first** — write a failing test before implementation
