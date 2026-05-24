---
name: debug-telemetry-errors
description: Use when the user asks to triage, investigate, or fix errors in the Supabase error_reports / error_groups telemetry. Munger-style workflow — inversion first, honest accounting, no symptom-fixes.
---

# Debugging Supabase telemetry errors

## When to use

User asks anything like:
- "look into our supabase for open errors"
- "what's failing in production"
- "triage the latest crashes"
- "is this error new or known"
- "are we fine after the v… release"

If they're asking about the *infrastructure* of error reporting (sanitization, RPC, schema), use `.agent/rules/charlie-munger.md` first, not this skill.

## The shape of the data

Two tables. Use the right one for the question.

| Table | Granularity | Use for |
|---|---|---|
| `error_reports` | one row per event | "show me individual occurrences", "what stack did this fire from", "how many distinct sessions" |
| `error_groups` | one row per fingerprint (deduplicated bug) | "what bugs are open", "first/last seen", "how many times has this fired", "is it resolved" |

Columns on `error_reports`: `id, error_type, error_message, file_path, line_number, ext_version, browser_name, browser_version, created_at, resolved_at, session_id, stack_excerpt, client_ts, fingerprint`.

Columns on `error_groups`: `fingerprint, error_type, message_template, sample_message, first_seen, last_seen, occurrence_count, last_ext_version, resolved_at, resolved_in_version, fix_staged_version, fix_target`.

The last two are the **staging ledger** (added `20260524120000_error_groups_fix_staging.sql`). They let the skill automate honest resolution across invocations:

| `resolved_at` | `fix_staged_version` | Meaning |
|---|---|---|
| NULL | NULL | Open, untouched. |
| NULL | set | **Staged** — a fix was authored against that ext_version, awaiting a later release to verify. Phase 0 reconciles these. |
| set | set | Resolved (verified). `resolved_in_version` records where it went quiet. |

`fix_target` is `'code'` (bug fixed at source) or `'filter'` (noise dropped at the telemetry funnel). It decides how Phase 0 verifies — see Phase 0.

Both have RLS deny-all. Query via the Supabase linked project: `npx supabase db query --linked "<SQL>"`.

**The `ext_version = '0.0.0'` sentinel.** `getExtVersion()` returns `'0.0.0'` only when `chrome.runtime.getManifest()` throws — i.e. the **extension context was invalidated** (an update unplugged a still-open iframe). It is the single most useful discriminator in IDB/chrome-API error triage: `0.0.0` events are environmentally dead (unfixable from inside; the `isContextAlive()` funnel guard now drops them), live-version events are real bugs. **Always split IDB/`connection is closing` groups by `ext_version='0.0.0'` before deciding anything.**

## Inversion first — read this before any query

What kills the triage:

