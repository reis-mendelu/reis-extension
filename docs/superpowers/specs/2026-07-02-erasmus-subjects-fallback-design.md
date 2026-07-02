# Erasmus Subjects Fallback — Design

**Date:** 2026-07-02
**Status:** Approved

## Problem

The Předměty view (`currentView === 'subjects'` → `SubjectsPanel`) is driven entirely by
the StudyPlan parsed from `studijni_povinnosti.pl` (KontrolaPlanu). Erasmus/exchange
students have no KontrolaPlanu page — the study plan never materializes, so they see the
`subjects.noData` empty state even though their enrolled subjects are known.

Their enrolled subjects are already synced for everyone (including Erasmus students) from
`student/list.pl` via `fetchDualLanguageSubjects` → `syncSubjects` → the `subjects` store
(Zustand + IDB). That store carries code, CZ+EN names, `subjectId`, and folder URL —
everything the subject drawer needs.

## Decision

When the study plan is missing or empty and the `subjects` store has data, `SubjectsPanel`
renders a fallback: the existing "Enrolled now" card populated from the `subjects` store,
plus a muted caption explaining the study plan is not available for exchange studies.
Nothing else (plan header, study averages, Study Plan button) is shown — that data does
not exist without KontrolaPlanu.

### Gating

- Plan is **usable** iff it is non-null AND contains ≥ 1 subject across
  `blocks[].groups[].subjects`.
- Plan not usable AND `subjects.data` non-empty → **fallback branch**.
- Plan not usable AND subjects also empty → current behavior unchanged
  (skeleton while loading, then `subjects.noData`).
- The gate does **not** use the `isErasmus` flag — any student whose KontrolaPlanu is
  absent or fails to parse gets the fallback. Regular students always have a usable plan,
  so nothing changes for them.

## Approach: scoped synthetic plan (chosen)

A small pure helper builds a minimal `StudyPlan` from the subjects store and feeds it into
the existing `EnrolledNowSection` — confined to this one render branch, never persisted.

- **New util** (new file, e.g. `src/components/SubjectsPanel/buildFallbackPlan.ts`):
  `buildFallbackPlan(subjects: SubjectsData, language: 'cs' | 'en'): StudyPlan`
  - One block, one group; each `SubjectInfo` maps to a `SubjectStatus` with
    `isEnrolled: true`, `isFulfilled: false`, `credits: 0`, `enrollmentCount: 0`,
    `id` = `subjectId ?? ''`, `code` = `subjectCode`,
    `name` = `nameEn`/`nameCs` picked by current language (fallback to `displayName`).
  - Plan scalars: `isFulfilled: false`, `creditsAcquired: 0`, `creditsRequired: 0`,
    `zameranis: []`, neutral title.
- **`SubjectsPanel` branch:** when gated into fallback, render only
  `EnrolledNowSection` with the synthetic plan + the caption line. `useSubjectsData`
  runs on the synthetic plan unchanged, so fail-rate chips and the success-rate batch
  fetch work for free; `SubjectRow` → `onOpenSubject` (files/stats/syllabus/classmates
  drawer) works untouched. Semester labels render as "–" (block title has no
  semester number), which is correct — there is no plan semester to show.
- **i18n:** new key (e.g. `subjects.noPlanExchange`) in both
  `src/i18n/locales/cs.json` and `en.json`.

### Alternatives considered

1. **Dedicated fallback component** reading `useSubjects()` directly — conceptually
   cleaner (no fake plan object) but duplicates EnrolledNowSection's card chrome and
   success-rate wiring for identical pixels. Rejected.
2. **Synthesize the plan at sync time** — would persist a fake plan into IDB and poison
   other plan consumers (StudyPlanPage, insights, ErasmusPanel unfulfilled-courses).
   Rejected; violates the "plan = KontrolaPlanu" invariant.

## Data flow

`student/list.pl` (already synced, dual-language) → `subjects` store →
`buildFallbackPlan` (pure, per-render, language-aware) → `EnrolledNowSection`.

No new fetching, no sync changes, no new persistence.

## Error handling

None new. Inputs are already validated by the existing sync path; the fallback is pure
derivation. If the subjects store is empty or malformed, the gate simply doesn't fire and
the existing empty state shows.

## Testing (test-first, per project rules)

1. Unit tests for `buildFallbackPlan`: mapping of fields, language pick (cs/en, fallback
   to `displayName`), empty input → empty block.
2. Component test for `SubjectsPanel`: with empty/null plan and non-empty subjects store,
   the fallback card and caption render (and header/averages/Study Plan button do not);
   with both empty, `subjects.noData` still renders.
