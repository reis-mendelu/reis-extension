# Real-data preview, behind a login

Run the reIS app against Dominik's own scraped IS Mendelu data as a real built
app, served from his own machine — reachable from his phone and iPad over the
LAN, with other students' identities removed first. **Not hosted.** The existing
public demo preview is untouched.

Amends [`2026-09-04-preview-and-release-train-design.md`](2026-09-04-preview-and-release-train-design.md).

## Why

The demo preview shipped this morning renders synthetic data, and that dataset
fills 7 fields. A real scrape fills 13 — `subjects`, `attendance`, `files` (19
of them), `syllabuses`, `zaznamnik`, `cvicneTests`, `odevzdavarny`,
`classmates`, on top of the schedule/exams/study-plan the demo already covers.
Documents, holidays, campus events and profile render empty states on the demo
build by construction.

So the preview can show that a screen renders; it cannot show whether the screen
works. A real Czech subject name is long, a real week has awkward collisions, a
real file list has 19 entries rather than none. Those are the defects a preview
exists to catch, and the demo build cannot surface any of them.

Stated plainly by the owner: *"if it doesn't really help us to test, then we
will just slowly stop using that."* A preview nobody trusts is worse than no
preview, because it still costs a deploy on every merge.

## What this does not fix

Real data raises the ceiling; it does not remove it. Still untestable here, and
only testable in a loaded extension:

- the content script and the `postMessage` bridge (`src/injector/`)
- `chrome.storage`, the manifest, and every permission gate
- any real parse of live IS Mendelu HTML — the snapshot is already parsed
- any write. The society/admin surfaces still route to an in-memory store.

Treat this as "the UI half becomes properly testable", not "90% of everything".

## Decisions

### Not hosted at all — Vercel Hobby cannot gate a page

The original design put this on a second, login-gated Vercel project. **That is
not possible on this account's plan, and it was proven by shipping it.**

Setting protection to cover production returns:

> `Vercel Authentication is not available on your plan for production deployments`

With the only setting Hobby allows (`all_except_custom_domains`), the
per-deployment URL *is* gated (302) but the project's own alias
`<project>.vercel.app` serves the app **publicly** (200), including the data
file. Deploying as a *preview* rather than production does not help — the alias
still serves it. There is no Hobby configuration where the app is hosted and the
URL is gated.

**This was found the expensive way.** A real-data build was deployed and was
publicly reachable on that alias for roughly 90 seconds, serving
`preview-data.json`, before the project was deleted. The URL was never linked
anywhere and the sanitiser had run, so no classmate was exposed — Dominik's own
schedule, subjects and files were. The check that caught it is the one the plan
mandated: fetch the URL logged out, before trusting anything else. It should
have been run against a data-free build first, and now is.

So the app is served locally instead: `npm run preview:real` scrapes,
sanitises, builds, and runs `vite preview --host`, which prints a LAN address a
phone or iPad on the same Wi-Fi can open. That delivers what hosting was for —
real data, real devices, a real production build — at zero cost and zero
exposure.

Rejected alternatives, both viable if this stops being enough: **Vercel Pro**
(~$20/month, makes the original design work unchanged) and **Cloudflare Pages +
Cloudflare Access** (free for up to 50 users and genuinely gated, but a second
vendor to keep in step with the Vercel-hosted demo preview).

### The raw scrape can never be uploaded — enforced by filename

`public/dev-real-data.json` is the raw scrape. The web build already deletes it
from `dist-web/` unconditionally and fails if it survives
(`scripts/stripDevRealData.mjs`, plus a test asserting the plugin is still
registered).

**That strip stays unconditional. It gains no flag, no escape hatch, no
environment-dependent branch.** The sanitiser writes a *different* file —
`preview-data.json` — and only that filename is ever shipped. A conditional
strip would mean one wrong environment variable publishes a real student
record; two files with different names cannot be confused by a flag.

### Other people's data is replaced, not uploaded

`classmates` is not Dominik's data. Each entry carries a real student's `name`,
`personId`, `photoUrl` (an IS endpoint keyed by that id), `messageUrl` (which
embeds the id again) and `studyInfo`.

The sanitiser keeps the array's length and shape — so long-name wrapping,
row counts and empty-field handling are all still exercised — and replaces
`name` with a generated one, drops `personId`, `photoUrl` and `messageUrl`.
Fake names test the layout exactly as well as real ones.

**The sanitiser works from an allowlist and fails closed.** Any field it does
not recognise inside a classmate entry aborts the deploy. If IS starts
returning an email address next semester, the build stops rather than silently
uploading it. Same posture as `scripts/assert-web-build-env.mjs`, for the same
reason.

### The MENDELU password never goes near GitHub

The first draft ran the scrape in a GitHub Action with `MENDELU_USER` /
`MENDELU_PASS` as repository secrets. Rejected after looking at who that
actually exposes them to.

