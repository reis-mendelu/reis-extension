# Preview deployment and release train

Adopt a `test` → `main` release train for reis-extension, deploy the app as a
static preview site so screens can be reviewed on a URL before they ship, and
make the release PR — not a hand-typed tag — the thing that submits to the
browser stores.

## Why

Two problems, one shape.

**Every release is its own store review cycle.** Today `/release` bumps the
version on `main`, pushes a `vX.Y.Z` tag, and `publish.yml` submits to Chrome,
Firefox and Edge. Chrome takes 1–3 days, AMO can take weeks. Each tag spends
that budget again, so shipping three small fixes in a week costs three review
cycles and the third one is queued behind the first two. Batching a period of
merges into one submission is worth real calendar time.

**There is nowhere to look at unshipped work.** Reviewing a change means
checking out the branch and running `npm run dev:web` locally. Nobody else on
the project can see a screen before it reaches the store.

A release train fixes the first. A deployed preview fixes the second, and it is
what makes the train safe: the release gate can require that the commit being
released was actually deployed and looked at.

## Decisions

**Preview only — never a staging environment.** The deployed site renders
synthetic data and writes nowhere. It is not a place where real Supabase writes
land.

**No database.** Nothing in the extension speaks to a Postgres. Server state is
Supabase (notifications, suggestions, `error_reports` / `error_groups`, admin);
bulk data is static JSON from `reis-data` via jsDelivr. A database in this
design would have no client.

**Vercel, not Railway.** The workload is a static SPA with no server, no
database and no secrets. Railway would need a Dockerfile, a Caddyfile, a
`railway.toml` and a healthcheck purely to serve static files, cost $5/mo, and
need hand-booked slots for per-branch previews. Vercel needs a build command and
an output directory, is free on Hobby for a static site, gives every PR its own
preview URL automatically, and is already in the reIS estate (`reis-page`; the
retired `receiver` left `.vercel` in `.gitignore:133`).

The MySoft pipeline (`test` → `main`, release PR, deploy gate, injected
checklist) carries over unchanged. Only the substrate differs, and it differs
because Railway earns its place in MySoft through Postgres migrations and a
`/api/health` route that stays 503 until they succeed. reIS has neither.

**Mock mode, not a snapshot.** `src/utils/mock/data/demo.ts` is a synthetic
dataset built, in its own words, so the subjects tab renders for a reviewer with
no account. `demoDates.ts` computes every exam term and lesson relative to *now*
rather than committing absolute dates, so the preview never goes out of season
and needs no maintenance. The `REIS_FIXTURE` overlay machinery is therefore not
needed on the deployed site.

**Real data never leaves the client.** `public/dev-real-data.json` is a real
student record, is gitignored, and `wxt.config.ts`'s `build:publicAssets` hook
strips it from production builds. reIS's published claim is that all processing
is client-side and no student data is stored externally. Hosting a real snapshot
would contradict that claim even behind a login, because the data would have
left the client and be resident on a third-party host. Real-data verification
stays local, via the `dev-real-data` skill. This is permanent, not a v1 limit.

### Rejected

- **A Railway container** — see above. Reconsider only if reIS grows a backend
  it would host, which today is Supabase's job.
- **Porting the dev-server plugins to a Node server** — would allow flipping the
  deployed URL between `examSeason` and `teachingWeek` fixtures. `demoDates.ts`
  already keeps dates fresh, so it buys almost nothing for real server code.
- **A committed synthetic full snapshot** served through the real
  `REIS_SYNC_UPDATE` path — closer to production, but someone must author and
  maintain a fake snapshot by hand. Mock mode already has one.
- **A real staging environment** — needs a second Supabase project, or test
  writes land in production notifications, suggestions and admin. Not worth it
  for a project whose server surface is this small.
- **MySoft's two-human-review merge gate** — no analogue on a solo repo.
- **A `hotfix/*` fast lane and a `sync-main-to-test` back-merge** — both only
  matter once hotfixes exist. Add them the first time one is needed.

## Architecture

```
feature branch ──PR──▶  test  ──▶ Vercel production (preview.reis URL)
      │                   │
      └─ own preview URL   └──release PR (version bump)──▶ main
         per PR                                              │
                                                             ▼
                                                    release-tag.yml pushes vX.Y.Z
                                                             │
                                                             ▼
                                                        publish.yml
                                                  Chrome · Firefox · Edge
```

`test` becomes the default PR base and stays strictly ahead of `main`. `main`
receives only the release PR from `test`.

## Component 1 — the web build

Today the standalone app exists only as a Vite **dev server**
(`vite.web.config.ts`, root `dev/`). There is no build target, and the data
path is dev-server middleware: `reisSnapshotPlugin` serves the snapshot, spawns
`scrape:real` and does the fixture overlay; `reisAdminSessionPlugin` fakes the
admin session. Dev-server middleware does not exist in a production build.

Mock mode removes the need for both:

- `initializeStore` calls `initMockData()` when `VITE_USE_MOCK_DATA === 'true'`
  (`src/store/useAppStore.ts:92`), filling IndexedDB from the `demo` dataset.
