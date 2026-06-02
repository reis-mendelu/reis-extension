# Schedule-First Cold Start — "Win the First 30 Seconds"

**Date:** 2026-06-02
**Status:** Design approved, pending implementation plan
**Goal owner:** committed direction for the Fall 2026 growth event (shot at 500+ users)

## Why

Next semester a campus event is a real chance to onboard 500+ students in a short
window. A cold-start product gets one impression per student: they install, open it
once, and decide in ~30 seconds whether to keep it. The single most important thing
is that the first open delivers obvious, personal value immediately.

Today it does the opposite. The audit found three concrete defects in the first 30
seconds:

1. **Commitment before value.** `WelcomeModal` step 2 — the first interactive screen
   after the greeting — asks a brand-new student to (a) set up Outlook mobile calendar
   sync and (b) connect their Google Drive, *before they have seen a single one of
   their own classes.* These are heavy, external, trust-demanding asks with no payoff
   yet shown.
2. **Slow time-to-first-value, self-advertised.** Onboarding copy literally says
   `"Sync trvá přibližně 15 min."` ("Sync takes ~15 minutes"). The reward is framed as
   a 15-minute wait.
3. **The hook is gated behind the slow batch.** In `syncAllData()`, the schedule
   (`fetchFullSemesterSchedule()`) is fetched in parallel with 7 other things, but the
   first real `syncUpdate` only fires after **all 8** settle. The schedule could paint
   in 1–3s; instead it waits behind the slowest fetch in the batch.

**The hook** (decided): the student's **real class schedule for this week**. Universal,
personal, already the default view, and the fastest single thing to fetch.

## Approach

Chosen approach: **A+** — schedule-first paint (the surgical sequencing fix) plus an
honest, non-broken first-run state. Approach C (cached-shell instant paint) was
explicitly rejected: it serves returning users, not the event's cold-start crowd, and
adds complexity for no first-open payoff.

Design principle: keep blast radius small. The schedule already streams into the iframe
via partial `syncUpdate`s — the iframe needs almost no change. Do **not** touch the
fragile Drive/OAuth subsystems or the brittle IS parsers.

## Components

### 1. Schedule-first paint — `src/injector/syncService.ts` (content script)

Decouple the schedule from the 8-way `Promise.allSettled` batch. The moment
`fetchFullSemesterSchedule()` resolves, emit a **schedule-only** update:

```
sendToIframe(Messages.syncUpdate({ schedule, isSyncing: true, lastSync }))
```

before awaiting the rest of the batch. The existing post-batch `syncUpdate` (currently
~line 163) stays unchanged for exams/subjects/study plan/etc.

The iframe **already supports** partial schedule updates: `useAppLogic` (~line 117)
does `if (r.schedule) useAppStore.getState().setSchedule(...)` on any update. So this is
a content-script-only sequencing change.

To make ordering testable, extract a small emit seam (e.g. a function that takes the
schedule and emits the early update) rather than inlining the `sendToIframe` call.

**Error handling:** if `fetchFullSemesterSchedule()` rejects, do not emit an early
schedule update; fall through to the existing batch path, and let the first-run state
(component 2) surface a retry rather than spinning forever.

### 2. Honest first-run state — sync slice + Calendar (iframe)

- **`isFirstSync` signal** (`src/store/slices/createSyncSlice.ts` or derived in the
  calendar data hook): true when a sync is in progress **and** no schedule is present
  in the store yet. Becomes false the instant a schedule arrives.
- **Calendar cold state** (`src/components/WeeklyCalendar/`): while `isFirstSync` holds,
  render a **branded "building your week"** state instead of the generic skeleton
  (which reads as "broken" to a stranger). The instant the schedule arrives, render the
  real week; let exams/files/etc. stream in behind with quiet per-section loading.
- **Backstop:** the existing 10s `handshakeTimedOut` remains. Add a clear
  "couldn't load your schedule — retry" path for the *failure* case (component 1's
  reject branch), distinct from the still-loading case.

### 3. Defer commitment asks — `src/components/Onboarding/WelcomeModal.tsx`

- Step 1 (welcome + language picker) stays.
- **Remove Outlook and Google Drive asks from the blocking first-run flow.**
- **Google Drive** ask: already lives in the file drawer header
  (`DriveBackupStatus.tsx`) — rely on that; no proactive first-run prompt.
