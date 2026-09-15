# Admin usage statistics: count devices, honestly

**Date:** 2026-09-15
**Status:** implemented — reis-mendelu/reis-extension#334 (migration parked, see Rollout)

## Why

The admin console reported **1949 unique installs over 30 days**. Measured against
production the same day, roughly **320–590** of those were real. The rest were
development boots and sign-out churn.

Three defects produced it, all fixed in `1aad5205` (already merged into this branch):

1. `npm run dev:web` had no demo-mode guard — only the preview build sets that
   flag — so every local boot filed a real `track_daily_usage` against production.
   Every fresh browser profile minted a new install id. All 164 rows ever labelled
   `platform = 'web'` were written this way.
2. `initializeStore()` runs from a bare `useEffect(..., [])` under `<StrictMode>`,
   which double-invokes effects in development. One boot filed two RPCs.
3. `IndexedDBService.clearAll()` cleared `meta`, so signing out discarded the
   install id and the next open counted as a new install.

This spec covers what remains: what the dashboard *reports*, now that what it
*records* is trustworthy. Full diagnosis and queries: see the commit message of
`1aad5205`.

## Decisions

| Question | Decision |
|---|---|
| Per-day faculty × platform drill-down? | No. Per-day shows totals + platform; faculty stays on the rolling window, where cells survive the k=5 floor. |
| Which metrics? | Active devices, split into **new** and **returning**. |
| History | Excluded, not deleted. Epoch **2026-09-07**. |
| PostHog? | No. See "Vendor" below. |
| Layout | Statistiky becomes a full-width page, not a sidebar pane. |

## Definitions

Copied from PostHog's Lifecycle insight and GA4's user metrics, so the words mean
what people outside this project expect.

- **Active device** — an install id with a row on that day. Not a user, not a
  person. Two devices is two, always. The UI says *zařízení*, never *uživatelé*.
- **New** — `first_seen == day`. GA4's `first_open`. Indistinguishable from a
  reinstall, on every platform: `install_id` lives in IndexedDB, which both an
  extension reinstall and an iOS app deletion wipe.
- **Returning** — `first_seen < day`. New + returning = active, exactly, so the
  stacked bar is checkable by eye.
- **Rolling windows** — `d7`/`d30` are rolling distinct counts ending today, not
  calendar weeks. Matches PostHog.
- **Day boundary** — `Europe/Prague`, not UTC. A student opening reIS at 01:00
  Tuesday in Brno currently counts as Monday.

`first_seen` is computed over the **whole UUID era** (from 2026-08-29), while the
dashboard *displays* from 2026-09-07. Without that split, everyone active on day
one of the epoch would appear as new.

PostHog's stricter "returning = active in the *previous* interval" (making a
Mon+Thu student *resurrecting*) is deliberately not adopted: at ~80 devices/day
that is resolution the data will not support. Revisit if the base grows 10×.

## Excluded history

The exclusion lives in the RPC as a CTE with these counts in a comment. Nothing is
deleted — the call stays reversible and auditable.

Measured 2026-09-15 (a live table — these move): of **2071** ids ever recorded,
**1647** are excluded and **424** kept. The two criteria overlap, so their sizes
do not add up:

| Exclusion | Evidence |
|---|---|
| `usage_date < 2026-09-07` | Before 2026-08-29 the id was `SHA-256(student id)` — 99 stable per-*student* hashes, a different unit. From 29 Aug to 6 Sept the UUID era is development-dominated: 6 Sept alone is 121 of 127 rows at `open_count = 2`, and 2–5 Sept is 1188 of 1216 even, with 2 of its 1207 ids ever seen again after 9 Sept. |
| `platform = 'web'` (161 ids) | 164 rows, **zero** with an odd `open_count`. Every one written by a development build. |

`open_count` parity is the marker: StrictMode double-invokes effects in
development builds only, so a dev boot contributes an even count and a production
boot an odd one.

## RPC contract

Replaces `usage_stats` / `usage_stats_unchecked`. The `weekly` 12-bar series is
replaced by a daily one.

```
usage_stats(p_days int, p_day date default null) -> json
  today / d7 / d30   int          rolling distinct active devices
  daily[]            { day, active, new, returning }   over the window
  by_platform[]      { key, devices }                  rolling window
  by_faculty[]       { key, devices }                  rolling window
  day{}              { day, active, new, returning, by_platform[] } | null
```

`p_day` takes a default so a released admin console calling the one-argument
version keeps working — the same reason `20260907130000_usage_dimensions.sql`
defaulted its new arguments, and the same `drop`-then-`create` dance is needed so
PostgREST has no overload to disambiguate.

**Each device lands in exactly one breakdown bucket**, chosen by its most recent
non-null label. Counting `distinct student_id` per bucket instead put a device
whose label changed (`null` → `ios`) into two, and the bars summed to 429 against
a total of 423.

**`(neuvedeno)` is an explicit bucket**, GA4's `(not set)` convention — never
collapsed into a real category, never dropped from the denominator. After the
2026-09-07 epoch it falls to 7 devices on platform and 15 on faculty.

**Suppression is complementary**, not a simple floor. A single hidden bucket is
not hidden at all: the dashboard publishes the window total beside the breakdown,
so subtracting the visible buckets recovers the hidden one exactly. Measured on
live data 2026-09-15 — `day.active` 293 − ios 259 − extension 33 left **1**, and
`d30` 533 − the six visible faculties left **4**. The k = 5 floor was decorative.