1. **Fixing symptoms.** "Fewer 403s" by raising the rate limit ≠ fewer 403s. Find root cause.
2. **Marking-as-resolved for queue cleanliness.** If the underlying bug still fires, you've created false confidence. Only resolve what's *structurally* fixed (filtered, code-fixed at root, or genuinely unreachable).
3. **Treating "occurrence_count = 28" as severity.** 28 events from 1 looping user is a UX nuisance; 28 events from 28 users is a real bug. Always join to `session_id` count.
4. **Touching parsers to silence parser errors.** See `CLAUDE.md` — parsers require a real IS Mendelu HTML sample. Suppress lints, fix fixtures, never relax guards.
5. **Adding new telemetry fields to "help debug" without updating PRIVACY.md §6.** Every disclosed field is a contract. (Internal bookkeeping columns like `fix_staged_version` are *not* transmitted, so they don't touch the contract — but a *client-sent* field always does.)
6. **Trusting recency.** A bug that fired once last week isn't necessarily small; a bug that fires daily isn't necessarily new. Check `first_seen` vs ext_version timeline.
7. **Fixing the minority while declaring victory.** A symptom can have two roots in different proportions (e.g. `connection is closing` is ~77% dead-context, ~23% live-connection). Before writing a fix, **state what fraction of the group it eliminates** — split by `ext_version`. A clean fix for the wrong 23% is still a loss.
8. **Believing green tests prove the root is addressed.** The unit harness (`fake-indexeddb`, happy-dom) *cannot* reproduce extension-context invalidation — the dominant cause. Passing tests prove the path you could simulate, and are silent on the one you couldn't. Verify against the *actual* production failure mode, not the convenient one.

## Phase 0 — Reconcile staged fixes (run this FIRST, every invocation)

Before triaging anything new, close the loop on fixes a prior run staged. This is the automation: a fix is staged in one invocation and auto-resolved in a later one once telemetry proves it took. **Never skip — that is how the queue stays honest without a human re-checking.**

1. Read the current shipped version: `node -p "require('./package.json').version"`. Call it `SHIPPED`.
2. List staged groups:
   ```sql
   SELECT fingerprint, error_type, sample_message, fix_staged_version, fix_target
   FROM error_groups
   WHERE resolved_at IS NULL AND fix_staged_version IS NOT NULL;
   ```
3. For each staged group, decide if a **newer release actually shipped and reached users**. A release shipped iff `SHIPPED` (semver) > `fix_staged_version` AND telemetry shows events on a version newer than `fix_staged_version`. If no newer version has reached users yet, **leave it staged** — there is nothing to verify. Find the rollout cutoff:
   ```sql
   SELECT min(created_at) AS rollout FROM error_reports
   WHERE fingerprint = '<fp>'
     AND ext_version <> '0.0.0'
     AND string_to_array(ext_version,'.')::int[] > string_to_array('<fix_staged_version>','.')::int[];
   -- if NULL, fall back to the global rollout: min(created_at) where ext_version = '<SHIPPED>'
   ```
   Compare versions semver-safe with `string_to_array(v,'.')::int[]`, never as text — `'5.0.10' < '5.0.9'` lexically.
4. Count occurrences **after the cutoff** that the fix should have eliminated:
   - `fix_target = 'filter'`: count **all** events since cutoff (including `ext_version='0.0.0'`) — the funnel now drops them client-side, so any arrival is a regression.
     ```sql
     SELECT count(*) FROM error_reports
     WHERE fingerprint = '<fp>' AND created_at >= '<rollout>';
     ```
   - `fix_target = 'code'`: count events since cutoff on the fixed-or-newer version.
     ```sql
     SELECT count(*) FROM error_reports
     WHERE fingerprint = '<fp>' AND created_at >= '<rollout>'
       AND ext_version <> '0.0.0'
       AND string_to_array(ext_version,'.')::int[] >= string_to_array('<fix_staged_version>','.')::int[];
     ```
5. Act on the count:
   - **0 → resolve.** `UPDATE error_groups SET resolved_at = now(), resolved_in_version = '<SHIPPED>' WHERE fingerprint = '<fp>';` (keep `fix_staged_version`/`fix_target` as the audit trail).
   - **> 0 → the fix did not take.** Do **not** resolve. Clear staging so it re-enters normal triage, and report it as a regression: `UPDATE error_groups SET fix_staged_version = NULL, fix_target = NULL WHERE fingerprint = '<fp>';`
6. Report what reconciliation closed vs. reopened, then continue to Phase 1.

## Phase 1 — Triage (what's open)

```sql
SELECT
    fingerprint, error_type, sample_message,
    occurrence_count, first_seen, last_seen, last_ext_version
FROM error_groups
WHERE resolved_at IS NULL
ORDER BY last_seen DESC
LIMIT 25;
```

Then for each interesting group, get **distinct sessions** (the 1-user-vs-N-users question):

```sql
SELECT g.fingerprint, g.sample_message, g.occurrence_count,
       (SELECT count(DISTINCT session_id) FROM error_reports r
        WHERE r.fingerprint = g.fingerprint AND r.session_id IS NOT NULL) AS distinct_sessions,
       (SELECT count(*) FROM error_reports r
        WHERE r.fingerprint = g.fingerprint AND r.session_id IS NULL) AS legacy_events
FROM error_groups g
WHERE resolved_at IS NULL
ORDER BY g.occurrence_count DESC
LIMIT 10;
```

**Decision rule:** if `distinct_sessions = 1` and `occurrence_count > 5`, it's almost always a single-user loop (broken session, retry storm) — low priority. If `distinct_sessions >= 5`, it's a real bug affecting multiple users.

## Phase 2 — Investigate a single bug

Pull stack samples for the chosen fingerprint:

```sql
SELECT stack_excerpt, ext_version, browser_name, client_ts
FROM error_reports
WHERE fingerprint = '<fp-from-phase-1>'
ORDER BY created_at DESC
LIMIT 5;
```

Time distribution by version (catches "did this start at v5.0.0" vs "has been broken since v4.x"):

```sql
SELECT ext_version, date_trunc('day', created_at) AS day, count(*)
FROM error_reports
WHERE fingerprint = '<fp>'
GROUP BY ext_version, day
ORDER BY day DESC;
```

If the bug predates the most recent version → it's not a regression, it's chronic. If it starts cleanly at a version → check the release diff.

For multi-error investigations (4+ groups to dig into), use parallel `Explore` subagents — one per cluster — and ask each for `<400 word` root-cause hypothesis with `path:line` evidence. Do not ask them to propose fixes; root cause first.

## Phase 3 — Categorize the fix

Three categories. Pick one before writing code:

| Category | When | Where to fix |
|---|---|---|
| **Filter** | Error is an expected UX state (auth missing, host page navigated, user not logged in) **or a dead-context report** (`isContextAlive()` false / `ext_version='0.0.0'`). Reporting it is unactionable noise. | `src/services/errorReporter/telemetry.ts` → extend `isExpectedError()` / the funnel guards. Never filter at individual call sites — central funnel only. → stage as `fix_target='filter'`. |
| **Root-fix** | A real bug. Unguarded `.map`, missing retry, race condition. | At the offending file. NO bundled refactoring (see CLAUDE.md iron rules). → stage as `fix_target='code'`. |
| **Accept** | Environmental / unfixable *and not even worth a filter*. Version downgrade (`VersionError`). Stale chunk hash. Genuine one-off network drop. | Resolve immediately with a reason in `resolved_in_version` — there is nothing to ship, so nothing to stage. |

**Before writing code, state the fix's coverage.** Split the group by `ext_version` and say out loud what fraction this fix eliminates (see inversion #7). If a single symptom has two roots in different proportions, you likely need *two* fixes (e.g. a funnel filter for the dead-context majority **and** a root-fix for the live minority) — categorize and stage each.

If the fix touches more than 2 files, you've probably chosen the wrong category. Stop, re-read Phase 2.

## Phase 4 — Stage the fix (do NOT resolve here)

A fix made *this* invocation has not shipped — the version in `package.json` is still being worked on, and the broken behavior still reaches `report_error_v2` from every user not yet on the new build. Resolving now is the false-confidence trap (inversion #2). **Stage instead; Phase 0 of a later run resolves it once a release proves it took.**

Stamp the group(s) with the version the fix was authored against (current `package.json`) and the category from Phase 3:

```sql
UPDATE error_groups
SET fix_staged_version = '<current package.json version>',
    fix_target = '<code|filter>'      -- from Phase 3
WHERE resolved_at IS NULL AND <fingerprint or precise sample_message condition>;
```

Prefer matching by a precise `sample_message LIKE` condition over transcribing fingerprints — one filter fix often covers many fingerprints, and content-matching catches the ones below your triage `LIMIT`.

**The only category that resolves immediately is Accept** — there is nothing to ship, so nothing to verify:
```sql
UPDATE error_groups
SET resolved_at = now(), resolved_in_version = '<reason, e.g. accept:chunk-hash-stale>'
WHERE fingerprint = '<fp>';
```

**Anti-patterns to refuse:**
- Resolving a code/filter fix the same session you wrote it. It hasn't shipped. Stage it.
- Mark-all-resolved-because-the-queue-is-noisy. Don't.
- Staging without `fix_target`. Phase 0 can't verify without knowing how.
- Staging a Sync retry as fixed because you deduped it. Real retries still fire on real failures — the underlying bug isn't gone.

## Phase 5 — Verification is Phase 0

There is no separate manual verify step. Staged fixes are reconciled automatically by **Phase 0** on the next invocation after a release: it date-gates on the rollout, counts residual occurrences per `fix_target`, and either resolves (0) or reopens (>0). This is deliberate — verification is a *gate on resolution*, not an optional afterthought, so the queue can never show a "resolved" group that is still firing.

To force a check sooner (e.g. right after a release), just re-run the skill — Phase 0 runs first.

## Privacy guardrails

Before adding ANY new query that pulls more than the disclosed columns, or any new column to the schema:

1. Read `PRIVACY.md` §6. The list there is the contract.
2. If you propose adding a field, update the contract in the same PR.
3. Run the new field through `sanitizeMessage` / `sanitizeStack` regex. Adding without sanitization = breach.
4. Anonymous session UUID is regenerated per iframe load — never persist it. The day it goes into IndexedDB is the day this becomes a tracking system, which violates the policy.

## Quick reference: common contexts

| Context | Likely root | First check |
|---|---|---|
| `Api.fetch*` HTTP 401/403 | User not logged in to IS Mendelu | Already filtered (telemetry.ts isExpectedError). New occurrence = filter regression. |
| `Api.fetch*` Failed to fetch | Tab navigated mid-fetch OR IS Mendelu down | Check session_id count — single session = AbortError noise. |
| `SyncService.syncClassmates*` | Per-subject failure after group map succeeded | Real per-subject issue. Check which subject (stack). |
| `Sync.fetchSeminarGroupIds.retry` | Group-map fetch failed twice | Network or IS Mendelu API change. |
| `IDBDatabase.*: connection is closing` | **Two roots — split by `ext_version='0.0.0'` first.** `0.0.0` = dead extension context (majority, ~77%); live version = connection not self-healed. | `0.0.0` → **filter** (`isContextAlive()` funnel guard drops it — unfixable from inside). Live → **code** fix in `IndexedDBService` (lazy `getDB()` + `blocking`/`terminated` reset + retry-once). Both authored against 5.0.4 and staged (`fix_target='filter'`); Phase 0 verifies after the next release. |
| `*Slice.fetch*` (IDB error) | Fallout from the same two roots as above | Same two fixes, single source each. Don't patch per-slice. |
| `ErasmusSlice.fetchUniversities` | HEI API or CDN hiccup | Retry policy lives in `messageHandler.ts` BG fetch path. |
| Dynamic import `Failed to fetch ... chunks/*` | Old page open after extension update; chunk hash changed | Accept. Cannot fix from the new build. |
| `VersionError` IDB version (18) < (19) | User installed older version after newer | Accept. |

## What this skill is NOT for

- Investigating bugs the user reports verbally without Supabase data → use `superpowers:systematic-debugging`.
- Designing new telemetry features → use `.agent/rules/charlie-munger.md` for the inversion lens.
- Performance issues → wrong skill.
- IS Mendelu HTML parser changes → see `CLAUDE.md` "Parser Rules". Never relax guards.
