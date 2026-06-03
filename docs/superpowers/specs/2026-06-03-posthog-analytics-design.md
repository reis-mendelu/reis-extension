# PostHog Product Analytics — Design

**Date:** 2026-06-03
**Status:** Approved (design); pending implementation plan
**Branch context:** complements `feat/schedule-first-cold-start` (activation funnel)

## 1. Goal

Add behavioral product analytics so we can answer four questions ahead of the
Fall 2026 growth push:

1. **Activation / onboarding funnel** — do new users reach the "aha" (schedule
   painted) in their first session, and where do they drop off?
2. **Feature usage / prioritization** — which surfaces actually get used, so we
   invest in what matters and cut what doesn't.
3. **Retention / stickiness** — who returns, how often, which features correlate
   with returning.
4. **Reliability / friction** — where users hit dead-ends, empty states, and
   repeated failures (behavioral complement to the existing error telemetry).

## 2. Non-negotiable constraints

These are dictated by the existing privacy posture (`PRIVACY.md`, `CLAUDE.md`)
and Iron Rules:

- **Explicit events only. No autocapture, no session recording, ever.** We never
  record raw DOM clicks or element text on IS Mendelu pages (which render student
  names and grades).
- **No PII leaves the device.** Property values are a fixed, typed set — never
  IS-derived strings (names, file names, grades). Course *codes* are public and
  allowed. PII-safety is structural (typed taxonomy), not regex scrubbing.
- **No `localStorage` / `sessionStorage`** (Iron Rule). PostHog's default
  persistence is never used; identity is derived fresh each load and the opt-out
  flag lives in Chrome Sync.
- **No new bundled secret.** PostHog's project ingestion key is public/write-only
  by design, so no Supabase proxy is required (contrast: Google OAuth).
- **Max 200 lines/file, direct imports, state in Zustand, test-first.**

## 3. Chosen approach

**Hand-rolled HTTP capture client** (chosen over the `posthog-js` SDK and over
extending Supabase). Rationale: the SDK is ~60 KB of mostly-dead weight once
autocapture/recording are off, and trusting SDK defaults to stay safe across
upgrades is a standing risk. A hand-rolled client makes "no autocapture, ever"
**structural** — by construction it can only send what we build. It mirrors this
codebase's existing hand-rolled Supabase RPC + sanitize culture. PostHog's
funnel/retention/cohort UI works fine as long as events + `distinct_id` are
correct, which this guarantees.

## 4. Architecture & data flow

All analytics lives in the **iframe app** (chrome-extension origin), mirroring
the existing `logError → sendTelemetry` single-call-site pattern.

New files under `src/services/analytics/`:

| File | Purpose |
|------|---------|
| `captureClient.ts` | Pure, stateless `postBatch(events)` → POST to PostHog `/batch`. Fully testable with mocked `fetch`. |
| `analytics.ts` | The single call site: `initAnalytics()`, `track(event, props)`, `identify(hashedId)`, `setOptOut(bool)`. In-memory queue + flush on interval/size. < 200 lines. |
| `events.ts` | Typed event-name union + per-event prop types (the taxonomy). Compile-time guard that no free-text/PII prop slips in. |

**Init point:** iframe bootstrap (`hooks/useAppLogic.ts`), after IDB hydration.
Events fired before identity resolves are buffered in memory.

**Content-script events** (IS sync result, ISKAM, Drive backup) have no PostHog
access — identical to telemetry today. They ride a new
`Messages.telemetryEvent(event, props)` (and `IskamMessages` equivalent) over the
**existing** postMessage bridge; `messageHandler.ts` / `iskamMessageHandler.ts`
route it into `track()`. Exactly parallel to the current `telemetryError` bridge.

```
component / store / content-script
        │  track(event, props)            (content script: postMessage bridge)
        ▼
   analytics.ts  ──buffer──▶ flush ──▶ captureClient.postBatch() ──▶ eu.i.posthog.com/batch
        ▲
   identify(hashedId)  (from sync slice, once student info known)
```