`usage_suppress_groups` therefore walks buckets smallest-first and keeps hiding
while the hidden mass is still attributable: while exactly one bucket is hidden,
or while the hidden total is itself under 5. Whatever a reader can derive by
subtraction is then a sum of at least two buckets totalling at least 5, which
pins no one. Suppressed buckets return `-1` and render `< 5`, and the total stays
visible so a hidden cell reads as missing rather than zero.

The cost is deliberate: hiding a small bucket can take its next-smallest
neighbour with it, so a breakdown may show fewer numbers than before. On
2026-09-15 that meant ICV (4) also hid ZF (13). That is the correct trade for a
count of students.

## UI

`AdminStatsPanel` becomes a full-width page. In `AdminConsole.tsx` the `<aside>`
is `w-96` with `<AdminConsoleMap />` as a `flex-1` sibling; when `pane === 'stats'`
the aside takes `w-full` and the map does not render.

*Trade-off:* unmounting the map resets its zoom and centre when the user returns to
Akce. The alternative — keeping it mounted under `hidden` and calling
`invalidateSize()` on return — is more code and more Leaflet edge cases. Take the
unmount; revisit if it annoys.

Sections, in order:

1. **Tiles** — Dnes / 7 dní / 30 dní, with the new+returning split under Dnes.
   The 30-day tile is labelled with how much data the epoch actually holds, since
   it will read roughly the 7-day number until early October.
2. **Denně aktivní zařízení** — stacked bars, new below returning, one per day,
   clickable.
3. **Day detail** — the selected day: active, new, returning, and the platform
   split. The share of actives that are returning is labelled *z toho vracející
   se*, **not** *návratnost* — it is a composition, not a retention rate.
4. **Podle platformy** and **Podle fakulty**, side by side, rolling window.

`AdminStatsPanel.tsx` is 91 lines today and will not hold all of this under the
200-line convention. Split: `StatsTiles`, `DailyActivityChart`, `DayDetail`,
reusing the existing `StatsBars` for the two breakdowns.

## Privacy

**Nothing about what reIS transmits changes.** Same row, same fields, same RPC
arguments — only the aggregate the admin reads changes, and only downward. So
`PRIVACY.md`, `docs/privacy-policy-app.md` and the published gist stay as they
are, and `SUPABASE_CALLERS` gains no entry.

### Vendor: not PostHog

Adding PostHog would end the "nothing about you leaves your device" promise, for
reasons that no configuration removes:

- Every event carries `$os`, `$browser`, `$device_type`, screen and viewport
  dimensions, and the IP.
- `person_profiles: 'never'` — the only profile-less mode — is **mobile-SDK only**.
  The extension cannot use it.
- Cookieless mode relocates the identifier rather than removing it: it is a
  **server-side hash of the IP**, and enabling it disables their bot detection,
  because the IP is stripped before that runs.
- MV3 forbids remote-hosted code, so the SDK must be bundled, and any feature
  lazy-loading a chunk (replay, surveys, toolbar) is a compliance risk.
- The Chrome Web Store listing would have to name PostHog Inc. as a recipient of
  user data; the 2026 policy update requires disclosing all collection regardless
  of whether it serves the extension's single purpose.

Plausible, Fathom and Umami are all daily-rotating-salt pageview tools; none of
them answers "active devices by faculty" without being bent out of shape.

If the promise is ever rewritten, CLAUDE.md fixes the order: the two policy
documents and the gist first, then the guard test.

**Worth stealing for free:** PostHog's SDK drops every capture when
`navigator.webdriver` is true or the UA contains `HeadlessChrome`. Not adopted
here — `isHarnessEnabled` already covers our dev builds and `check:app` already
fails on any Supabase POST — but it is the right guard if a production build ever
needs to run under automation.

## Testing

- SQL: **no fixture tests, and that is a gap, not a decision.** The repo has no
  SQL test harness — nothing spins up a Postgres for CI — and building one was
  out of scope here. What was done instead: the function body was executed
  read-only against production before the migration was written down, and the
  results reconciled by hand (platform 349 + 70 + 7 = 426 = `d30`; the picked
  day 77 + 9 = 86 = `active`; a 3-device bucket returned `-1`). That checks the
  SQL once, against one day's data. It does **not** protect the exclusion CTE or
  the new/returning split from a later edit, which is what a fixture test would
  do. Anyone changing this SQL should re-run the same read-only reconciliation.
- `src/api/usageStats.ts`: schema parse of the new shape, `-1` passed through
  unclamped.
- Components: tiles render the split; a bar click updates the day detail;
  `(neuvedeno)` renders as a labelled bar, not a gap.
- The migration is **parked on the PR and not merged into `test`** — merging to
  `test` applies it to production.
- `verify-ui` at 320/390/430 plus the full-width desktop tree for the new page.

## Out of scope

- Deleting historical rows. The exclusion is reversible; a `DELETE` is not.
- An explicit `install_started` event with a `first_seen_day` column. Derivable
  from `min(usage_date)`, so it buys a client change and a migration for nothing.
- Unique *humans*, cross-device identity, retention across a reinstall. Not
  obtainable without identifying the student, which is the thing reIS will not do.
- PostHog's four-state lifecycle (resurrecting, dormant).
