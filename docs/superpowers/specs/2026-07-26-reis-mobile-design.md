# reIS Mobile — Design

**Date:** 2026-07-26
**Status:** Approved, ready for planning
**Source design:** `reIS Mobile Prototype.dc.html` (Claude Design project `e0292f9a-b404-4c60-9d39-035168afc31d`)

## Summary

Replace reIS's thin responsive mode with a phone-native UI built to the approved
mobile prototype: a five-tab bottom nav (Kalendář, Zkoušky, Předměty, Mapa,
Student) plus a family of bottom sheets.

The work is a **re-layout, not a re-platform**. Nearly every element of the
prototype maps to data reIS already fetches, through hooks that are already
extracted. No new API surface, no new sync path, and — explicitly — no parser
changes.

## Goals

- A phone layout that matches the approved prototype's information architecture
  and visual language.
- Full feature parity with what reIS ships today on the IS host, with nothing
  silently dropped.
- Packaging-agnostic: no new code assumes `chrome.*` or the extension shell, so a
  future native wrapper is an addition rather than a rewrite.
- Every new file well under the 200-line convention.

## Non-goals

- Any native shell, PWA, or store submission. Delivery vehicle is deliberately
  deferred (see *Deferred decisions*).
- ISKAM's phone layout — separate app, separate spec.
- Any change to how desktop reIS looks or behaves. Three shared files are
  touched, none of them on a desktop code path: two pure component extractions
  (`MapSidePanel`, `SubjectFileDrawerContent`), and the removal of phone-only
  `touch:` styles and the old `<MobileBottomNav>` mount.

## Context and constraints

reIS reaches IS Mendelu data only because its content script runs on
`is.mendelu.cz` with the user's cookies. `fetchWithAuth`
(`src/api/client.ts`) has exactly two modes: iframe (postMessage proxy) and
direct (cookies). Phones do not run Chrome extensions, so a native reIS would
need a third mode. **That question is out of scope here.** This spec builds the
UI, and deliberately keeps it vehicle-agnostic so the question can be answered
later without rework.

A mobile mode already exists but is thin: a viewport slice in
`src/components/AppShell.tsx`, a `touch:` Tailwind variant used by five files,
and `MobileNav/{MobileBottomNav,MobileNavSheet,MobileProfileSheet}.tsx`. The
actual screens are desktop layouts squeezed narrow. This work replaces that.

### Design system

`_ds/.../colors_and_type.css` states its own provenance: *"Source of truth:
reis-mendelu/reis-extension tailwind + daisyUI theme… Prefer DaisyUI semantic
classes in product code."* The design system is **derived from** the repo's
Tailwind theme, not a parallel system. The Iron Rule "NO custom CSS — use DaisyUI
semantic classes" therefore holds unchanged.

Tokens round-trip: `--color-surface-*`, `--color-content-*`,
`--shadow-{card,popup,drawer}` all exist in `src/index.css`'s `@theme`, and the
themes `mendelu-dark` (default) + `mendelu` match.

Two deltas:

- **DM Sans.** The prototype's identity is a two-face pairing — DM Sans for
  display, Inter for UI. The repo already ships `public/fonts/dm-sans-*.woff2`
  but nothing loads them. **Decision: adopt DM Sans for display type on mobile
  only.** Desktop stays Inter-only until someone decides otherwise; the split is
  accepted and temporary.
- **Off-scale sizes.** The prototype uses 13.5px / 12.5px / 11.5px. **Decision:
  snap to the nearest DS scale step** (`--text-sm` 14, `--text-xs` 12,
  `--text-2xs` 10). Pixel-exact matching would require per-element custom CSS,
  which the Iron Rules forbid.

## Architecture

### Single branch point

`App.tsx` already calls `useAppLogic()`, which owns IDB hydration and the
`REIS_READY` handshake. That call stays unconditional; the branch follows it:

```tsx
function App() {
  const s = useAppLogic();          // unchanged — one hydration path
  const isPhone = usePhoneViewport();
  if (isPhone) return <MobileApp logic={s} />;
  return ( /* existing desktop tree, untouched */ );
}
```

Nothing below `MobileApp` re-checks the viewport. `Sidebar`, `AppMain` and
`AppOverlays` are not modified.