- `loadRealDataSnapshot` returns early in mock mode
  (`src/services/loadRealDataSnapshot.ts:42,62`), so no snapshot is ever fetched
  and `reisSnapshotPlugin` has nothing to do.
- `devAdminSession` bails when `VITE_DEV_SOCIETY` is set
  (`dev/devAdminSession.ts:23`), and `vite.web.config.ts` defaults it to `reis`,
  so nothing signs into Supabase.

**New file: `vite.web.build.config.ts`.** Extends the existing
`vite.web.config.ts` with `build.outDir = 'dist-web'` and without the two
dev-server plugins. Entry stays `dev/index.html`.

**New script:** `"build:web": "vite build --config vite.web.build.config.ts"`.

**Build-time environment** — the complete list:

| Variable | Value | Why |
|---|---|---|
| `VITE_USE_MOCK_DATA` | `true` | demo dataset into IndexedDB; snapshot path off |
| `VITE_DEV_SOCIETY` | `reis` | fakes the society session; blocks the Supabase sign-in |
| `VITE_PREVIEW_BUILD` | `true` | new flag, see below |

Nothing else. Vite inlines `VITE_*` into the bundle, so anything added here is
public by construction. In particular `VITE_EXTENSION_SECRET` and any Supabase
credentials must not be set on this project.

**One source change.** `dev/phoneOverride.ts` is guarded by
`import.meta.env.DEV`, so in a production build the phone override — and the
`?mobile=1` / `?welcome=1` escape hatches — is dead code, and the app would stay
desktop at phone widths because `pointer: coarse` never flips in a desktop
browser. Widen the guard to
`import.meta.env.DEV || import.meta.env.VITE_PREVIEW_BUILD === 'true'`. The flag
is set only on the preview project, so extension and Capacitor builds are
unaffected.

A single flag is enough because the whole guarded block was read, not just its
head: it contains the `?mobile=` pin, the `?welcome=1` override that forces the
first-run welcome screen, the `apply()` resize wiring and an HMR dispose. All of
it is wanted on the preview — `?welcome=1` is how the welcome screen becomes
reachable there at all — and none of it exposes anything.

**A banner.** The deployed page carries a persistent, non-dismissible banner
stating that the data is synthetic and that writes are not saved. Two things are
easy to forget and expensive to forget: this is not real data, and a publish
that appears to succeed here is not evidence a publish works
(`VITE_DEV_SOCIETY=reis` routes writes to an in-memory store). The banner is
rendered only when `VITE_PREVIEW_BUILD === 'true'`.

### What the preview proves, and what it does not

Proves: the screens the demo dataset covers render, at any viewport, in both
themes.

`SocietyDataset` carries `exams`, `schedule`, `syllabuses`, `success_rates`,
`studyPlan`, `studyStats` and `studyComparison`, and `demo.ts` fills all seven.
It carries **no documents, holidays, campus events or profile**, so those
screens render their empty states on the preview. That is a known limit, not a
bug to chase — but it must be written down, or the first person to open the
documents tab will file it as one. Extending the dataset later is additive and
needs no plumbing.

Does not prove: the content script, the postMessage IPC, `chrome.storage`,
manifest permissions, or any real IS Mendelu parse — none of which exist outside
a loaded extension. Nor that any write works.

Also unverified until step 1 is built: `VITE_USE_MOCK_DATA=true` has only ever
been exercised through the dev server, never through a production build. If mock
mode turns out to depend on something dev-only, that surfaces at step 1 — before
any host is involved, which is why step 1 comes first.

## Component 2 — the branch model

- `test` is created from `main`.
- **`main` stays the repository's default branch.** GitHub has no setting for a
  default PR base independent of the default branch, so "PRs target `test`
  automatically" would mean flipping the default — and this repository is
  **public**. The default branch is what a visitor's Code tab, a fresh clone and
  every "load unpacked from source" instruction resolve to, and pointing that at
  unreleased code is a regression a private repo like MySoft never has to weigh.
  The cost of keeping `main` default is that PRs open with the wrong base and a
  branch cut from the default is cut from `main`. Both are caught rather than
  prevented: the release gate rejects any PR into `main` whose head is not
  `test`, with a message saying to retarget.
- Feature PRs base on `test` — `gh pr create --base test`. A branch cut from
  `main` must merge `origin/test` in and retarget before continuing, or it goes
  stale and conflicts at the next release. Document this in `CLAUDE.md`.
- `main` accepts PRs only from `test` (enforced by the release gate below).
- Branch protection on `main`: require the release gate check; no force pushes.
- `test` merges are squash merges; the `test` → `main` release PR is a merge
  commit, so `main`'s history is one commit per release.
- **`test` is frozen while a release PR is open.** The release PR's head SHA is
  the tip of `test`, and the gate requires a successful deployment of *that*
  SHA. Merging into `test` mid-release moves the tip, so the gate either waits
  on a deployment still building or, worse, reads as flaky. Merge the release
  first, then resume merging into `test`.

## Component 3 — the release train

