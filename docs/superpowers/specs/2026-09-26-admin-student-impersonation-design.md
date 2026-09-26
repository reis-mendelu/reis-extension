# Admin student impersonation — design

**Date:** 2026-09-26 · **Status:** approved in chat, pending spec review

## Goal

A reIS admin can view the app as a student of another programme, for example
"PEF · B-F Finance · 1st year · study group 1b-f2", to test features against
that student's study plan and weekly timetable. Only the plan and the timetable
are impersonated. Everything else IS-derived shows its empty state.

## Decisions (made with Dominik, 2026-09-26)

| Question | Decision |
|---|---|
| Scope of impersonated data | Study plan + subjects + timetable only. Exams, grades, files, classmates, stats, practice tests, assignments and záznamník show empty states. |
| Where it ships | Production: extension, iOS, Android. Visible only when `adminRole === 'reis_admin'`. |
| Data source | Live from IS through the admin's own IS session. Nothing is published to reis-data or a CDN. |
| Picker | Faculty → programme → year, plus study group in **year 1 only**. |
| Year 2+ | No study groups exist. The timetable uses the lecture plus the **first seminar slot** per subject, and electives are filled in order until each group's minimum is met. |
| Lifetime | Until an explicit exit, and it survives restarts. The admin's real data stays untouched in IndexedDB. |
| Architecture | **Overlay** (approach A). Rejected: swapping the IDB namespace (touches every slice, pauses the real sync) and re-pointing the existing sync (overwrites real data). |
| v1 coverage | Prezenční, winter-intake programmes. Spring-intake programmes (e.g. N-F, N-UAD LS intakes) and kombinovaná are excluded, and the picker says so. |

## Evidence from live IS (probed 2026-09-26)

Raw samples are in the session scratchpad (`is-samples/`). They are not committed; see *Fixtures*.

**Timetable app** (`/auth/katalog/rozvrhy_view.pl`):

- **Finding the rozvrh for the current period.**
  - `?konf=1` lists validity ranges (`z`/`k`); each range lists its rozvrhy.
  - PEF prezenční ZS 2026/27 is rozvrh **5769**, z=20260921, k=20261213.
  - Faculty → rozvrh is not 1:1. FRRMS has 5766/5767, ZF has 5764 (Brno) and 5762 (Lednice), and kombinovaná is a separate rozvrh.
  - Sending the wrong z/k/f triple returns the selection page instead of the form.
- **The criteria form.** `POST rozvrh=…` returns selects for `program` (same id space as `plany.pl`, B-F = 1889), `rocnik` (1–3) and `skupina` (1–13, numeric). The `format` select offers only html/list/pdf.
- **JSON is accepted even though the form does not offer it.**
  - `format=json` returns `{modificationDate, blockLessons, periodicLessons, daysOff}`.
  - `format=json` plus `typ_vypisu=konani; konani_od; konani_do` returns dated `blockLessons`.
  - These lessons have the same fields as the student's own timetable except `studyId` and `periodId`.
  - Holidays are already removed (no lessons on 28.9.).
  - Periodic lessons carry `week: odd|even` and `periodicity`.
  - Czech and English both work.
- **Year 1 with a group.** `program=1889; rocnik=1; skupina=2` returns the lectures (restriction `1b-f`) plus group 2's seminars (`1b-f2`): 13 weekly slots, all 7 plan subjects.
- **A group that doesn't exist** (`skupina=13`) silently returns the lectures only.
- **Year 2 and 3 by programme.** `program=1889; rocnik=2` (and `rocnik=3`) returns the no-results page ("Zvoleným kritériím nevyhovuje žádná rozvrhová akce."). The programme filter works only for year 1.
- **Per subject.** `predmet=<id>` returns every slot of that subject. EBC-FT has 1 lecture and 8 seminar slots, and electives (EBA-OTF, EBA-OTDU) work too. From year 2 on, restrictions read `2,3`, meaning years rather than groups, so students pick their own slots.
- **Groups exist only in the list format.** The study-group label is only in the `format=list` "Omezení" column. The JSON has no restriction field.

**Plan catalogue** (`/katalog/plany.pl`, public, no login):

- **Walking the catalogue.** Faculty → period rows (`poc_obdobi`: 829 = ZS 2026/27, 801 = ZS 2025/26, 754 = ZS 2024/25, …) → programme → leaf (`stud_plan`).
- **B-F intakes.** Intake 801 (leaf 12490) and intake 829 (leaf 12809) have identical subject codes in all 6 semesters. Other programmes may differ; 2026/27 rewrote codes elsewhere.
- **Subject ids on the leaf.** A leaf links **this period's** `predmet=` id only for the semesters currently taught for that intake. Intake 801's semester-3 ids equal the ids in timetable 5769's `predmet` select (EBC-FT 164066, EBA-OTF 164068, …), and its semester-1 ids are last year's (EBC-MT 157993 vs 164227). So the right intake leaf directly gives the ids that per-subject timetable queries need.