`reis-mendelu/reis-extension` has two people with access: `ElijaahInverted`
(admin) and `tde-biit` (write). **Write access is enough to read a secret** —
push a branch with a workflow that base64s the value into a log or an outbound
request; GitHub's log masking is a convenience, not a control. Add every
third-party action in the job, each of which runs with the job's environment,
and a compromised release of any unpinned one reads it too.

The decisive point is not the headcount but the kind of credential. Every
secret already in that repository — Chrome, Firefox, Edge, Supabase, Anthropic
— is a **scoped token**: leak it, revoke it, lose one store listing.
`MENDELU_PASS` is a university SSO login. It cannot be scoped, it opens far more
than IS, and revoking it means changing the password Dominik uses daily.

So the scrape runs where the credentials already live: `.env` on his laptop.
Nothing else in this design changes — the sanitiser, the second project, the
login gate and the public/private split are all unaffected. The only property
given up is *automatic on merge*, and since he is the only person who can open
that deployment, nobody is waiting on it being fresh without him.

If refreshing by hand turns out to be what stops the preview being used, the
next move is to ask MENDELU whether a scoped or read-only credential exists —
not to put the SSO password in a repository.

### `test` and `main` both require pull requests

Applied 2026-09-04, matching the sibling `my-ysoft` repo:

- **`test`** — PR required (0 approvals), no direct push, no force-push, no
  deletion, conversations resolved, and five required checks: UI/UX gate,
  Typecheck, Unit tests, Format, Build web preview.
- **`main`** — the same, plus CodeQL and **Release gate**.

Two deliberate departures from `my-ysoft`, both because this is a solo repo:

- **No approving review is required.** GitHub forbids self-approval, so
  requiring one would lock the only maintainer out of the repository.
- **CodeQL is required on `main` but NOT on `test`.** Verified against PR #288:
  CodeQL did not run on that PR into `test`. Requiring a check that never
  reports leaves a branch permanently unmergeable — the failure `my-ysoft`'s
  `release-gate.yml` header comment exists to document.

This also closes a hole the whole-branch review raised: `main` previously
accepted direct pushes, which bypassed the Release gate entirely.

### Rejected

- **One project with the ignored-build-step deciding the lane** — possible, but
  it makes a public-vs-private data boundary depend on a shell one-liner in a
  dashboard field nobody will read again.
- **Committing the sanitised snapshot to the repo** — the repository is public.
  Even sanitised, it is Dominik's full academic record.
- **A nightly scrape with the snapshot cached between runs** — fewer IS logins,
  but needs somewhere to keep the snapshot between deploys and can serve
  day-old data without saying so.
- **Falling back to demo data when the scrape fails** — the worst option:
  drawing conclusions from the wrong dataset while believing it is real.
- **Password protection instead of Vercel Authentication** — a Vercel Pro
  feature; Vercel Authentication is on the Hobby plan and is already proven
  working on this account.

## Architecture

```
GitHub, automatic
  any push / PR ──▶ Vercel ──▶ reis-extension-preview
                               demo data · public · shareable

Dominik's laptop, on demand
  npm run preview:real ──┬─ scrape:real   (.env credentials, Playwright)
                         ├─ sanitise      → public/preview-data.json
                         ├─ build:web:real
                         └─ vite preview --host
                                  └──▶ http://<lan-ip>:4173
                                        real data · never leaves the LAN
```

Nothing derived from the scrape reaches GitHub or any host.

The two halves share only the repository. No credential, no scraped byte and no
sanitiser output ever reaches GitHub.

## Component 1 — the sanitiser

**New: `scripts/sanitiseSnapshot.ts`**, a pure function plus a thin CLI wrapper.

```
sanitiseSnapshot(raw: unknown): { data: Snapshot; report: string[] }
```

- Throws on any unrecognised field inside a `classmates` entry, naming it.
- Replaces each classmate's `name` with a deterministic generated Czech-shaped
  name (stable across runs, so a diff of two snapshots is readable).
- Removes `personId`, `photoUrl`, `messageUrl`.
- Leaves every other top-level key untouched — they are Dominik's own data.
- Returns a `report` naming what it changed, printed in the Action's log so the
  transformation is visible rather than assumed.

Tested with vitest against a fixture built from the real snapshot's *shape*
(never its content): a known entry is renamed, the removed fields are absent,
the array length is preserved, and an unknown field throws.

**CLI:** `npm run sanitise:snapshot` reads `public/dev-real-data.json` and
writes `public/preview-data.json`.

## Component 2 — the real-data build

**New: `VITE_PREVIEW_DATA=real`** alongside the existing `VITE_PREVIEW_BUILD`.

The deployed page must load the snapshot *and* keep the protections demo mode
currently provides. Setting demo mode alone loads the demo dataset; clearing it
re-opens the CORS loop against `is.mendelu.cz` and the `track_daily_usage`
write that were fixed this morning.

So real-data mode does both:

1. `dev/earlyDemoMode.ts` still sets the demo flag before the app boots — that
   is what suppresses the IS fetch and the usage write. Demo mode here means
   "offline", not "fake".