`resolvePhoneViewport({ isTouch, isNarrow, override })` is a pure, unit-tested
function in `src/utils/`. `usePhoneViewport()` is a thin selector hook that reads
`isTouch` / `isNarrow` from the viewport slice and `devPhoneOverride` from the
mobile UI slice and calls it — `isPhone` is **derived, never stored**, so there
is no second source of truth to drift. Keeping the rule in one tested place is
what makes R1's dev override and E2E assertion possible.

`MobileApp` receives the `useAppLogic()` result as `logic` (for `currentDate`,
`selectedSubject`, `searchPrefillRef` and the subject-open handler) and reads
everything else from the store directly. It does **not** receive desktop-only
props such as `dateRangeLabel` or the week-navigation callbacks.

**`MobileApp` must mount its own `<Toaster position="top-center" />`.** Today
that component sits inside `App.tsx`'s desktop return; the early return would
otherwise leave the phone branch with no toast host, silently breaking every
confirmation in the prototype.

### Module layout

`src/components/mobile/`:

| Path | Contents |
|---|---|
| `MobileApp.tsx` | screen router + `<BottomNav>` + `<SheetHost>` |
| `nav/BottomNav.tsx` | the five expanding pills |
| `screens/` | `CalendarScreen`, `ExamsScreen`, `SubjectsScreen`, `MapScreen`, `StudentScreen` |
| `screens/calendar/` | `NowNextCard`, `DayChips`, `DayAgenda`, `AgendaEvent`, `GapMarker` |
| `screens/exams/` | `ExamTimeline`, `ExamGroup`, `ExamCard`, `TermRow` |
| `screens/subjects/` | `CreditRing`, `SemesterCard`, `AverageAccordion` |
| `screens/map/` | `MapSheet`, `FloorSwitcher` |
| `screens/student/` | `StudentSearch`, `ShortcutGrid`, `PageGroupList` |
| `sheets/` | `SheetHost` + the ten sheets below |
| `primitives/` | `Sheet`, `SheetHeader`, `Card`, `Chip`, `SectionLabel`, `Accordion`, `Toggle` |

### Shell/content split

Mobile owns **shells** — screen scaffolds, navigation, sheet containers.
**Content is imported, never copied.** These render inside mobile shells
unchanged: `FileList`, `ClassmatesTab`, `SyllabusTab`, `ZaznamnikTab`,
`MapCanvas`, `FloorStack`, `LibraryRoomSection`, `LibrarySlotPicker`, `EventRow`,
`EventRsvp`, `SearchResultItem`, `ErasmusPanel`.

Two components currently assume desktop chrome and need a presentational part
extracted (a pure move, no behaviour change):

- `MapSidePanel` → its library and event sections, so both panels import them.
- `SubjectFileDrawerContent` → its tab-bar/body split.

This is the only refactoring the design asks for, and it improves the desktop
side too.

### State

One new slice, `src/store/slices/createMobileUiSlice.ts`, owning **navigational**
state only:

- `activeTab: 'calendar' | 'exams' | 'subjects' | 'map' | 'student'`
- `selectedDayIso`
- a **sheet stack** (`push` / `pop` / `replace`)
- `mapSheetState: 'peek' | 'expanded'`, `mapTab: 'akce' | 'knihovna' | 'budova'`
- `devPhoneOverride` (dev-only, see R1)

A stack rather than a flat flag, because the prototype genuinely nests — Student
→ person sheet, Subjects → drawer → confirm — and it gives Android back-button
handling for free later.

Purely-local disclosure state (which exam group is expanded, `avgOpen`, `vtOpen`)
stays in component `useState`, matching how `MobileBottomNav` already handles
`activeSheetId`. The "all state lives in Zustand slices" Iron Rule governs shared
app state, not every accordion.

**Toasts reuse what exists.** `App.tsx` already mounts sonner's
`<Toaster position="top-center">`, which is exactly the prototype's toast. No new
toast system.

### The `Sheet` primitive

Ten sheets share identical behaviour: backdrop fade, `sheetUp` slide, drag
handle, tap-outside-to-close, and one of two heights (full-height `top-[70px]` /
`top-[90px]`, or content-height anchored to the bottom). One primitive, one
`SheetHost` rendering the stack. Confirm sheets layer above at a higher z-index,
as in the prototype.

## Screens

Every row is wiring to existing data unless marked **new**.

### Kalendář (default tab)

