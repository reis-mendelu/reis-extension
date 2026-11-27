# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

reIS (REIS.mendelu) simplifies the MENDELU university Information System (IS
Mendelu) for students. It ships as **three UI products from one codebase**: a
Chrome/Firefox/Edge **browser extension** (WXT, injects an iframe containing the
React app into IS Mendelu pages), an **iOS app** and an **Android app** (both
Capacitor, same React app). A fourth, headless one, **reIS for Claude** (`mcp/`),
is described below. All processing is client-side: academic records stay on
the device and are never intercepted, sent to or stored by reIS anywhere else;
the only things derived from the student that reach Supabase are the faculty
and base programme labels on the daily count (see "What reIS still sends").
The one recipient beyond IS is Claude
(Anthropic) in reIS for Claude: the IS data a student asks about goes into
their own Claude chat, by their choice; it never passes through reIS.

Read the next section before editing any UI. Three products do **not** mean
three UI trees, and the difference is where features get forgotten.

## Products and UI trees

**Three products, two UI trees, one shared core.** The fork is `src/App.tsx`:

```ts
if (adminConsoleOpen) return <AdminConsole />;
if (isPhone) return <MobileApp />;   // ← the fork
```

| Bucket | Where | Who renders it |
| --- | --- | --- |
| **phone/iPad tree** | `src/components/mobile/`, `src/mobile/` | iOS + Android apps |
| **desktop tree** | `Sidebar` + `AppMain` + `AppOverlays` | the browser extension |
| **shared by both** | `src/api/`, `src/store/slices/`, `src/services/`, `src/utils/`, `src/i18n/`, `src/types/`, and much of `src/components/` | everything |
| **host seam** | `src/platform/types.ts` — only `storage`, `secureStorage`, `getAssetUrl` | one impl per host |

**The iPad runs the PHONE tree, not the desktop one.** `resolvePhoneViewport`
returns true on `isNativeApp` before any width test, so "the iPad version"
always means `src/components/mobile/`. An iPad is 834pt wide and would
otherwise get the desktop layout, which is never exercised on a device.
`useWideViewport` is the only tablet-vs-phone branch **in JS** — but the layout
also branches in CSS, through the `md:`/`lg:` utilities in the mobile tree.
So implementing on the phone tree gives you the iPad, but **verify the
tablet width too** (the `verify-ui` skill).

### The rule

**A user-facing capability belongs on both trees unless there is a stated
reason it does not.** Shipping it on one is the default failure mode of this
repo, and the student on the other platform simply does not have the feature.

Before you finish a UI task, answer all three:

1. Does the **extension** (desktop tree) have it?
2. Does the **phone** (mobile tree) have it?
3. Does it hold up at **tablet width** as well as phone width?

If the answer to one of them is a deliberate no, **pin it with its reason** in
`src/test/guards/` — follow `desktopHasNoShowOnMap.test.ts`, which records both
halves of one such decision. A divergence that exists only in someone's memory
comes back the next time a component is reused.

The `Stop` hook `.claude/hooks/tree-parity.mjs` is the backstop: it computes
each tree's import closure and refuses to let a turn end when it changed files
exclusive to one tree and none exclusive to the other. A guard that **names** a
file clears that file, which is why `desktopHasNoShowOnMap.test.ts` lists paths.
It asks once per distinct set of files, so "this is not a user-facing
capability" is a valid answer that ends the turn.

### Two traps

1. **Shared files that branch internally.** `useEduroamSetup` gating on
   `canConfigureEduroamNatively` is one edit in shared code that lands on one
   platform only. Path-based reasoning misses these — and the reverse, too:
   `src/components/CampusMap/` looks desktop-shaped but the phone's `MapScreen`
   imports it, so a change there is already on both.
2. **A mobile-only feature reaching shared code** drags its dependencies into
   the extension's content script. That is how the sonner/`document_start`
   crash in PR #266 happened. `src/api/` and `src/utils/parsers/` are shared, so
   a "scraper" edit hits BOTH products.

### A fourth product, headless: reIS for Claude (`mcp/`)

