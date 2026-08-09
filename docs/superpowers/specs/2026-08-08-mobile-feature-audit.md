# Mobile feature audit — does it work, and should it be here?

Every feature reachable in the phone UI, checked twice: does it actually work on
a phone, and does it earn its place there. Desktop parity is not a reason for
anything to exist in this app.

Method: read every screen and sheet in `src/components/mobile/`, trace each to
the transport and hooks behind it, then drive the running webapp at 320/390/430
with a three-week schedule fixture. Findings marked **fixed** landed on
`worktree-mobile-feature-audit`; every product call was put to the owner and
the decision recorded beside it.

**A second pass ran on real hardware** (A001 handset, Android 16, live IS
session) over CDP — `adb forward` to the WebView, then `Runtime.evaluate` to
read the real DOM. It is the reason findings 7 and 8 exist: both are invisible
in the webapp, which cannot reach IS at all, and both look like ordinary empty
states rather than failures. **A silent fallback is not evidence a feature
works.** Anything below that says "device-verified" was measured that way, not
inferred from a screenshot.

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

### 7. Nothing in the app answers `REIS_FETCH` — FIXED for photos, OPEN for events

The root cause of a whole class, found on device. `fetchViaProxy` posts a
`REIS_FETCH` to `window.parent`; in the extension the content script answers it.
The app has no content script, and `installMobileActionHandler` answers
**`REIS_ACTION` only** — so every caller without its own
`getPlatform().kind === 'capacitor'` branch posts into the void, waits the full
30 s `REQUEST_TIMEOUT`, and rejects. Every one of these callers has a fallback,
so the failure is silent by construction.

Measured before touching anything: zero `<img>` in the live DOM, and no reply to
a `REIS_FETCH` probe after 5 s, while a native `CapacitorHttp` GET of the same
`foto.pl` URL returned `200 image/jpeg`.

Every caller audited:

| Caller | Reaches the phone? | State |
|---|---|---|
| `api/client.ts` (`fetchWithAuth`), `fetchAuthedBytes` | yes | already branch natively — fine |
| `api/personPhoto.ts` | yes — every avatar in the app | **FIXED** — `api/capacitorPhoto.ts`, device-verified 20 real JPEGs |
| `api/events.ts` → `useEventsFeed` → map Akce tab | yes — the map's only content | **OPEN**, needs a product decision |
| `api/menu.ts` | no — only `WeeklyCalendarHeader`, desktop | not a mobile bug |
| `createErasmusSlice` | no — Erasmus was cut from mobile | moot |

Two things the device measurement changed about the photo fix, neither of which
could have been reasoned out:

- It is **not** built on `fetchIsBinary`, which looks like the same job. That
  function treats a non-image response as a lapsed session and calls
  `notifySessionExpired` — one photoless classmate would have signed the student
  out.
- IS answers an unknown person id with **`200 image/jpeg` and a zero-byte body**,
  not a 404. That would have become `data:image/jpeg;base64,` and rendered a
  broken-image glyph, strictly worse than the fallback icon. An empty body now
  rejects.

### 8. The map's events feed has never worked in the app — OPEN

Same root cause. `Žádné akce` on the phone is not "no events this week"; the
request is never answered. The map sheet's only content, on the tab it opens on.

**Needs a decision, and "cut it" is a real answer** — this is exactly the
question this audit exists to ask. Either wire `api/events.ts` natively the way
photos now are, or drop the events tab from mobile and let the sheet be the
building/room list it already earns. Not fixed here because it is a product
call, not a defect to be quietly patched.

## What works

Verified by tracing the transport and by driving the running app.

| Feature | State |
|---|---|
| Calendar: agenda, gaps, now/next, hide occurrence | works |
| Exams: groups, terms, register/unregister, classmates | works (empty out of season) |
| Subjects: credit ring, semester card, averages, study plan | works, real data |
| Subject drawer: files, classmates, success rate, syllabus, záznamník | works; classmate photos were dead until finding 7 |
| Map: Leaflet canvas, floors, rooms, draggable sheet | works |
| Map: campus events feed | **broken** — see finding 8; the empty state is a lie |
| Student: people search, IS page search | works (live from IS on device) |
| Sheets: docs, person, event, notifications, profile, eduroam | works |
| Outlook sync toggle | works — routed through `fetchWithAuth`, doubled `Content-Type` already fixed |
| Feedback form | works — Discord reflects the WebView origin in CORS (verified by preflight) |
| External links | works — `installExternalLinkHandler` is installed at boot and catches every `target="_blank"` |
| Google Drive backup | correctly **absent** on mobile |
| Library study-room booking | correctly **hidden** on mobile |

## What should not be here

Each of these was put to the owner; the decision is recorded with it.

### The 94-link IS portal directory — reviewed, KEPT