## Architecture

### Gate and entry

- **Desktop:** a "Zobrazit jako student…" item in `src/components/Sidebar/ProfilePopup.tsx`.
- **Phone/iPad:** a row in `src/components/mobile/screens/ProfileScreen.tsx`.
- Both render only when `adminRole === 'reis_admin'`, which `loadAdminSession()` restores at boot.
- This is a convenience gate, not a security control. Any logged-in student's session can read the same IS pages.

### Picker

- Faculty → programme → year, plus a group in year 1.
- The lists come from `impersonation_options`: the criteria forms of the current period's prezenční rozvrhy.
- **Programme → rozvrh:** the rozvrh whose `program` select lists that programme id.
- **Year-1 groups:** the distinct restriction labels (e.g. `1b-f1`…`1b-f5`) in one `format=list` query for programme + year 1. Their numeric suffix is the `skupina` value.
- Spring-intake and kombinovaná programmes are listed as disabled with a reason.

### Actions (content script in the extension, in-process on Capacitor)

Both are added to `src/types/messages/base.ts`, `src/types/messages/schema.ts`,
`src/injector/messageHandler.ts` and `src/mobile/actionHandler.ts`. The action
result carries the data back, the same pattern as `download_document`.

- **`impersonation_options`:** `{faculties: [{id, name, programmes: [{programId, code, name, years: number[], year1Groups: number[], rozvrh: {id, z, k, f}}]}]}`.
- **`impersonation_fetch {programId, year, group?}`:** `{plan: DualLanguageStudyPlan, schedule: BlockLesson[], subjects, period: {label, from, to}}`.
  1. **Intake:** ZS of (current academic year − (year − 1)). The target semester is 2·year − 1 during ZS and 2·year during LS. The current period comes from the date, as in reis-scraper's `currentPeriodLabel` (September–January is ZS).
  2. **Plan:** the leaf for that intake, fetched in cz and en. A new parser (`src/api/catalogPlan.ts`) maps it to `StudyPlan` with `isEnrolled`/`isFulfilled` false, `enrollmentCount` 0 and group min-count/min-credits parsed from the group name. The scraper's `parsePlan` (reis-scraper `scripts/scrape-study-plans.ts`) is the proven structure.
  3. **Timetable, year 1:** dated JSON for `program; rocnik=1; skupina`, in cz and en, over the rozvrh's validity range.
  4. **Timetable, year 2+:** for each target-semester plan subject with a `predmet=` id, dated JSON with `predmet=<id>`. Keep the lecture(s) and the first seminar slot, meaning the lessons whose course id and slot match the first seminar in the periodic listing. Fill each elective group in plan order until its minimum is met.
  5. **Merge:** cz and en are merged as `fetchDualLanguageSchedule` does, with `studyId`/`periodId` set to `''`.
  6. **Subjects:** derived from the target semester's plan rows.

### Overlay slice

The new `src/store/slices/createImpersonationSlice.ts` holds `impersonation: {selection, result, appliedAt} | null`.

- **Persistence:** IDB `meta.impersonation` for the selection and `impersonation/current` for the result, separate from the real stores.
- **Applying:** puts `result` into the in-memory `schedule`, `studyPlanDual` and subjects. The real IDB copies are never written by the overlay.
- **Guards:** every in-memory writer skips while impersonating, but IDB writes still happen, so the real data stays current. The writers:
  - the `REIS_SYNC_UPDATE` handler in `src/hooks/useAppLogic.ts`
  - `setSchedule` / `fetchSchedule`
  - `fetchStudyPlan`
  - the subjects slice
  - `services/sync/sync*.ts`
  - `loadRealDataSnapshot`
  - `triggerScheduleRefresh`
- **Empty states:** while impersonating, the IS-derived views outside scope (the `IS_DERIVED_STORES` list in `createDemoSlice.ts`, minus schedule, study_plan and subjects) read as empty through the same gate.
- **Identity:** context (`studiumId`, `obdobiId`, `facultyId`) stays the admin's. Impersonated lessons must never feed the `studyId`/`periodId` fallback in `src/injector/syncService.ts:390`.
- **Exiting:** clears both keys and re-reads the real schedule, plan and subjects from IDB. Exit paths:
  - the banner button
  - `adminLogout()`
  - IS logout
  - an identity change from `watchSignedInStudent`
  - a cached result whose period is not the current one

### Banner

- A banner that can't be dismissed, on both trees: "Zobrazuješ jako B-F · 1. ročník · 1b-f2 — Ukončit".
- Phone: follow `src/components/mobile/DemoBanner.tsx`.
- Desktop: new, in `AppOverlays`/`AppMain`.

## Errors