## 5. Identity (anon → hashed merge)

- On load, generate a **memory-only anon UUID** (same spirit as the
  error-reporter session id) and buffer events against it.
- When the sync slice exposes student info, compute **SHA-256 of the student ID**
  (reusing the existing daily-active hashing) and call `identify(hashedId)`.
- `identify` emits PostHog's `$identify` event with `$anon_distinct_id =
  <anon UUID>` to merge the anonymous session into the hashed person, sets
  `distinct_id` for subsequent events, and flushes the buffer.
- If identity never resolves in a session (pre-auth / cold start), events remain
  anonymous — still valid for in-session funnel analysis.
- **Opt-out flag stored in Chrome Sync** (settings tier; follows devices).
  `distinct_id` derived fresh each load. No localStorage/cookies.

## 6. Event taxonomy

One event per *kind*, parameterized by properties — not N bespoke events — so
charts and new features slot in without schema churn.

| Event | Properties | Serves |
|-------|-----------|--------|
| `app_opened` | `host`, `cold_start`, `lang`, `theme`, `is_touch`, `is_narrow` | retention, daily-active, phone-vs-desktop |
| `first_data_rendered` | `ms_since_open` | activation "aha" (schedule painted) |
| `handshake_done` / `handshake_timed_out` | — | funnel + friction |
| `feature_opened` | `feature: 'calendar'\|'exams'\|'file_drawer'\|'drive_backup'\|'notes_editor'\|'iskam'\|'success_rate'\|'erasmus'\|'tutoring'` | feature usage / prioritization |
| `drive_backup_completed` | `files` (count) | feature usage |
| `notes_card_created` | — | feature usage |
| `file_opened` | — | feature usage |
| `sync_failed` | `step` | friction |
| `empty_state_shown` | `feature` | friction |

**Every event** also carries `extension_version`, `browser_name`,
`browser_version` (reused from telemetry context). Property value sets are fixed
unions in `events.ts`; **never** pass IS-derived content strings.

## 7. Config, hosting, permissions

- **PostHog EU Cloud** — `https://eu.i.posthog.com` (EU data residency for EU
  students).
- Project ingestion key (`phc_…`, public/write-only) shipped via
  `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`. No proxy/secret.
- Add `https://eu.i.posthog.com/*` to `host_permissions` and CSP `connect-src`
  in `wxt.config.ts`.

## 8. Consent & PRIVACY.md

- **Combined opt-out toggle, default on**, legitimate-interest basis — consistent
  with the existing error-reporting opt-out. Surfaced as one **"Usage analytics &
  diagnostics"** toggle in the profile/settings panel; it gates both this
  analytics path and (going forward) error reporting.
- **PRIVACY.md updates (required, part of implementation):**
  - Expand §3 ("Anonymous Usage Analytics") to describe behavioral product
    analytics via PostHog (EU), the explicit-events-only model, the hashed-ID
    pseudonymous identity, and that no IS content is sent.
  - Add **PostHog** (`eu.i.posthog.com`) to §"Third-Party Access".
  - Add the combined analytics/diagnostics opt-out under §"User Control".

## 9. Testing (TDD)

Failing tests first, then implementation:

- `captureClient`: payload shape (PostHog `/batch` schema), batching, `fetch`
  error handling. Mocked `fetch`.
- `analytics`: buffers events pre-identity; flushes on `identify`; emits the
  anon→hashed `$identify` alias exactly once; `setOptOut(true)` drops all events
  (queued and subsequent).
- Bridge: `telemetryEvent` message routes into `track()` in both
  `messageHandler` and `iskamMessageHandler`.

Vitest + happy-dom. Then `npm run build`, `npm run typecheck`, `npm run lint`.

## 10. Out of scope (YAGNI)

- PostHog feature flags, A/B testing, surveys.
- Session recording / heatmaps / autocapture.
- Any per-component instrumentation beyond the taxonomy in §6 (add events later
  as questions arise).
- Server-side or content-script-direct ingestion (all egress is the iframe).