A Claude Desktop extension (`.mcpb`) that signs in to IS as the student on
their laptop and exposes eleven read-only tools over the same `src/api` fetchers (seventeen in all with
the six below: `mendelu_overview`, `mendelu_search`, `mendelu_ledger`, `mendelu_build_my_map`,
`mendelu_refresh` and `mendelu_forget_everything`, which deletes its own local folder and nothing else; `scripts/mcp-smoke.mjs`
asserts the count).
It has no UI tree, so the parity rule does not apply to it. It is also the only
reIS code that handles a password: it comes from the keychain and is sent only
to the IS login endpoint, at sign-in and at each automatic re-login. Its standing promises are pinned in
`src/test/guards/mcpStaysReadOnly.test.ts`. It keeps a **map on disk**, on by
default and local only: one folder per laptop (`~/Library/Application Support/reIS for
Claude`, `%LOCALAPPDATA%\reIS for Claude`, `$XDG_DATA_HOME` or `~/.local/share`), written
only through `mcp/store*.ts`, never holding the password or the session cookie. Step 2 of 7
is in: subjects, folder listings, the full text of files read and the study programme are
saved, a file's text is served again after a restart while its listing's Modifikace date is unchanged and the text was read on a later day than that date (IS gives no time of day, so a same-day edit cannot be told apart)
(`mcp/cache.ts` second tier, `mcp/storeMap.ts`), and `mendelu_forget_everything` deletes it.
Step 4 (`mendelu_search`, `mcp/search*.ts`: keyword search over the saved text and the listings, reading the store only) is in. In the plugin build it covers text-native files and file names only: no PDF text extractor fits the plugin's single 5 MiB bundle file (measured; a two-file pdfjs layout would fit but flips the plugin's hand-over design, so it is parked as Dominik's decision: see the design record). The overview (step 3) is in. Step 4b is in: **`mendelu_ledger`**, the upcoming-events ledger (decision 9; `mcp/ledger*.ts`, `mcp/storeLedger.ts`, one `ledger/<id>.json` per event, never evicted by the size budget). Claude writes it (reIS extracts nothing, it has no model), the overview's "upcoming" merges it with IS's own exam terms and deadlines, a replaced source file marks its entries "recheck", and forget removes it; it asks IS nothing and reIS never writes a calendar. Step 5 is in review: the **original files** (`mcp/storeOriginals.ts`: `originals/<hash of the link>/<IS name made safe>` plus a record of the listing date it was read at, same staleness rule as the text, `mcp/storeStamp.ts`), kept once by every `mendelu_read_file` download and all at once by **`mendelu_build_my_map`** (`mcp/build*.ts`: a dry run of counts and types first, size UNKNOWN since IS lists none; then GET-only downloads in a small pool, resumable, stopping at the byte budget and reporting skips and failures). The budget evicts originals first, the overview gives each kept original a `localPath`, the plugin build hands a kept original back by path (never inlined), and forget removes them. Step 6 is in review: **`mendelu_refresh`** (`mcp/refresh*.ts`), the one call of the student's scheduled digest: the overview's look and diff (`mcp/overviewLook.ts`) against its own record (`refresh/seen.json`), then the new or replaced files of subjects already known downloaded through build's download path (`mcp/buildDownload.ts`), within the budget; a first refresh borrows the overview's record, or only records a baseline when there is none. The digest routine is one prompt, `mcp/routine/digest-prompt.md` (the plugin build turns it into the `daily-digest` skill; `refreshDigest.test.ts` pins its rules): a mail DRAFT written by the student's own Claude, events a week ahead, a 14-day weekly look, calendar entries only proposed until the student says yes. reIS itself never sends mail or writes a calendar (guarded). The smoke never runs refresh live: it would consume the next digest's changes. Design, steps and the
promises it changed: `docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md`. The
directory listing's data-handling answer still says "not retained" until Dominik resubmits it.

A `src/api` change reaches it too. `npx vitest run mcp/` covers the tool
shaping; `npm run mcp:smoke` only proves the server starts and lists its tools.
To exercise a changed fetcher against real IS, name its tool:
`npm run mcp:smoke -- --live mendelu_grades` (it always adds `mendelu_exams`).

Build with `npm run mcp:pack`. It ships with the app: the release run's `mcp`
job publishes it to `reis-mendelu/reis-for-claude` (release `mcp-vX.Y.Z` with
the `.mcpb`, plus the plugin on that repo's `main`) whenever what it ships
changed, with the app's version. Never bump `mcp/manifest.json` (it stays
0.0.0) and never tag `mcp-v*` by hand; see `docs/release-pipeline.md`. The
`.mcpb` asks that repo once per start whether it is outdated
(`mcp/updateCheck.ts`); the plugin updates itself in Claude Code.
`npm run mcp:plugin` builds the same server as a Claude Code plugin for Claude's
directory: `mendelu_read_file` hands the file over whole instead of extracting its text
(`mcp/documentHandover.ts` replaces `documentText.ts`), so officeparser stays out and
every plugin file stays under the directory's 5 MiB limit. Claude Code drops a server whose
message passes 16 MiB, hence the 10 MB cap on handed-over files.