- **Login page, IS error, non-JSON without the no-results marker:** the fetch failed. Nothing is applied, and the picker shows "IS nevrátil rozvrh". The overlay is never half-applied.
- **The no-results marker:** a real empty result. The plan applies and the timetable is empty with a note (same rule as `src/api/schedule.ts`).
- **A year-2+ subject with no events:** it stays in the plan with no lessons.
- **Request budget:** timetable POSTs are expensive for IS.
  - Year 1 costs 2 requests plus 2 plan GETs.
  - Year 2+ costs 2 per subject (about 14 for B-F semester 3), with concurrency ≤ 3.
  - `impersonation_options` is cached per period, and each result per selection.

## Testing (test first)

- **Parser tests:**
  - `catalogPlan` against trimmed real fixtures, cz and en, for intakes 829 and 801.
  - Group extraction against a trimmed real `format=list` fixture.
  - `impersonation_options` against a trimmed criteria-form fixture.
- **Request-body tests** for both timetable queries, plus the first-slot and elective-fill selection.
- **Overlay guards:** one test per in-memory writer. Real data arriving while impersonating leaves the overlay in place and still reaches IDB.
- **Exit paths:** one test each, and each restores the real data.
- **Tree parity:**
  - Menu entry and banner on both trees.
  - `verify-ui` at 320/390/430 and tablet width, in both themes.
  - Before/after PNGs sent to Dominik.
- **Live check** (tests do not prove the IS side): impersonate B-F year 1 group 2 and B-F year 2 on the dev webapp and on the iPad.

## Fixtures (public repo)

- **Trim:** each fixture is cut to a few rows with the IS structure kept.
- **Scrub:** the logged-in page chrome is removed (name, counts, menu), and teacher names and ids are replaced.
- **Why:** no auth-only PEF timetable leaves the private scraper in bulk, which follows reis-scraper's "must not be published" rule.
- **Review:** Dominik reviews the fixture diff before the first commit.

## Privacy

- **No new outbound flows:** data goes IS → device through the admin's own session.
- **No reIS backend:** nothing is sent to Supabase or anywhere else.
- **Disclosures:** if the `disclosure-drift` hook asks, record "no new flow" in `privacy/disclosures.ts`.

## Out of scope (v1)

- Spring intakes and kombinovaná.
- Specialisations (zaměření).
- Choosing seminar slots per subject.
- Fake exams or grades.
- Impersonating a real named student.

## Amendments from implementation planning (2026-09-26)

- **No new action.** `fetchWithAuth` already reaches IS from the extension iframe (the content
  script's `REIS_FETCH` proxy carries the cookies), natively on Capacitor, and directly on the dev
  webapp. The impersonation fetch runs in the iframe/app like the syllabus fetch; nothing changes
  in `src/injector/` or `src/mobile/actionHandler.ts`. Because the proxy labels every response
  `text/html`, JSON is detected from the body, not the content-type.
- **One IDB key.** Selection and result live together in `meta.impersonation` (no new object store,
  so no IndexedDB version bump). `createDemoSlice` clears it with the other IS-derived meta keys.
- **Year 2+ slot key.** A per-subject dated query merges parallels that share a slot, so the key is
  weekday + start time + room; a biweekly parallel therefore shows weekly. Known v1 limitation.
- **Enrolled marks.** Target-semester subjects the timetable was built from are `isEnrolled: true`,
  so the plan reads like a real student's current semester.
- **Expired cache.** A cached impersonation from another period ends silently at boot and the picker
  shows "Zobrazení jako student skončilo s koncem semestru." the next time it opens.
- **Excluded programmes.** Kombinovaná rozvrhy and non-B-/N- programmes are filtered out of the
  picker rather than listed disabled; a scope note under the selects says what v1 covers.
- **Empty timetable.** A no-results answer applies the plan with no lessons; the calendar's own
  empty state is the note.
- **Authenticated catalogue.** The plan is fetched from `/auth/katalog/plany.pl`, not the public
  `/katalog/` path: the Capacitor transport treats HTML without `logout.pl` as an expired session,
  and the public page has none. Row structure is identical (verified 2026-09-26, 61/61 rows).
- **Year filter on per-subject queries.** `predmet=<id>; rocnik=<year>` returns only the slots open to
  that year (EBC-FT: 36 lessons instead of 60, other programmes' first-year slots gone).
- **Options cache.** The programme list is cached in memory for the app session, not per period in
  IndexedDB; it is one small crawl per picker session.
- **Side effects gated.** While impersonating, the files and classmates fetchers (which hit IS and
  write IndexedDB per subject code) return early, so no foreign subject reaches the real stores.
- **Offline restart.** Restore clears the cache only when there is definitively no admin session, or
  the account is not a reis_admin. An admin whose role lookup failed (offline) keeps it for the next
  boot. `loadAdminSession` no longer signs the admin out when the lookup *errors*, only when the
  account row is absent.
- **IS stamps the viewer's studium.** A programme/subject timetable query returns `studyId`/`periodId`
  of the *signed-in admin* on lessons the admin is enrolled in (seen 2026-09-26). `readTimetableAnswer`
  overwrites both with `''` on every lesson, pinned by a test, so the admin's studium never rides
  into an impersonated timetable or the `syncService` studium fallback.