The Student tab carries `pagesData`: **94 links across 13 categories**, every
one opening IS's desktop site in an in-app browser on a 390px screen. The
categories include Herna (IS's arcade), Správa IS, Dokumentace, Personalizace,
Nastavení IS and Ochrana údajů — IS administration, on a phone.

This is desktop parity for its own sake. The extension lives *inside* IS, where
a link tree is a natural shortcut; the app does not, and each tap is a context
switch into an interface built for a mouse.

**Decision: kept, behind a disclosure row.** Every link stays — the search box
makes the long tail cheap to ignore, and an occasional deep link beats a dead
end for a student who needs an obscure IS page on a phone. What changed is that
they no longer sit open on the tab, burying the two shortcuts opened daily
under a list nobody scrolls. Searching still reaches all 94 without expanding
anything, which is what makes hiding them safe.

### The ISKAM shortcut — reviewed, KEPT

`ShortcutGrid` links to `webiskam.mendelu.cz`. ISKAM is Shibboleth — a second
sign-in the app does not have — and is out of scope for the first release, so
the card cannot become a real integration soon.

**Decision: kept, and now marked as what it is.** It is a browser convenience,
not a promise of an integration — and nothing said so. It carries the same
external-link icon every other row that leaves the app carries, and it opens in
the real browser rather than the app's WebView, which is where a separate
sign-in belongs.

(Its comment claimed "the four Student-hub shortcut cards" while rendering
three; now two, and the comment says why.)

### Erasmus in a sheet — REMOVED

`ErasmusSheet` hosted the desktop `ErasmusPanel` wholesale, and its own comment
conceded that the Learning Agreement tables and the Europe map "stay cramped on
a phone". It was a shortcut card shown to every student for something only
exchange students use.

**Decision: removed from mobile entirely** — sheet, card, sheet kind and
strings. It remains on desktop, where the tables have the width they need.
Gating it on having Erasmus data was considered and rejected: a surface that
does not work on a phone should not be shown to a smaller audience, it should
not be shown.

### Study plan in a sheet — keep

Same pattern (desktop `StudyPlanPage` in a full sheet) but the content is a
list, which survives a narrow screen. No change.

## Smaller things

Fixed here unless marked otherwise.

- **`EventDetailSheet` resolved a lesson by `id` alone** across the whole
  semester. `fetchDualLanguageSchedule` merges on `id_date_startTime`, which
  says the id does not identify an occurrence, so the sheet could describe the
  first week's copy and "hide this occurrence" record its date — the lesson the
  student wanted gone stayed. **Fixed:** the tapped day travels with the id and
  the lookup matches on both, with a fallback to the id alone so sheets pushed
  before this still open. Correct under either id semantics, so no IS sample
  was needed. (The hide-by-id predicate itself is shared with desktop and
  untouched.)
- **`schedule.weekStart` was vestigial** once #1 stopped reading it. **Fixed by
  deletion** — the store field, the hook's return, the IndexedDB write and the
  legacy migration branch. A field whose name misdescribes its contents is how
  this bug happened once already.
- **`pushSheet` stacked same-kind sheets — FIXED.** Filed here as a note, then
  hit for real on device: tapping a second classmate while the first one's card
  was open put two person cards on screen, the new one sliding up over the one
  it meant to replace. A push onto a sheet of the **same kind** now swaps in
  place — one store update, so no frame renders both, and `SheetHost` keys by
  index so React reuses the instance and only changes props. The sheet
  underneath is untouched, so back still returns to whatever opened the first
  card. Fixed in the store rather than at the call site: no caller can see the
  stack, and the same was true of every sheet kind.
- **A classmate row carried a truncated programme code — FIXED.** `studyInfo`
  rendered as `PEF B-OI-ZBOI prez [se…`, clipped mid-word, and the width it took
  pushed the name onto two lines. Dropped on the phone (`showStudyInfo={false}`),
  kept on desktop where there is room.
- **Tapping a classmate opened a second, weaker person view — FIXED.** It landed
  in `ClassmatePersonDrawer` — no roles, no office, no phone, no map button — so
  the same student looked different depending on whether you reached them from
  search or from a seminar roster. The row hands the tap up now and the phone
  routes it to the `PersonSheet` search already opens. Both changes are opt-in
  props, matching how `showIsBacklink` already splits this shared component.
- **The map sheet rendered a one-tab segmented control — FIXED.** Knihovna is
  hidden on mobile and Budova needs a selected building, so the default expanded
  sheet was a track plus a white selected pill framing the only thing you could
  pick. The row could not simply go — it carries `touch-none` and the drag
  handlers, and is the nearest grab surface for collapsing a 70vh sheet — so it
  is a plain heading whose tap collapses, reverting to a real tablist when a
  building gives it a second tab.
- **`npm run verify:ui --view <x>` does not reach the phone tree.** It seeds
  `meta.reis_current_view`, which the desktop tree reads; the phone routes on
  `mobileTab`, so every run measures whatever tab the app opened on. The
  calendar runs in this audit were valid because calendar is the start
  destination — a `--view student` run silently measured the calendar. Worth
  teaching the script `mobileTab`, or the next screen "verified" this way will
  not have been.
- **The header date truncates at 320px** ("Sobota 8…."). Pre-existing, degrades
  gracefully, not flagged by the geometry checks.