Header: date, "Ahoj, {jméno}", avatar → Profile sheet, bell → Notifications
sheet. "Teď běží" hero: current class, elapsed bar, "konec za N min", "Pak: …",
and "Trasa →" deep-linking `MapScreen` to the next room. Five day chips. Day
agenda with gap markers, or the "Nic nemáš, pohodička" empty state. Tapping an
event opens `EventDetailSheet`.

*Data:* `useSchedule`; `useNotificationFeed` + `useDeadlineAlerts` for the bell
badge, with deadline alerts also rendering as cards under the hero.
**New (pure fns):** `nowNext`, `dayAgenda`.

### Zkoušky

Header with registered count. Horizontal timeline of registered terms.
Collapsible groups, each an `ExamCard`; expanding shows term rows with
Přihlásit / "tvůj termín" / "obsazeno" (from `term.full` or `capacity`) and a
**working watch button** where `term.watchdogUrl` is present. Registered cards
show "X spolužáků na tomto termínu" and Odhlásit. Register and unregister both
route through `ConfirmSheet`.

*Data:* `useExams`, `useExamClassmates`, `useExamNote`, `triggerWatchdog`.
**New (pure fn):** `examTimeline`.
**New (shared hook):** `useWatchdog(term)` — extracted from
`TermBuiltinActions.tsx` so desktop and mobile share one implementation of the
optimistic-arm / `triggerExamsRefresh` cycle rather than duplicating it.

### Předměty

Credit ring (X/Y kreditů plus this-semester summary). Current-semester card
listing subjects with grades and credits; a row opens `SubjectDrawerSheet`.
"Studijní průměr" accordion: semester average, overall average, weighted average,
"Překonáváš N %", "Pořadí v ročníku R./T". Header button opens `StudyPlanSheet`.

*Data:* `useStudyPlan`, `useSubjects`, `useCourseGrade`, `fetchStudyStats`
(weighted GPA), `studyComparison` (`percentileStanding`, `rank`, `total`).

### Mapa

Reuses `MapCanvas` unchanged. Floating search pill; "Celý kampus" back chip and
`FloorSwitcher` when drilled into a building. Bottom sheet with peek/expanded
states and tabs Akce / Knihovna / Budova X.

*Data:* `mapEvents`, `libraryAvailability`, `libraryBooking`, `useSpolkySettings`.
*Reuses:* `EventRow`, `EventRsvp`, `LibraryRoomSection`, `LibrarySlotPicker`,
`FloorStack`.

### Student (the hub)

Segmented Stránky IS / Lidé, a search field, and beneath it either results or
browse. Browse shows a card grid — **Eduroam, Dokumenty, Erasmus, ISKAM** — then
grouped IS page links. ISKAM navigates to `webiskam.mendelu.cz`; the other three
open sheets.

*Data:* `useSearch` + `SearchResultItem`, `usePersonProfile`, `usePersonPhoto`,
`useEduroamSetup`, `studyDocuments`, `useErasmus`.

### Sheets

`EventDetailSheet` (including hide-event, restorable from Profile),
`SubjectDrawerSheet` (five icon tabs with badges, IS backlink footer; data via
`useFiles`, `useClassmates`, `useSuccessRate`, `useSyllabus`, `useZaznamnik`,
`useCvicneTests`),
`StudyPlanSheet`, `ProfileSheet` (theme, jazyk, Outlook sync, Drive backup,
skryté akce, spolky, feedback, odhlásit, version), `PersonSheet` (e-mail,
kancelář → map), `EduroamSheet`, `DocsSheet`, `ErasmusSheet`,
`NotificationsSheet`, `ConfirmSheet`.

## Information architecture decisions

- **Five tabs, as designed.** ISKAM does not get a tab. Audit finding:
  `IskamPanel` is rendered only by `src/entrypoints/iskam/IskamApp.tsx` (the
  iframe on `webiskam.mendelu.cz`), never by the IS app. The `'iskam-dashboard'`
  `AppView` is vestigial — `Sidebar.tsx` and `MobileBottomNav.tsx` branch on it,
  but `menuConfig.tsx` has no such item and `AppMain.tsx` has no render branch,
  so selecting it renders an empty content area. ISKAM data lives in a separate
  store and IDB namespace written only while the user is on webiskam;
  `freshness.ts` dims it after 2h. Rendering it from the IS app would show a
  cache that refreshes only on another domain. ISKAM stays a link.
- **Erasmus** becomes a card in Student, opening `ErasmusPanel` in a full-height
  sheet. v1 does not redesign it; Learning Agreement tables A/B and the Europe
  map will be cramped on a phone. Stated plainly rather than pretended otherwise.