- **Outlook** ask: resurfaces as a **dismissible nudge inside the Calendar view**,
  shown once the schedule has painted ("Want this on your phone? Sync to Outlook.").
  Contextual, non-blocking, dismiss-once (persist dismissal in IDB `meta`, consistent
  with `welcome_dismissed`).

### 4. Honest copy — `src/i18n/locales/{cs,en}.json`

- Remove / replace `onboarding.syncCoffeeBreak` ("Sync trvá přibližně 15 min.").
- Add progressive, truthful status strings, e.g. *"Your schedule's ready — still
  loading materials…"* and the calendar Outlook nudge strings (cs + en).

## Data flow (cold start, new user)

```
install → open iframe
  → useAppLogic: signalReady() + requestData('all')
  → content script syncAllData() starts
      → fetchFullSemesterSchedule() resolves FIRST
          → sendToIframe(syncUpdate{ schedule, isSyncing:true })   ← NEW early emit
              → iframe setSchedule() → isFirstSync flips false → real week paints  ✅ (~1–3s)
      → rest of batch settles → sendToIframe(syncUpdate{ exams, subjects, ... })
      → Phase 3 (files/classmates/zaznamnik) streams in behind
  → Calendar shows dismissible Outlook nudge (post-paint)
  → Drive ask remains available in file drawer (no first-run prompt)
```

## Testing (TDD — failing test first, per Iron Rules)

- **`syncService`**: assert a schedule-only `syncUpdate` is emitted **before** the full
  batch `syncUpdate`. (Drives the emit-seam extraction.)
- **sync slice / calendar data**: assert `isFirstSync` derivation — syncing + no
  schedule ⇒ true; schedule present ⇒ false.
- **`WelcomeModal`**: assert no Drive/Outlook ask renders in the blocking first-run
  path (step 2 no longer gates value).
- **Calendar Outlook nudge**: assert it renders only after schedule present, and that
  dismissal persists.

## Visual design (decided)

Storyboard mockup: `2026-06-02-schedule-first-cold-start-mockup.html` (companion file).
Aesthetic direction: **calm competence** — restraint, not a bold redesign. Built entirely
in DaisyUI semantic classes + motion/react (no custom CSS, no new fonts, Inter throughout,
mendelu-dark default). MENDELU green (`#79be15`) is the single confident accent; everything
else stays quiet. **The one memorable moment is the timetable assembling itself** — the wait
reads as construction, not loading.

The four frames of the journey:

1. **Welcome (0s)** — one confident screen: logo, title, CZ/EN segmented toggle, single
   "Jdeme na to →" primary button, reassurance caption ("nothing logged in, runs in your
   browser"). **No Outlook/Drive ask.**
2. **Building (0–2s)** — branded header with a pulsing green dot + "Sestavujeme tvůj
   týden…", an honest thin progress bar, and a shimmering timetable skeleton. Never the
   generic skeleton.
3. **Your week (~2s) ✦** — the hook lands: real class cards **cascade in** (staggered
   `rise`, lecture green / seminar blue / exam red) while an honest *"načítám materiály…"*
   chip shows the rest still streaming. This is the "I'm keeping this" beat.
4. **Post-paint nudge** — the deferred Outlook ask returns **in context** as a dismissible
   card inside the calendar; Drive ask stays in the file drawer.

Motion budget (one well-orchestrated moment, not scattered micro-interactions): ping dot
on the building header, a single staggered cascade on first schedule paint, a breathing dot
on the streaming chip. Respect `prefers-reduced-motion`.

## Out of scope (YAGNI)

- Cached-shell / offline-instant first paint (Approach C) — returning-user payoff only.
- Any change to Drive/OAuth or IS parsers.
- Broader retention instrumentation / funnel analytics — a separate direction, not this
  spec.

## Risks & mitigations

- **Schedule fetch is itself slow for some students.** Mitigation: the branded
  "building your week" state is honest and non-broken; the 10s backstop and retry path
  prevent a stuck appearance. This spec improves *perceived* and *actual* time-to-first
  value but does not optimize the IS fetch itself.
- **Removing onboarding asks lowers Outlook/Drive adoption.** Accepted trade-off:
  retention of the core loop outranks attach-rate of secondary features at the event.
  The contextual nudges recover discovery without blocking value.
- **Partial-update races** (early schedule then batch overwrites). Low risk: the batch
  update carries the same schedule; `setSchedule` is idempotent for identical data.