**Plain `node` is not where it runs.** Claude Desktop starts it inside its own
"MCP Node Host" (`nodeHost.js` in Claude.app) in an Electron utility process,
where `process.type` is `'utility'` and Node-sniffing libraries take their
browser path. To debug it there, not by reading logs:
`node scripts/mcp-smoke.mjs --desktop-host [--live tool…]` runs the built
server through that real host code (macOS, Claude installed). When an installed
extension dies, its own log shows only a closed transport; the cause is in
`~/Library/Logs/Claude/main.log` as `[UtilityProcess stderr] [nodeHost] …`.
Never launch `Claude.app/Contents/MacOS/Claude` to run a script: it starts a
second Desktop instance on the same profile.

## Multi-Repo Organization

Four repos sit side by side, next to the **main checkout**: **reis-extension** (this repo), **reis-scraper**, **reis-data**, **reis-page**. The admin console is not a sibling repo; it lives here, in `src/components/AdminConsole/`. `../` in this file and in `/repos` means relative to the main checkout. From a worktree, `../` is inside `.claude/worktrees/`, so resolve a sibling as `"$(git rev-parse --path-format=absolute --git-common-dir)/../../reis-scraper"`.

**Subject difficulty pipeline:** `reis-scraper` crawls IS Mendelu → exports JSON → committed to `reis-data` → served via jsDelivr CDN → extension fetches at runtime (`src/api/successRate.ts`, `src/api/erasmus.ts`).

**Supabase** is separate — the extension uses it directly for notifications. Not related to scraper or reis-data.

When a task involves IS Mendelu data, a new scraper, or the CDN data shape: read `../reis-scraper/scripts/` for patterns and `../reis-scraper/db/schema.sql` for the data model before designing anything. Use `/repos` for full detail.

## Local dev, release, and commands

- Local dev against real IS data (`npm run dev:web` at `localhost:3000`) → the `dev-real-data` skill.
- Releasing (version bump + `release-notes/X.Y.Z.cs.txt` → `test` → `main`) →
  `/release`. Merging the release PR pushes `vX.Y.Z` and, **in the same run**,
  takes it to all three stores: the App Store (upload and submit for review),
  Google Play production, and Chrome + Firefox (Edge is not a
  target). One summary table says what reached each. It has to be one run: a tag
  pushed with `GITHUB_TOKEN` starts no other workflow. Secrets, the dry run and
  what it does not do: `docs/release-pipeline.md`.
- Everything else is in `package.json` scripts.
- Verifying a UI change (screenshots at 320/390/430 + overflow, collision and contrast assertions) → the `verify-ui` skill. Never judge a UI change from a screenshot alone.

### What to run locally, and what CI owns

**Before every push: `npm run check`.** One command, about a minute. It makes
`node_modules` match the lockfile, then runs `typecheck`, the nuia ratchet,
eslint and prettier on the files the branch changed, and the tests related to
them plus every guard test. The **last line is the verdict** (`check: PASS …` /
`check: FAIL …`) and the exit code agrees with it. It exists because 35 of the 82
red CI runs in ten weeks were the nuia ratchet or typecheck: seconds to catch
here, a seven-minute round in CI.

While iterating, `npx vitest run <pattern>` on what you touched is the fast
loop. It is not a substitute: a pattern run skips the guards and the ratchet.

**Leave to CI:** the full `test:run`, repo-wide `lint` and `format:check`,
`build:web`, `check:app` and the e2e suites. They are slow here, and CI runs
them in a clean checkout, which is the only place they mean anything. A local
green on those is not the signal; the PR's is.

**Exception:** when a change is *about* one of those gates (a lint rule, the
formatter, a build script, `check:app` itself), run that gate locally — you are
changing the thing it measures.

This machine often has a dozen sibling worktrees running at once, which is why
`npm run check` caps vitest at three workers. At load 40+, vitest's worker
handshake still times out before a test file loads; that is the machine, not
your change.