- **Notifications** get a bell in the screen header with an unread badge, opening
  a sheet. Deadline alerts additionally surface as cards on Kalendář.
- **Odevzdávárny** need no placement — they already render within the Záznamník
  surface, which the drawer sheet covers.
- **StudyJams** need no placement — already a modal overlay with a contextual
  trigger.
- **Bulletin** reuses the existing `MobileBulletinOverlay`.

## Feature decisions

| Prototype element | Decision | Rationale |
|---|---|---|
| Exam-term watcher (bolt button) | **Fully wire it** | Already built end to end. `ExamTerm.watchdogUrl` is parsed (`availableTermsParser.ts`, with tests), `triggerWatchdog(url)` exists in `src/api/exams.ts`, and desktop's `TermBuiltinActions.tsx` drives it. Armed state is derived from the URL itself — IS emits `aktivace=1` when off, `aktivace=2` when on. Mobile reuses this via a shared `useWatchdog` hook. The prototype's copy ("Nezavírej appku a neuspávej mobil!") wrongly implies a client-side poller and **must be rewritten** — IS's "hlídací pes" notifies server-side. |
| Term capacity / "obsazeno" | **Include** | Already parsed: `ExamTerm.capacity: { occupied, total, raw }` and `ExamTerm.full`, already consumed by `ExamPanel/utils.ts` and `TermsSummary.tsx`. |
| "X spolužáků na tomto termínu" | **Include** | `useExamClassmates(terminId)` already exists. Free. |
| "Stáhnout vše" in drawer | **Omit** | Multi-file download is blocked by most mobile browsers after the first file. Per-file download works as today. |
| Sylabus "Hodnocení" points table | **Include** | Already backed: `SyllabusRequirements.requirementsTable: string[][]` is that table; `requirementsText` covers the note beneath it. |
| "Teď běží" hero, day-list + gaps, exam timeline | **Include** | Pure derivation from data already in the store. |
| "Trasa →" | **Include** | Deep-links the map, same mechanism as the person card's "Ukázat kancelář na mapě". Not navigation. |

## Error and empty states

Every screen respects the existing skeleton guard — `handshakeDone` /
`handshakeTimedOut` (10s) in `createSyncSlice` — rendering a skeleton until the
handshake resolves, then content or an empty state.

The prototype supplies only one empty state ("Nic nemáš, pohodička"). Zkoušky,
Předměty, Mapa and Student each need one written in the same voice.

All catches go through `logError` with `Mobile.<Screen>.<action>` contexts,
matching the existing convention. A failed register or unregister surfaces as a
toast and leaves the sheet open rather than closing optimistically.

## Testing

Test-first, per the Iron Rule.

- **Pure functions first.** `resolvePhoneViewport`, `nowNext`, `dayAgenda`,
  `examTimeline` get failing vitest tests before implementation. All take an
  injected `now` so they are deterministic.
- **Slice tests.** Sheet stack push/pop/replace, tab switching, map sheet states.
- **`Sheet` primitive.** Renders children, backdrop click closes, stacking order.
- **Screen render tests.** Seeded store, happy-dom; assert loading / empty /
  populated branches.
- **Characterization test for `SubjectFileDrawerContent`** before extraction
  (see R3).
- **Desktop regression.** The existing suite stays green throughout.
- **E2E.** New `mobile-chromium` Playwright project; tab switching, opening the
  subject drawer, opening a sheet from Student.

**Verification loop:** `npm run dev:web` against the real-data snapshot, driven
in the in-app browser at mobile viewport, screenshotting each screen against the
prototype. Plus `npm run typecheck` and `eslint --max-warnings=0` on changed
files before every push.

## Risks and mitigations

### R1 — Phone detection cannot be exercised by resizing

`pointer: coarse` requires touch emulation, so plain browser resizing never
triggers the phone branch. This would block both developer eyeballing and E2E.

**Mitigation (all three are implementation tasks):**
- `resolvePhoneViewport({ isTouch, isNarrow, override })` as a pure, unit-tested
  function; the store selector calls it.
- Dev-only override `?mobile=1` / `?mobile=0`, read once in the `dev/` harness,
  guarded by `import.meta.env.DEV` so it cannot ship, written into the mobile UI
  slice.