Three workflows, modelled on MySoft's and cut down for a solo repo.

**`release-gate.yml`** — a required status check on every PR into `main`. Passes
only when the head branch is `test` *and* the head repo is this repo *and* a
successful Vercel deployment exists for that exact head SHA (GitHub Deployments
API, same shape as MySoft's release gate). Anything else is rejected with an
instruction to retarget at `test`.

Read the deployment environment name off a real Vercel deployment before wiring
the query, and do not hardcode a guess. MySoft's deploy-alert feature shipped
with `'production'` where the environment is really `prod`, so the one case the
feature existed for would never have fired — and its unit tests asserted the
wrong name too, defending the bug instead of catching it.

This is what makes the preview load-bearing rather than decorative: a commit
that was never deployed cannot be released.

Guards to copy verbatim from MySoft's version, each of which fixed a real
failure there:
- `types: [opened, edited, synchronize, reopened]` — without `edited`, a PR
  retargeted from `test` to `main` never runs the workflow, and a required check
  that never reported blocks the merge permanently.
- `concurrency` with `cancel-in-progress: false` — a cancelled run leaves no
  conclusion for the ruleset to read.
- The job **name** is the required-check context; renaming it without updating
  branch protection in the same change silently un-enforces the gate.

**`release-checklist.yml`** — injects `.github/release-checklist.md` into the
release PR body on open, idempotently. Checklist contents: version bumped in
both `package.json` and `wxt.config.ts`; preview URL checked at phone and
desktop width; store listing text still accurate for what changed.

**`release-tag.yml`** — new, no MySoft equivalent. On push to `main`, read
`version` from `package.json` and, **if no `v<version>` tag already exists**,
create and push it. That tag fires the existing `publish.yml` unchanged. The
existence check is load-bearing: without it a re-run or any later push to `main`
re-submits the same version, which the stores reject.

The version bump lives in the release PR diff, so the artefact being submitted
is reviewable before the irreversible step. `publish.yml` itself does not change.

**`/release` is rewritten**: from "bump on `main`, tag, push" to "bump on
`test`, open the release PR". The tag stops being something a human types.

## Vercel project

- Project connected to `reis-mendelu/reis-extension`.
- Production branch: **`test`** (not `main` — `main` is the store release, and
  nothing about it is a website).
- Framework preset: Vite. Build command `npm run build:web`, output directory
  `dist-web`, install command `npm ci`.
- SPA rewrite: all paths to `/index.html`.
- The three environment variables above, on Production and Preview scopes.
- Preview deployments left enabled, so every PR gets a URL and a PR comment.

Three things to confirm at setup:

1. **GitHub Deployments are enabled** for the project's Git integration. The
   release gate queries the GitHub Deployments API; if Vercel is not creating
   deployment records, the gate has nothing to read and blocks every release.
   Check this before writing the gate, not after.
2. **The plan.** Vercel's Hobby tier is non-commercial-only, so the
   `reis-mendelu` org's plan should be checked against this project
   (`reis-page` sets the precedent).
3. **Preview URL visibility.** Hobby preview URLs are public but unguessable,
   which is acceptable only because the data is synthetic — another reason it
   must stay synthetic.

## Testing

- `vitest` — the widened `phoneOverride` guard: override active when
  `VITE_PREVIEW_BUILD` is `true` and `DEV` is false; inactive when both are
  false.
- `vitest` — the preview banner renders only under `VITE_PREVIEW_BUILD`.
- `npm run build:web` in CI on every PR, so the build target cannot rot
  unnoticed the way an unbuilt config would.
- `build:web` fails closed if `VITE_EXTENSION_SECRET` or any `VITE_SUPABASE_*`
  variable is present in the environment. Asserting on the environment rather
  than grepping the bundle for a value keeps the secret out of CI logs and out
  of the test itself.
- Manual, once: the deployed URL renders subjects, schedule and exams from the
  demo dataset, and `?mobile=1` produces the phone layout.

## Rollout order

The repo has to be able to build before there is any point pointing a host at
it.

1. `vite.web.build.config.ts`, `build:web`, the `phoneOverride` guard, the
   banner, and their tests. Merged to `main` the current way.
2. Create `test` from `main`. `main` stays the default branch.
3. Create the Vercel project, production branch `test`. Verify the deployed URL
   renders subjects, schedule and exams, and that documents, holidays, campus
   events and profile show their empty states — the expected result, recorded
   here so it is not mistaken for a broken deploy.
4. Add the three workflows and the branch protection on `main`.
5. Rewrite `/release`.
6. First release PR.

Steps 1 and 2 are useful on their own — if the rest is abandoned, the repo has
gained a web build target and lost nothing.

## Out of scope

- **App Store and Play publishing on release.** Needs an App Store Connect API
  key, a macOS runner and signing certificates in CI, and iOS build numbers are
  versioned separately from the extension. Its own spec. iOS stays manual.
- A real staging environment with live Supabase writes.
- A `hotfix/*` lane and the `main` → `test` back-merge.
- Any change to `publish.yml` or to the store credentials.