### Worktrees and the main checkout

`.claude/hooks/worktree-bootstrap.sh` (SessionStart) does three things, and
`scripts/__tests__/worktreeBootstrap.test.ts` pins each:

- **The branch starts from `test`.** A session worktree is cut from `main`. A
  branch with no commits of its own, not pushed, with a clean tree is moved to
  `origin/test`. The same check runs again at the first prompt
  (`UserPromptSubmit`, `--first-prompt`: no fetch, once per branch), which
  catches a branch the app checks out after SessionStart ran.
  To read released code, check out detached: `git checkout --detach origin/main`.
- **`node_modules` matches the lockfile.** `scripts/ensure-install.mjs` leaves a
  matching install alone and otherwise copies a matching one from another
  checkout (an APFS copy-on-write clone: ~20 s, near-zero disk). It never copies
  a stale install. When nothing matches, the hook says so and `npm run check`
  runs `npm ci`. The install belongs to the worktree, so `npm ci` there touches
  nothing else. Do not judge an install by `test -L node_modules` or by the
  directory existing: an old tree passes both. `node scripts/ensure-install.mjs`
  is the check.
- **The main checkout follows `test`.** Claude reads this repo's skills, slash
  commands and hooks from the main checkout, whatever worktree a session is in.
  While it is *parked* (detached HEAD, no edits to tracked files) the hook moves
  it to `origin/test`. On a branch it is left alone and the hook reports how far
  behind it is; park it with `git checkout --detach origin/test`. Do not work
  in it.

The dev snapshot and `.env` are still symlinks, deliberately: they are read and
never rewritten, so a fresh scrape in the main checkout reaches every worktree.

**A project hook runs from the main checkout, not the session's worktree.**
Claude desktop starts sessions with `--project-config-root <main checkout>`, so
every hook in `.claude/settings.json` gets the main checkout as its cwd *and* as
`$CLAUDE_PROJECT_DIR`. Only the `cwd` field of the hook's JSON input names the
session's checkout. A hook that asks git or `pwd` instead inspects the main
checkout and quietly does nothing: until November 2026 the bootstrap returned
silently in every worktree session, which left branches on `main`.

### Secrets

Local secrets live in `.env` (gitignored; `.env.example` is the template), and
every consumer reads it itself: `dev/adminSessionPlugin.ts` and
`scripts/scrape-real-data.ts` via `dotenv/config`, `scripts/release-ios.ts`
explicitly, and the Vite builds through `envDir` for `VITE_*`. There is no
secrets wrapper, so run the npm script directly.

Testing the admin console against real Supabase needs exactly two keys in
`.env`: `REIS_ADMIN_EMAIL` and `REIS_ADMIN_PASSWORD` (`dev/adminSessionPlugin.ts`).
Despite its name, `REIS_ADMIN_EMAIL` holds the console **login** (`reis`), not an
email; the harness maps it to the auth address the way the console does.
The Supabase URL and publishable key are **not** env vars — they are hardcoded in
`src/services/supabase/config.ts`. Signing in as one society instead reads
`REIS_SOCIETY_<ID>_EMAIL` / `_PASSWORD`, uppercased. Missing credentials leave the
harness on its login screen signed in as nobody — check that before concluding
the console itself is broken:

```bash
npm run dev:web:admin              # signs in as reis_admin; picker covers every society
REIS_ADMIN_SOCIETY=esn npm run dev:web:admin   # sign in as one association instead
```

Plain `npm run dev:web` is unaffected: it keeps `VITE_DEV_SOCIETY=reis`, which
fakes a session **and routes every write to an in-memory store** — publishes
there never reach Supabase, so never cite them as evidence a write works.
`dev:web:admin` clears that flag.

### Database migrations

A release applies `supabase/migrations/` to prod itself, before the stores, so
nobody applies one by hand. A migration is a new file on top, **additive only**
(old builds run against the new schema for weeks), with no `begin;`/`commit;`.
Details: `docs/database-migrations.md`.

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
- Three more gates fail PRs that pass a casual local run: `lint --max-warnings=0`
  and `format:check` are **repo-wide**, not changed-files, and `nuia:gate` is a
  ratchet — a new `noUncheckedIndexedAccess` error fails even if the count drops.
- `main` accepts only the `test` → `main` release PR. Merging it pushes the
  `vX.Y.Z` tag, **applies pending migrations to prod** and **submits to all three stores** (`ship.yml`). A submission
  cannot be recalled, so the release PR (diff, notes, CI, privacy block) is the
  last gate. Use `/release`.
