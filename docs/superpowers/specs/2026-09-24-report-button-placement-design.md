# Report-a-problem where problems show — design

**Date:** 2026-09-24 · **Status:** approved placement, spec for review

## Problem

"Nahlásit chybu / Nápad" exists in one place per tree: the second-to-last row
of the profile menu, above Odhlásit, `text-xs` at 70 % opacity
(`Sidebar/ProfilePopup.tsx:142`, `MobileNav/MobileProfileSheet.tsx:124`,
`mobile/screens/ProfileScreen.tsx:149`). A student who hits a problem is on
Zkoušky or Předměty, not in their profile.

Baseline, from prod `suggestions` on 2026-09-24: **15 reports since
2026-08-22** from ~3,760 installs (~2,090 weekly active, ~25k opens/week). The
per-row `screen` value records the view behind the profile menu, not where the
problem was, so it says nothing about placement.

Since error telemetry was removed (#282), a student report is the only early
warning that IS Mendelu changed its HTML and a parser broke. That failure
rarely throws. It renders a **believable empty state**. The goal is therefore
bug reports, and the entry points go where "this looks wrong" appears.

## Goal and non-goals

- **Goal:** more bug reports about missing or broken IS data, each one
  attributable to the entry point that produced it.
- **Non-goal:** more ideas and general feedback. The profile row stays as the
  always-present entry, unchanged in style.
- **Non-goal:** any change to what is transmitted. `submit_suggestion`, its
  payload and `src/api/suggestions.ts` are untouched. The privacy guard
  (`src/test/guards/noStudentDataLeaves.test.ts`) must pass unmodified.

## Prerequisite: one report form, opened from anywhere

Today the form's open state is `useState` in `hooks/useAppLogic.ts:61`,
threaded as `onOpenFeedback` through `App → Sidebar → BottomActions →
ProfilePopup` and `MobileBottomNav → MobileProfileSheet`. The phone tree mounts
a **second, local** `<FeedbackModal>` inside `ProfileScreen`. Nothing outside
those menus can open it, and the phone tree (which iPad also runs) has no
global instance.

**New slice** `src/store/slices/createReportSlice.ts`. It is separate from
`createFeedbackSlice`, which is the NPS prompt:

```ts
interface ReportPrefill { title: string }            // our own string, never IS text
reportOpen: boolean
reportPrefill: ReportPrefill | null
reportSeq: number                                    // bumps on every openReport
openReport: (prefill?: ReportPrefill) => void        // sets prefill, opens, bumps seq
closeReport: () => void                              // clears open + prefill
```

It is in-memory only, not persisted.

**One mount per tree.** The desktop and phone trees are exclusive, and each
already mounts its own `Toaster`.

- **Desktop:** `AppOverlays` renders `<FeedbackModal />`, reading
  `reportOpen` / `closeReport` from the store. Remove the
  `isFeedbackOpen` / `setIsFeedbackOpen` `useState` and props from
  `useAppLogic`, `App` and `AppOverlays`.
- **Phone:** `mobile/MobileApp.tsx` renders the same `<FeedbackModal />`.
  Delete the local instance and `feedbackOpen` state from `ProfileScreen`.
- **Existing menu rows** call `openReport()` directly. The `onOpenFeedback`
  prop chain through `Sidebar`, `BottomActions`, `ProfilePopup`,
  `MobileBottomNav` and `MobileProfileSheet` is removed. `ProfilePopup` and
  `MobileProfileSheet` keep closing themselves before opening the form, as
  they do now.

**`FeedbackModal`** takes no props. Each open starts fresh: type `bug` and
title `reportPrefill?.title ?? ''`. Body and contact start empty. The simplest
way is to remount on open (`key={reportSeq}` on the modal's form body), so the
form's local `useState` needs no reset effect. The student can edit or clear
the prefilled title.

## Entry points

| # | Surface | Tree | File | Prefilled title key |
|---|---|---|---|---|
| 1 | No exams | desktop | `ExamPanel/EmptyExamsState.tsx` | `feedback.prefill.examsEmpty` |
| 2 | No exams | phone | `mobile/screens/ExamsScreen.tsx:171` | `feedback.prefill.examsEmpty` |
| 3 | No subjects | desktop | `SubjectsPanel/index.tsx:70` | `feedback.prefill.subjectsEmpty` |
| 4 | No subjects | phone | `mobile/screens/SubjectsScreen.tsx:37` | `feedback.prefill.subjectsEmpty` |
| 5 | Syllabus empty | both (shared) | `SubjectFileDrawer/SyllabusTab.tsx:48` | `feedback.prefill.syllabusEmpty` |
| 6 | Záznamník empty | both (shared) | `SubjectFileDrawer/ZaznamnikTab.tsx:84,120` | `feedback.prefill.zaznamnikEmpty` |
| 7 | Exam action failed | desktop | `ExamPanel/useExamActions.ts` | `feedback.prefill.examActionFailed` |
| 8 | Watchdog failed | phone | `mobile/screens/exams/TermRow.tsx:34` | `feedback.prefill.examActionFailed` |

**Empty states (1–6):** below the existing text, add a quiet link-styled
button: "Chybí tu něco? Nahlásit" / "Something missing? Report it"
(`feedback.reportLink`). Use DaisyUI `btn btn-link btn-sm` or `link` at the
surrounding muted text color. It must not compete with the empty-state
message, and it must not use error color, because empty is usually correct.
It has a ≥ 44 px touch target on the phone tree. The Záznamník link shows only
on the `noData` branch, not on `noAssessment`, since a subject with no
assessment is a real, legitimate state.

**Failure toasts (7–8):** the `toast.error` calls get
`action: { label: t('feedback.reportAction'), onClick: () => openReport({ title }) }`
and `duration: 10000`. This is the same sonner action pattern as
`mobile/sessionRecovery.ts:170`. The `useExamActions` sites that get it are
`actionUnregisterFailed`, `actionSwitchFailedRolledBack`,
`actionSwitchFailedNoRollback`, `actionFailed` / `res.error`,
`actionGenericError` and `actionMissingId`. The toast **text** may still show
`res.error`. The **prefill never does**, because `res.error` can carry
IS-derived text.

**Deliberately excluded:**

- **`useAutoRegistration` toasts** (`autoRegFull`, `autoRegExpired`,
  `autoRegNoStart`, `autoRegTooEarly`) report real conditions, not bugs.
- **`CalendarEmptyDay` and search empty states** are legitimately empty
  constantly and would bury real reports.
- **`mobile/BootErrorScreen.tsx`** is imported nowhere today, so there is
  nothing to attach to.
- **Stable error codes** are the follow-up in the parked error-visibility
  plan. The prefill keys here are the first step towards them.

## Strings

Add every key to both `src/i18n/locales/cs.json` and `en.json`:

| Key | cs | en |
|---|---|---|
| `feedback.reportLink` | Chybí tu něco? Nahlásit | Something missing? Report it |
| `feedback.reportAction` | Nahlásit | Report |
| `feedback.prefill.examsEmpty` | Zkoušky: prázdný seznam | Exams: list is empty |
| `feedback.prefill.subjectsEmpty` | Předměty: prázdný seznam | Subjects: list is empty |
| `feedback.prefill.syllabusEmpty` | Sylabus: chybí data | Syllabus: no data |
| `feedback.prefill.zaznamnikEmpty` | Záznamník: chybí data | Records: no data |
| `feedback.prefill.examActionFailed` | Zkoušky: akce selhala | Exams: action failed |

The prefill is resolved in the **current UI language** at open time, so
measurement matches on both language variants.

## Measurement

Each entry point prefills a distinct title prefix. After release, compare the
prefix counts against the baseline of 15 reports in 5 weeks:

```sql
select split_part(title, ':', 1) as entry, type, count(*)
from suggestions where created_at >= '<release date>'
group by 1, 2 order by 3 desc;
```

Titles the student rewrote fall into an "other" bucket. That is an accepted
loss and needs no payload change.

## Testing

Write the tests first, per repo convention:

- **Slice:** `openReport(prefill)` sets `reportOpen` and `reportPrefill` and increments `reportSeq`.
  `closeReport()` clears both. `openReport()` with no argument sets the
  prefill to `null`.
- **`FeedbackModal`:**
  - Opening with a prefill shows it as the title with type `bug`.
  - Reopening without a prefill shows an empty title.
  - Closing calls `closeReport`.
- **Each empty state (1–6):** the link renders on the empty branch only, and
  clicking it calls `openReport` with the matching prefill. Záznamník renders
  no link on `noAssessment`.
- **`useExamActions`:** a failed register passes an `action` whose `onClick`
  calls `openReport` with `examActionFailed`, and never with `res.error`.
- **Regression:** the profile-menu rows in both trees still open the form. The
  privacy guard test passes unmodified.
- **UI:** run the `verify-ui` skill at 320 / 390 / 430 on the phone tree and
  at the desktop widths on the desktop tree, light and dark:
  - no overflow
  - the link does not collide with the empty-state text
  - contrast is ≥ 4.5:1 on the link

  Before/after PNGs are sent to Dominik.

## Files touched

- **New:**
  - `store/slices/createReportSlice.ts` (plus a test)
  - slice types in `store/types.ts`
  - composition in `store/useAppStore.ts`
- **Form and mounts:**
  - `Feedback/FeedbackModal.tsx`
  - `AppOverlays.tsx`
  - `App.tsx`
  - `hooks/useAppLogic.ts`
  - `mobile/MobileApp.tsx`
  - `mobile/screens/ProfileScreen.tsx`
- **Prop chain removal:**
  - `Sidebar.tsx`
  - `Sidebar/BottomActions.tsx`
  - `Sidebar/ProfilePopup.tsx`
  - `MobileNav/MobileBottomNav.tsx`
  - `MobileNav/MobileProfileSheet.tsx`
- **Entry points:** the 8 files in the table above.
- **Strings:** `i18n/locales/cs.json` and `en.json`.

No parser, API or Supabase file changes.