2. `dev/bootDemoMode.ts` gains a branch: with `VITE_PREVIEW_DATA=real` it
   loads the snapshot through the existing `REIS_SYNC_UPDATE` path
   (`src/services/loadRealDataSnapshot.ts`) instead of calling `enterDemo()`,
   then runs the same `refreshDemoData()` re-read that fixes the first-load
   ordering race.

**Two blockers in that loader, both verified before writing this.** Neither is
optional and both must be fixed first, or real-data mode silently does nothing:

- `loadRealDataSnapshot()` opens with `if (!import.meta.env.DEV) return false;`
  (`src/services/loadRealDataSnapshot.ts:60`, and again at `:40` in
  `resetRealDataStores`). **`DEV` is false in a production build**, so the
  loader is dead code on the deployed page — exactly the trap
  `dev/phoneOverride.ts` had. Widen both guards the same way that one was
  widened, via `isHarnessEnabled` from `dev/harnessEnabled.ts`, so they are
  live under `VITE_PREVIEW_BUILD` too and still dead in the extension and
  Capacitor builds.
- The path is a module constant: `const SNAPSHOT_URL = '/dev-real-data.json'`
  (`:10`). The deployed build must fetch `/preview-data.json` — the sanitised
  file — and must never fetch the raw one. Take the URL as a parameter
  defaulting to the existing constant, rather than editing the constant, so
  the local `dev:web` harness keeps reading `dev-real-data.json` unchanged.

`isInIframe()` stays as it is: the deployed page is not an iframe, and the
guard still keeps this out of the injected extension app.

The app's own `DemoBanner` still shows, which is correct — this is not a real
IS session, and nothing on the page should suggest a publish would work.

**`build:web:real`** = `build:web` plus `VITE_PREVIEW_DATA=real`, and it fails
if `public/preview-data.json` is absent. The `dev-real-data.json` strip runs
unchanged.

## Component 3 — the local command

**New npm script: `preview:real`**, chaining what already exists plus the
sanitiser:

```
scrape:real  →  sanitise:snapshot  →  build:web:real  →  vite preview --host
```

- Reads `MENDELU_USER` / `MENDELU_PASS` from `.env`, exactly as `scrape:real`
  already does. Nothing new is stored anywhere.
- `vite preview` serves the **built** output with the SPA fallback, so this is
  the production bundle rather than the dev server — which is the point; the
  dev harness already showed real data, and the gap was that the built app had
  never been exercised against it.
- `--host` prints a LAN address, so the same build can be opened on a phone or
  iPad on the same Wi-Fi. That was the only thing hosting actually bought.
- **Fails loudly and serves nothing** if the scrape fails, if the sanitiser
  rejects an unknown field, or if `public/preview-data.json` is missing. No
  demo fallback: serving demo data from the command that is supposed to show
  real data is how someone draws a confident conclusion from the wrong dataset.
- Never runs in CI, and the repository holds no MENDELU credential.

**Staleness is visible.** Refreshing is manual, so the page shows the
snapshot's `lastSync` age. An unreadable, zero, null or future timestamp reads
"snapshot date unknown" rather than a fabricated day count.

## Testing

- `vitest` — the sanitiser: renames, removals, length preserved, unknown field
  throws.
- `vitest` — `bootDemoMode` picks the snapshot path under
  `VITE_PREVIEW_DATA=real` and `enterDemo()` otherwise.
- `vitest` — `loadRealDataSnapshot` runs when `VITE_PREVIEW_BUILD` is set and
  `DEV` is false (the production-build case that is currently dead), and still
  refuses inside an iframe. Without this test the widened guard can regress
  back to dead code unnoticed.
- `vitest` — the loader fetches the URL it is given, so a deployed build cannot
  be pointed at `dev-real-data.json` by accident.
- `build:web:real` fails when `public/preview-data.json` is missing.
- CI keeps its existing decoy-file assertion that `dev-real-data.json` is
  stripped; a second assertion covers the real-data build.
- The deployed page shows the snapshot's `lastSync` date.
- **Manual, once, and the acceptance test for the whole thing:** run
  `preview:real` and confirm real
  subjects, the 19 files and the study plan render; confirm no classmate is
  named; confirm `performance.getEntriesByType('resource')` shows no
  `track_daily_usage`, no `report_error_v2` and no `is.mendelu.cz`.

## Rollout order

1. Widen the two `import.meta.env.DEV` guards in `loadRealDataSnapshot.ts` and
   parameterise `SNAPSHOT_URL`, with tests. Nothing else works until this does.
2. Sanitiser + tests. Runs locally against the real snapshot; nothing deployed.
3. Real-data build mode + tests. Verified by serving `dist-web/` locally.
4. Wire `preview:real` and run it once end to end. Confirm real data renders in
   the built app, the age badge reads today, no classmate is named, and no
   Supabase write or `is.mendelu.cz` request fires.
5. Open the LAN address on a phone and confirm the same.

## Out of scope

- Automating the iOS/Android release (still by hand, still its own spec).
- Real Supabase writes from any preview.
- Anyone but Dominik reading the real-data deployment.
