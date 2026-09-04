# Real-data preview, behind a login

Add a second Vercel project that serves the reIS app against Dominik's own
scraped IS Mendelu data, readable only by him, deployed by a GitHub Action that
scrapes on every merge into `test`. The existing public demo preview is
untouched.

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

### Two Vercel projects, not one

| | `reis-extension-preview` (exists) | `reis-extension-real` (new) |
|---|---|---|
| Data | synthetic `demo` dataset | Dominik's sanitised snapshot |
| Audience | anyone with the link | Dominik only (Vercel Authentication) |
| Deployed by | Vercel git integration, every branch | GitHub Action, `test` only |
| Secrets | none | `MENDELU_USER`, `MENDELU_PASS`, `VERCEL_TOKEN` |

One project cannot serve both: production would have to be simultaneously
public (to share a branch) and gated (to hold real data), and Vercel's git
build would race the Action's deploy for the same production slot, last write
winning — sometimes with the mock build.

Splitting also means **the existing project is not modified at all**, so this
work cannot break what already ships.

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
push to `test`
      │
      ├──▶ Vercel git build ──▶ reis-extension-preview   (demo data, public)
      │
      └──▶ GitHub Action ──┬─ scrape:real   (MENDELU_* secrets, Playwright)
                           ├─ sanitise      → preview-data.json
                           ├─ build:web:real
                           └─ vercel deploy --prebuilt --prod
                                    └──▶ reis-extension-real  (login-gated)

pull request  ──▶ Vercel git build ──▶ reis-extension-preview  (demo, public)
                  (Action does NOT run — secrets stay off PRs)
```

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

## Component 3 — the Action

**New: `.github/workflows/deploy-real-preview.yml`**

- **Triggers:** `push` to `test`, and `workflow_dispatch`. **Never
  `pull_request` or `pull_request_target`** — that pairing is how a public
  repository's secrets reach a fork.
- **Permissions:** `contents: read` only.
- **Concurrency:** one at a time, `cancel-in-progress: true` — a superseded
  scrape has no value.
- **Steps:** checkout → `npm ci` → `npx playwright install --with-deps chromium`
  → `npm run scrape:real` → `npm run sanitise:snapshot` →
  `npm run build:web:real` → `npx vercel deploy --prebuilt --prod`.
- **Secrets:** `MENDELU_USER`, `MENDELU_PASS`, `VERCEL_TOKEN`,
  `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_REAL`.
- **Never uploads an artifact and never commits.** The snapshot exists only in
  the runner's filesystem, for the length of the job.
- **Fails loudly.** A failed scrape or a failed sanitise fails the job; the
  previous real-data deployment keeps serving. There is no demo fallback.

## Component 4 — the Vercel project

`reis-extension-real`, created via the API like the first one:

- **No git integration** — it is deployed only by the Action, so a push cannot
  race it.
- `ssoProtection: { deploymentType: "all_except_custom_domains" }` — Vercel
  Authentication, so only the account owner can open any of its URLs. Verified
  working on this account earlier today.
- Environment: `VITE_DEV_SOCIETY=reis`, `VITE_PREVIEW_BUILD=true`,
  `VITE_PREVIEW_DATA=real`. The `VITE_VERCEL_` prefix stays allowlisted; the
  platform injects it regardless.
- `autoExposeSystemEnvs: false`, matching the first project.

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
- **Manual, once, and the acceptance test for the whole thing:** open the gated
  URL logged out and confirm it refuses; open it logged in and confirm real
  subjects, the 19 files and the study plan render; confirm no classmate is
  named; confirm `performance.getEntriesByType('resource')` shows no
  `track_daily_usage`, no `report_error_v2` and no `is.mendelu.cz`.

## Rollout order

1. Widen the two `import.meta.env.DEV` guards in `loadRealDataSnapshot.ts` and
   parameterise `SNAPSHOT_URL`, with tests. Nothing else works until this does.
2. Sanitiser + tests. Runs locally against the real snapshot; nothing deployed.
3. Real-data build mode + tests. Verified by serving `dist-web/` locally.
4. Create the Vercel project, SSO on, deploy once by hand from a laptop to
   prove the gate and the data.
5. Add the Action and the secrets; merge to `test`; watch the first real run.

Steps 1–3 are useful alone: they give a local real-data build with other
people's identities removed, which is worth having whether or not it is ever
deployed.

## Out of scope

- Automating the iOS/Android release (still by hand, still its own spec).
- Real Supabase writes from any preview.
- Anyone but Dominik reading the real-data deployment.
