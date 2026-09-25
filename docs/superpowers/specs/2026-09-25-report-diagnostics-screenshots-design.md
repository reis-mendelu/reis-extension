# Report a problem: screenshot + technical details

Date: 2026-09-25. Approved in conversation with Dominik, section by section.

## Why

A report today carries the student's text plus screen, version, browser and
viewport. That is rarely enough to find the bug: the real cause is computed and
then dropped into a console nobody opens (`logError`, ~237 call sites). Students
also cannot show us what they see.

## What changes for the student

The existing form (`FeedbackModal`, mounted by `FeedbackModalHost` in BOTH
`AppOverlays` and `MobileApp` — one change reaches the extension, phone and
iPad) gains two blocks below the message:

1. **Přiložit snímek obrazovky** — a file input `accept="image/*"` (photo
   picker on phones, file picker on desktop) plus paste (Ctrl/⌘+V) on desktop.
   Thumbnail with ✕. One image per report. Re-encoded on device through a
   canvas to JPEG, longest side ≤ 1600 px, ≤ 600 KB (quality stepped down until
   it fits) — this strips EXIF/GPS. reIS never captures the screen itself.
2. **Přiložit technické údaje** — a checkbox, **unchecked by default** on every
   report type (a pre-ticked box is not valid consent — CJEU Planet49).
   "Zobrazit (N)" expands the exact list that will be sent; each line has ✕.

Offered for every report type, not just `bug`.

## What "technical details" contains

```ts
interface DiagnosticEntry {
  t: number;              // epoch ms
  level: 'error' | 'warn';
  source: 'app' | 'content' ;  // content = extension content script
  ctx: string | null;     // logError context ("Api.fetchExams"); null for raw console
  status?: number;        // HTTP status when the error carries one
  msg: string;            // cleaned, see below
}
interface DiagnosticsPayload {
  entries: DiagnosticEntry[];          // ≤ 50, newest last
  env: {
    platform: 'extension' | 'ios' | 'android' | 'web';
    os: string;                        // e.g. "iOS 26.0", "Android 14", "macOS"
    lang: 'cz' | 'en';
    online: boolean;
    uptimeS: number;                   // seconds since the app booted
  };
  sync: {                              // flags, timestamps and counts only
    lastSync: number | null;
    isSyncing: boolean;
    schedule: string; exams: string;   // Status values: idle/loading/success/error
    scheduleCount: number; examsCount: number;
    examsFetchedAt: number | null;
  };
}
```

"Native" failures are captured only as what reaches JS: a rejected plugin
promise that lands in `logError`. A crash inside Swift/Kotlin is NOT captured.

### Cleaning (at capture time, so nothing raw is ever held)

- first line only, ≤ 200 chars; never a stack
- every URL: query and fragment removed
- emails → `‹email›`
- decimals with ≥ 3 fractional digits → `‹n›` (coordinates: the routing guard
  promises a position never leaves the device)
- any remaining run of ≥ 5 digits → `‹#›` (student/person/file ids)

Unchanged: `screen`, `ext_version`, browser, viewport. Still never sent: the
install id (reports stay unjoinable to the daily count), the host URL, IS page
text, `logError`'s `extra` object.

## Capture