- **Do not merge into `test` while a release PR is open.**
- **Testing against your own data is local.** `npm run preview:real` scrapes
  your IS data, strips other students' identities, builds the production bundle
  and serves it on localhost. `npm run preview:real:lan` adds `--host` for a
  phone or iPad — that exposes your academic record to **everyone on the
  network**, so use it only on a network you trust. Your MENDELU credentials
  never leave the laptop and are never in CI. Nothing is ever hosted.

## Architecture

The manifest is generated from `wxt.config.ts` — never hand-edited.

### Hosts (3) — the platform seam

The same app ships as a browser extension, a Capacitor iOS/Android app, and the
dev webapp. `src/platform/types.ts` is the **only** seam; each entry tree installs
its host before the React root renders:

| Host | Entry | Installs the platform |
|------|-------|----------------------|
| Extension | `src/entrypoints/{content,background,main}` | implicitly — see below |
| Capacitor | `capacitor/main.capacitor.tsx` | `capacitor/installCapacitorPlatform.ts` |
| Dev webapp | `dev/main.web.tsx` | `dev/installWebPlatform.ts` |

`getPlatform()` returns the installed platform. If none is installed, it **falls
back to the extension** when `chrome.runtime.id` is visible and **throws**
otherwise — a deliberate asymmetry documented in `src/platform/index.ts`. Native-only code is `src/mobile/`; `native/` holds three
custom Capacitor plugins; `android/` and `ios/` are the shells.

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

**This section describes the browser extension only.** The iOS and Android
apps have no content script and no iframe — they authenticate through
`src/platform/` (`capacitorPlatform.ts`, `tokenStore.ts`) and call IS Mendelu
directly. Nothing below applies to them.

