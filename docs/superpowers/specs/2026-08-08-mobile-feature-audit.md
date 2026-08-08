# Mobile feature audit — does it work, and should it be here?

Every feature reachable in the phone UI, checked twice: does it actually work on
a phone, and does it earn its place there. Desktop parity is not a reason for
anything to exist in this app.

Method: read every screen and sheet in `src/components/mobile/`, trace each to
the transport and hooks behind it, then drive the running webapp at 320/390/430
with a three-week schedule fixture. Findings marked **fixed** landed on
`worktree-mobile-feature-audit`; the rest are open with a recommendation.

## What was broken

### 1. The day switcher pointed at the wrong week — FIXED

`DayChips` anchored on `schedule.weekStart`. The name promises "Monday of the
fetched week"; `syncSchedule` writes it as the **semester start** (Feb 1 /
Sep 1). A student opening the app in April was offered five days in February,
labelled Mon–Fri while starting on a Sunday, and could not reach the current
week at all. The app's home tab, and its single most-used control.

It survived because nothing exercised it. Every test passed `weekStart: null`,
which falls back to the selected day's own week — the correct behaviour by
accident — and the mock dataset sets it to a real Monday.

The week is derived from the selected day now, and arrows move a week at a
time. That needs no fetch: `syncSchedule` already stores the whole semester.

### 2. Saturday teaching was unreachable — FIXED

MENDELU teaches combined-study cohorts on Saturdays and the desktop grid
carries all seven days, but the phone row was a fixed Mon–Fri and the agenda
follows the selected day. A weekend day now joins the row when it holds a
lesson, and only then.

### 3. The selected day was unreadable — FIXED

White on the lime `--color-primary`: 2.29:1, below AA. Never rendered before,
because no chip could be selected while the row pointed at February. Now uses
the tint `BottomNav` marks its active tab with.

> **Open, not fixed:** `--color-primary` (#79be15) with a white
> `--color-primary-content` fails AA **everywhere it is used**, desktop
> included. That is a theme-token decision, not a mobile one — it wants fixing
> deliberately rather than as a side effect of this work.

### 4. Signing out could never sign you out — FIXED

The settings row had been there since day one and could only ever raise
"signing out isn't available in the app yet". The extension's sign-out is
DOM-bound to IS's own logout form in the host page, and the app has no host
page.

What grants this device access is the stored UISAuth token, so removing it is a
real sign-out. The half that is easy to miss: the login WebView shares the app's
cookie jar, so leaving the cookie means the next sign-in is answered with the
dashboard and the student is silently returned to the same account.

Verdict on existence: **keep and implement**, not remove. A student on a shared
or lost phone must be able to revoke a device holding their grades and a live
session.

### 5. The app could not report a single error — FIXED

`isContextAlive()` read `chrome.runtime.id` and treated its absence as an
orphaned extension iframe. The app has no `chrome` object, so **every error it
ever produced was dropped before it reached Supabase**.

This one is worse than a lost feature: a device run showing "zero telemetry"
was read as evidence of health, and it never meant anything. Two follow-ons
fixed with it — reports carried version `0.0.0` (the exact marker used for
"orphaned, unactionable") and could not be told apart from desktop ones, since
the Android WebView calls itself Chrome and the iOS one Safari.

### 6. The calendar could not be seen locally out of season — FIXED

A July snapshot has an empty schedule, so the home tab sat in its empty state
and no local harness could show a populated week. That blind spot is how #1
survived review. `rebaseFixture` now projects schedule lessons as well as exam
terms, and `npm run dev:web:week` serves a three-week fixture.

## What works

Verified by tracing the transport and by driving the running app.

| Feature | State |
|---|---|
| Calendar: agenda, gaps, now/next, hide occurrence | works |
| Exams: groups, terms, register/unregister, classmates | works (empty out of season) |
| Subjects: credit ring, semester card, averages, study plan | works, real data |
| Subject drawer: files, classmates, success rate, syllabus, záznamník | works |
| Map: Leaflet canvas, floors, rooms, draggable sheet, events | works |
| Student: people search, IS page search | works (live from IS on device) |
| Sheets: docs, person, event, notifications, profile, eduroam | works |
| Outlook sync toggle | works — routed through `fetchWithAuth`, doubled `Content-Type` already fixed |
| Feedback form | works — Discord reflects the WebView origin in CORS (verified by preflight) |
| External links | works — `installExternalLinkHandler` is installed at boot and catches every `target="_blank"` |
| Google Drive backup | correctly **absent** on mobile |
| Library study-room booking | correctly **hidden** on mobile |

## What should not be here

### The 95-link IS portal directory — recommend cutting to a handful

The Student tab carries `pagesData`: **95 links across 13 categories**, every
one opening IS's desktop site in an in-app browser on a 390px screen. The
categories include Herna (IS's arcade), Správa IS, Dokumentace, Personalizace,
Nastavení IS and Ochrana údajů — IS administration, on a phone.

This is desktop parity for its own sake. The extension lives *inside* IS, where
a link tree is a natural shortcut; the app does not, and each tap is a context
switch into an interface built for a mouse.

Recommendation: keep the handful a student actually opens on a phone (E-index,
Portál studenta, Moji spolužáci, Informace o studiu) and drop the rest. The
search box stays useful for the long tail only if the long tail is worth
opening on a phone — it mostly is not.

### The ISKAM shortcut — recommend removing

`ShortcutGrid` links to `webiskam.mendelu.cz`. ISKAM is Shibboleth, a second
sign-in the app does not have, and is documented as out of scope for the first
release. The card promises a feature the app does not ship and lands the
student on a login they cannot complete with their IS session.

(Its comment also says "the four Student-hub shortcut cards" and there are
three — eduroam moved to settings.)

### Erasmus in a sheet — recommend gating

`ErasmusSheet` hosts the desktop `ErasmusPanel` wholesale, and its own comment
concedes the Learning Agreement tables and Europe map "stay cramped on a
phone". It is a shortcut card for every student, but only relevant to those on
an exchange. Recommendation: show the card only when the student has Erasmus
data, and treat the cramped tables as the accepted limitation they are.

### Study plan in a sheet — keep

Same pattern (desktop `StudyPlanPage` in a full sheet) but the content is a
list, which survives a narrow screen. No change.

## Smaller things left open

- **`EventDetailSheet` resolves a lesson by `id` alone** across the whole
  semester (`schedule.find(l => l.id === sheet.eventId)`). If IS reuses a
  lesson id across weeks — and `fetchDualLanguageSchedule` merges on
  `id_date_startTime`, which suggests it does — the sheet describes the first
  occurrence and "hide this occurrence" records the wrong date. Passing the
  day alongside the id is correct under either semantics. Not changed here:
  no real multi-week sample was available to confirm the id semantics, and the
  hide-by-id predicate is shared with desktop.
- **`schedule.weekStart` is now vestigial.** Nothing reads it since #1. Leaving
  a field whose name misdescribes its contents invites the same bug back;
  either delete it or rename it to `semesterStart`.
- **`pushSheet` does not dedupe.** Two taps on the same shortcut stack two
  identical sheets. Only observed with the backdrop parked off-screen, so this
  is a note rather than a finding.
- **The header date truncates at 320px** ("Sobota 8…."). Pre-existing, degrades
  gracefully, not flagged by the geometry checks.