- Add a **`mobile-chromium`** Playwright project (`devices['Pixel 7']` +
  chromium, which supports `isMobile` and `hasTouch` reliably; Firefox's support
  is patchier — the existing `firefox-android` project stays for the
  extension-on-Firefox path). **The mobile suite's first assertion is that the
  phone branch mounted** (`data-testid="mobile-app"`), so broken emulation fails
  loudly instead of silently exercising the desktop tree.

### R2 — Straight replacement leaves `main` half-migrated

No feature flag was chosen, and a half-migrated `main` is the failure mode that
choice invites.

**Mitigation:** all work lands task-by-task on a long-lived `claude/reis-mobile`
branch and merges to `main` as **one reviewed PR** once all five screens exist.
Straight replacement, single cutover, no dual maintenance, no broken interim.

The final commit on that branch is the cleanup — **narrower than it first
appears, because ISKAM still depends on the old path**:

- Remove `<MobileBottomNav>` from `App.tsx` and the vestigial `iskam-dashboard`
  branches from `Sidebar.tsx` (lines 29, 36, 61).
- Remove the now-dead `touch:` variant usages from `AppHeader.tsx` and
  `AppMain.tsx`, which exist only to squeeze desktop layouts onto phones.

**`src/components/MobileNav/` is NOT deleted.** `IskamApp.tsx:5` imports
`MobileBottomNav` and renders it with `tabs={iskamTabs}`, which transitively
keeps `MobileNavSheet` and `MobileProfileSheet` alive. After this work,
`MobileNav/` is ISKAM-only; deleting it belongs to follow-up spec 1.

For the same reason, **`'iskam-dashboard'` stays in the `AppView` union** —
`MobileBottomNav.tsx:80` still references it and is typed against `AppView`.
`IskamApp.tsx` likewise keeps its `touch:` usage, so the `touch:` custom variant
stays defined in `src/index.css`.

Within the IS app, old and new never coexist on `main`.

### R3 — Leaf extraction can regress desktop

The two extractions carry asymmetric risk:

- `MapSidePanel.test.tsx` **already exists** — that extraction is covered.
- `SubjectFileDrawerContent` has **no test**; `SubjectFileDrawer/__tests__/`
  covers only `PdfDrawerLayout`, `pdfWindow` and `useNoteImage`.

**Mitigation:** write a characterization test pinning current desktop
tab-switching behaviour **before** touching `SubjectFileDrawerContent` — its own
plan task. Both extractions are pure moves in dedicated commits with no
behaviour change, and the desktop suite must be green before any mobile consumer
imports them.

### R4 — Parser breakage

**Mitigation:** this work changes **zero** parsers. Every element that looked
like it might need one turned out to be parsed already — term rosters via
`useExamClassmates`, the watch button via `ExamTerm.watchdogUrl` +
`triggerWatchdog`, term capacity via `ExamTerm.capacity` / `.full`, and the
syllabus points table via `SyllabusRequirements.requirementsTable`. The invariant
is machine-enforced: `.claude/hooks/guard-parsers.py` runs `PreToolUse` on every
`Edit|Write`. If it fires, the task is wrong, not the hook.

### R5 — English copy back-filled as a gloss

The prototype is Czech-only, and every new string needs a genuine `en.json`
counterpart.

**Mitigation:** the first plan task delivers a complete **cs + en copy table**
for all new strings, reviewed before any screen is built. Screens then consume
keys that already exist in both locales. Worktree isolation (already standard
practice here) prevents concurrent-session collisions on the i18n files.

## Deferred decisions

**Delivery vehicle.** This spec builds a responsive phone UI that works in the
extension and in the standalone webapp. Whether reIS later ships as a Capacitor
shell, a PWA, or stays extension-only is deliberately unanswered. The constraint
that keeps the option open: **no new code may assume `chrome.*` or the extension
shell.** Mobile screens read from the store and hooks, never from extension APIs
directly.

## Follow-up specs

1. **ISKAM phone layout** — separate app, separate store, no approved design yet.
   Will reuse the primitives this work establishes, and is the spec that finally
   retires `src/components/MobileNav/`, the `'iskam-dashboard'` `AppView` member
   and the `touch:` custom variant.
2. **Phone-native Erasmus** — list-based Learning Agreement instead of tables,
   no Europe map. Needs its own design pass.
3. **"Stáhnout vše"** — if it comes back, the Drive-backup route is the more
   promising answer than client-side zipping.