In the extension, reIS injects **one** host, `is.mendelu.cz`, over a
**push-based postMessage IPC**. There are exactly two execution contexts: the
**content script** (runs on the host page, has auth cookies) and the **iframe
app** (chrome-extension:// origin, no auth cookies). Data always flows content script → iframe, never the reverse. File/role tables: `src/injector/CLAUDE.md`.

If you add a second host, `src/injector/CLAUDE.md` has the checklist and the isolation rules it has to satisfy — a separate store, a `<HOST>_*` message family, and its origin added to `utils/trustedOrigin.ts`.

## Privacy disclosures

`privacy/disclosures.ts` is the one source of what reIS sends and how every store
declares it (Apple label, Play Data safety, Chrome Web Store, Firefox manifest,
iOS/Android permissions, the policy table). `scripts/lib/__tests__/privacyDisclosures.test.ts`
fails any PR where the code disagrees with it; the release PR's privacy block is
generated from its diff and gates the merge. **Change a data flow → change that
file in the same PR** (the `disclosure-drift` Stop hook asks if you forget), then
`npm run privacy:generate` for the policy table. At release, Claude runs
`npm run privacy:publish` and does the store forms itself — see `/release`.

## Count what you ship

**When you add something a student can open or click, ask whether anyone will
later need to know how many did.** A number nobody counted at launch cannot be
recovered (the Stáže card for EY shipped in #651 with no counter). Ask it
especially for anything a **partner** is shown or linked to: that count is what
reIS hands the partner. The mechanism is the existing install-level feature
counter, one label per partner programme; the steps, the migration and the
disclosure are in `docs/feature-counters.md`. If a new feature needs no
counter, say so in the PR in one line.

## Who sees it is data

**Showing something to some students only (a faculty, a programme) is a row in
Supabase, never a list in code**, so the admin console can retarget or remove
it without a store release. The audience is tokens (`af`, `pef:B-OI`,
`mendelu`), decided on the device by `matchesAudience(tokens, useViewer())`.

- A link under Předměty (mendelu.app, a programme's Discord) is a `study_aids`
  row (audience, on/off) plus an entry in `src/data/studyAids.ts` (URL, label,
  counter, icon). Every matching link is shown, on both trees.
  `src/test/guards/studyAidsRegistry.test.ts` names what a new entry still
  needs: seed row, counter label, allowed host, disclosure, both languages.
- A partner's audience is `societies.audience`.
- `src/test/guards/noProgrammeListsInCode.test.ts` fails on a quoted programme
  code in source. Reach for one of the above instead of widening its allow-list.

## Error Reporting & Privacy

**reIS transmits nothing about a failure on its own.** No error type, message,
stack, file path or session id leaves a device unless the student attaches it to
a report (item 6 below). There is no error-reporting service, no background
collection, and no Supabase table or RPC behind one — `error_reports`, `error_groups`, `report_error` and
`report_error_v2` were all dropped in `supabase/migrations_archive/20260904120000_drop_error_telemetry.sql`.

`logError(context, err, extra?)` (`src/utils/reportError.ts`) is the single
funnel for non-fatal errors. It writes a local `console.error` with the stack and
any `extra`, and keeps a cleaned copy (context, status, first line of the
message — never the stack or `extra`) in the in-memory ring buffer
`src/utils/diagnostics/diagnosticLog.ts`. That file **imports nothing**: it is in
the content script's graph (`contentScriptGraph.test.ts` enforces it). Context naming: `Slice.method`, `Api.fetchX`, `Sync.stepY`,
`Parser.parseX`, `useHookName.action`.

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
   plus school, faculty, base programme code, platform and app version as labels; nothing else derived
   from the student. Deliberately counts installs, not people. The UUID is stable, so daily rows link
   across days, and the same UUID is on the survey and the feature counters (4), so those rows
   join per install to school, faculty, platform, programme and app version. The policy says so; none of it carries
   a name, student number or IS account. The school (`mendelu`/`vse`/`czu`, November 2026) is a
   column with default `'mendelu'`, so released builds' v1 calls land as MENDELU;
   `track_daily_usage_v2` takes it explicitly and stores faculty and programme for MENDELU only.
   Every admin/stats function counts `school = 'mendelu'` only.
2. **Feedback the student typed** — via the `submit_suggestion` RPC (`src/api/suggestions.ts`),
   with screen name, app version, browser, viewport and the school (`submit_suggestion_v4`).
3. **Society event view/click counters** — a post row id and nothing else. Views are
   counted once per device (`viewedIds`); clicks too, since PR #566: the device remembers
   in IndexedDB which ids it already counted (`services/spolky/countedOpens.ts`) and
   nothing about that is sent.
4. **Feature counters** (`src/api/featureUsage.ts`) — the same random install UUID, the
   school (`track_feature_usage_v2`) and one label from `FEATURE_SIGNALS`, a database-enforced whitelist pinned by
   `featureSignalWhitelist.test.ts`. Counts installs, not people.
5. **Map views per event** (same file) — a society event's row id and *no* identifier at all,
   rolled up per event per day in `event_map_views`, kept clear of the Novinky `view_count`.
   Also once per device per event ever (same `countedOpens.ts`), so it reads as devices, not taps.
   The server stamps the date; the request carries only the event id.

6. **Report attachments** (`submit_suggestion_v4`, November 2026; v2/v3 for older builds) — only what the student
   adds to a report: a screenshot they pick (re-encoded to JPEG on device, no EXIF/GPS) and,
   only if they choose it, the cleaned diagnostic log (collected at Send, not listed in the
   form — the cleaning is what makes it safe to send unread). On a Chyba the choice is two
   Send buttons, "Odeslat s technickými údaji" first; on a Nápad or Jiné an unticked box.
   Never preselect it: a pre-ticked box is not consent (CJEU Planet49), and the policy's
   legal basis for attachments is consent. No install id. Kept 2 years (the daily pg_cron prune; the `done` trigger and the 90-day limit were removed in October 2026, and GDPR's storage limitation is why there is still an end); deleted sooner on request. Every report also carries the platform and OS version it was sent from (no device model).
   The guard allows diagnostics to reach Supabase through `src/api/suggestions.ts` only, and
   no Supabase caller may import `utils/diagnostics/`.

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
  `.building-label`, `.place-label`, `.room-route-chip`, `.room-route-chip-pill`,
  `.reis-hide-building-labels`, `.reis-hide-room-labels`).
  Tailwind utilities cannot reach that DOM without `!important` fighting
  Leaflet's own `.leaflet-tooltip` background, border and shadow — which is more
  custom CSS, not less. The rule is about app chrome, where DaisyUI applies.
- **NO generic state** — all state lives in Zustand slices
- **Max 200 lines per file** — convention, not lint-enforced; split proactively when a file grows past this
- **Direct imports only** — no middleman re-export barrels; import from the specific file
- **Test first** — write a failing test before implementation
