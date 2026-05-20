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

Columns on `error_groups`: `fingerprint, error_type, message_template, sample_message, first_seen, last_seen, occurrence_count, last_ext_version, resolved_at, resolved_in_version`.

Both have RLS deny-all. Query via the Supabase linked project: `npx supabase db query --linked "<SQL>"`.

## Inversion first — read this before any query

What kills the triage:

1. **Fixing symptoms.** "Fewer 403s" by raising the rate limit ≠ fewer 403s. Find root cause.
2. **Marking-as-resolved for queue cleanliness.** If the underlying bug still fires, you've created false confidence. Only resolve what's *structurally* fixed (filtered, code-fixed at root, or genuinely unreachable).
3. **Treating "occurrence_count = 28" as severity.** 28 events from 1 looping user is a UX nuisance; 28 events from 28 users is a real bug. Always join to `session_id` count.
4. **Touching parsers to silence parser errors.** See `CLAUDE.md` — parsers require a real IS Mendelu HTML sample. Suppress lints, fix fixtures, never relax guards.
5. **Adding new telemetry fields to "help debug" without updating PRIVACY.md §6.** Every disclosed field is a contract.
6. **Trusting recency.** A bug that fired once last week isn't necessarily small; a bug that fires daily isn't necessarily new. Check `first_seen` vs ext_version timeline.

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
| **Filter** | Error is an expected UX state (auth missing, host page navigated, user not logged in). Reporting it is noise. | `src/services/errorReporter/telemetry.ts` → extend `isExpectedError()` pattern list. Never filter at individual call sites — central funnel only. |
| **Root-fix** | A real bug. Unguarded `.map`, missing retry, race condition. | At the offending file. NO bundled refactoring (see CLAUDE.md iron rules). |
| **Accept** | Environmental / unfixable. Version downgrade. Stale chunk hash after extension update. Genuine network drop. | Document in resolved_in_version notes; mark resolved with a reason. |

If the fix touches more than 2 files, you've probably chosen the wrong category. Stop, re-read Phase 2.

## Phase 4 — Mark resolved (honest accounting)

Only after the fix is shipped *and* the underlying behavior no longer reaches `report_error_v2`. The two acceptable patterns:

**A. Group-level (preferred):**
```sql
UPDATE error_groups
SET resolved_at = now(), resolved_in_version = '<x.y.z>'
WHERE fingerprint = '<fp>';
```

**B. Event-level batch (for filter-style fixes that affect many fingerprints, e.g., HTTP 403):**
```sql
UPDATE error_reports SET resolved_at = now()
WHERE resolved_at IS NULL AND <precise condition matching the filter>;
-- Then re-derive groups:
UPDATE error_groups g SET resolved_at = now()
WHERE g.resolved_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM error_reports r
    WHERE r.fingerprint = g.fingerprint AND r.resolved_at IS NULL
  );
```

**Anti-patterns to refuse:**
- Mark-all-resolved-because-the-queue-is-noisy. Don't.
- Mark resolved without `resolved_in_version`. Future-you needs to know which release the fix was in.
- Mark a Sync retry as resolved because you deduped it. Real retries still fire on real failures — the underlying bug isn't gone.

## Phase 5 — Verify the fix actually shipped

After the next release that includes the fix, check for *new* occurrences post-release date:

```sql
SELECT count(*), max(created_at)
FROM error_reports
WHERE fingerprint = '<fp>'
  AND created_at > '<release date>'
  AND ext_version >= '<fix version>';
```

If count > 0 on the fix version, the fix didn't take. Reopen the group:
```sql
UPDATE error_groups SET resolved_at = NULL, resolved_in_version = NULL
WHERE fingerprint = '<fp>';
```

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
| `IDBDatabase.*: connection is closing` | IDB singleton not self-healing on `onversionchange`/`onclose` | Architecture issue — DO NOT patch with try/catch; fix `IndexedDBService`. |
| `*Slice.fetch*` (IDB error) | Fallout from the same root as above | Same fix, single source. |
| `ErasmusSlice.fetchUniversities` | HEI API or CDN hiccup | Retry policy lives in `messageHandler.ts` BG fetch path. |
| Dynamic import `Failed to fetch ... chunks/*` | Old page open after extension update; chunk hash changed | Accept. Cannot fix from the new build. |
| `VersionError` IDB version (18) < (19) | User installed older version after newer | Accept. |

## What this skill is NOT for

- Investigating bugs the user reports verbally without Supabase data → use `superpowers:systematic-debugging`.
- Designing new telemetry features → use `.agent/rules/charlie-munger.md` for the inversion lens.
- Performance issues → wrong skill.
- IS Mendelu HTML parser changes → see `CLAUDE.md` "Parser Rules". Never relax guards.