- `src/utils/diagnostics/diagnosticLog.ts` — ring buffer (50) + `cleanMessage`.
  **Imports nothing**, because `logError` feeds it and `logError` is in the
  content script graph (the #266 `document_start` trap). Module-level array,
  not a Zustand slice: the content script has no store and this is not UI
  state; stated in the file header. Memory only, never persisted.
- `logError` records a structured entry (context, status from the error when
  present), then marks the call so the console wrapper does not record it twice.
- `src/utils/diagnostics/consoleCapture.ts` — `installConsoleCapture(source)`
  wraps `console.warn`/`console.error` and listens for `error` /
  `unhandledrejection`. Idempotent. Called **explicitly**, never at import:
  `src/entrypoints/main/main.tsx` (covers extension iframe, Capacitor, dev
  webapp) and inside the content script's `main()` in
  `src/entrypoints/content.ts`. In the content script the `error` listener keeps
  only events whose `filename` starts with `chrome-extension://` — IS's own JS
  errors are dropped.
- Content-script entries reach the iframe through a new `get_diagnostics`
  action on the existing `REIS_ACTION` / `REIS_ACTION_RESULT` request–reply
  (same shape as `refresh_exams`). The collector races it against 1.5 s and
  falls back to app-only entries. Capacitor's `actionHandler` answers
  `get_diagnostics` with `{ entries: [] }` — there is no content script.

## Server (one migration)

`suggestion_attachments`, one row per report:

| column | constraint |
|---|---|
| `suggestion_id bigint` | PK, FK → `suggestions.id` on delete cascade |
| `screenshot bytea` | null, or ≤ 614 400 bytes and starting `\xffd8ff` |
| `diagnostics jsonb` | null, or an array of ≤ 50 and ≤ 32 768 bytes as text |
| `has_screenshot boolean` | generated stored (`screenshot is not null`) |
| `diagnostics_count int` | generated stored |
| `created_at timestamptz` | default now() |

At least one of screenshot/diagnostics must be non-null (else no row). RLS on,
deny-all; `reis_admin` gets select through `get_my_role()` exactly like
`suggestions`; no insert/update/delete grants to anon or authenticated.

`submit_suggestion_v2(…v1 params…, p_diagnostics jsonb default null,
p_screenshot text default null) returns text`, SECURITY DEFINER, one
transaction: v1 validation + flood guard → insert suggestion → insert
attachment. Results:

- `ok` — everything stored
- `ok_without_screenshot` — screenshot refused (malformed base64, too big, not
  JPEG, or the global screenshot cap of 30/hour reached); text and diagnostics
  stored; the student is told
- `rejected` — validation or flood guard (as v1's `false`)

Malformed diagnostics are dropped the same way (the report still lands). v1
`submit_suggestion` is untouched for clients that have not updated.

Retention (90 days or `done`, whichever first):

- `pg_cron` enabled, daily job deleting attachments older than 90 days
- trigger `after update of status on suggestions` → deletes the attachment when
  status becomes `done`
- `submit_suggestion_v2` also runs the 90-day delete on every call, as backup

Before the client depends on it: measure the real API request-size limit with a
~820 KB body against a non-existent RPC (404 = body accepted, 413 = too big).

Applied by hand (`npx supabase db query --linked`) after a local run against
Postgres + PostgREST covering JPEG check, size cap, cascade, the `done` trigger
and the three results.

## Admin inbox

`SuggestionsInbox` (rendered by both `AdminConsole` and `MobileAdminConsole`):

- list read embeds `suggestion_attachments(has_screenshot, diagnostics_count)`
  — never the bytes
- badges: 📎 snímek, "N záznamů"
- "Přílohy" button on a row loads that row's screenshot + diagnostics
  (`adminAuthClient.from('suggestion_attachments').select(...)`), screenshot
  shown as a thumbnail that opens full size, diagnostics as a compact table
- `devSuggestionsStore` gains seeded attachments so dev:web renders it

## Privacy, in this order

1. `PRIVACY.md` and `docs/privacy-policy-app.md`: new row "Report attachments
   (only when you press Send)" — what, retention 90 d / resolved, not linked to
   install id; replace "transmits nothing about a failure" with the
   user-initiated exception
2. `src/test/guards/noStudentDataLeaves.test.ts`: the `suggestions.ts` entry
   note; the "sends no error…" test keeps banning the old telemetry vocabulary
   and adds an assertion that diagnostics reach Supabase ONLY via
   `submit_suggestion_v2` in `src/api/suggestions.ts`; a new test that
   `diagnosticLog.ts` has no imports
3. CLAUDE.md "Error Reporting & Privacy" section updated
4. Gist republished from `docs/privacy-policy-app.md`
5. App Store privacy label and Play Data safety: add Diagnostics (crash/other
   diagnostic data) and Photos (user content), collected, not linked to
   identity, not tracking, purpose App Functionality / support
6. Steps 4–5 happen before a build containing this is released

## Testing (tests first)

- `cleanMessage`: URLs, emails, coordinates, 5+ digits, first line, 200 cap
- ring buffer cap and order; `logError` not double-recorded by the wrapper
- content-script filter on `filename`; `get_diagnostics` action on both
  responders; collector timeout fallback
- image re-encode: output JPEG, ≤ 1600 px, ≤ 600 KB
- `buildSuggestionPayload` / `submitSuggestion` v2 mapping of the three results
- form: checkbox unchecked by default; unchecked → no diagnostics sent;
  removed lines not sent; screenshot ✕ removes it
- inbox: badges from embedded counts, attachments loaded only on demand
- verify-ui: form and inbox at 320/390/430 + tablet, both themes, both trees
