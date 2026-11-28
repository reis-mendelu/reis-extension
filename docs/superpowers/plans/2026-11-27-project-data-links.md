# Project data links Implementation Plan

> **Changed 2026-11-28 (Dominik: "it doesn't matter for which subject it is"):** the line shows on every open odevzdávárna for the informatics audience, with no subject list and no `#web`/`#java` deep link. `projectDataUrl(language)` takes only the language and `ProjectDataLink` takes no props. The subject-specific lines below are history.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A B-OI student reading an open odevzdávárna for EBC-VWA or EBC-PJ sees a "Data pro projekt" line that opens a reisapp.cz page with real, name-free MENDELU datasets.

**Architecture:** Three repos, shipped in this order: `reis-data` gets a name-free `student-data/` export (served by jsDelivr, CORS open); `reis-page` gets the page that lists it; `reis-extension` gets the counter and one line on the shared `SubmissionBoxCard`, which both product trees render. No backend, nothing hosted.

**Tech Stack:** Node ESM scripts + vitest/`node:test` in reis-data; static HTML in reis-page; React 19, Zustand, vitest, Supabase SQL migration in reis-extension.

**Spec:** `docs/superpowers/specs/2026-11-27-project-data-links-design.md`

## Global Constraints

- Audience tokens: `pef:B-OI`, `pef:B-AII`, `pef:N-OI`; matched on the device with `matchesAudience` and `useViewer` (impersonation then follows the persona).
- Subjects to start with: `EBC-VWA` (deep link `#web`) and `EBC-PJ` (deep link `#java`); any other `courseCode`, or none, shows no line.
- The line is on **open** boxes only, a second fold row under Pokyny; never on submitted or closed ones.
- One counter label, `project_data_opened`; click and middle-click count, never right-click; nothing about the student goes with the link.
- No teacher names, no student names or e-mails, no free text in anything the page links; no mention of My MENDELU anywhere; no buildings or rooms on the page.
- Both trees: the edit is in `src/components/SubmissionBoxes/` (shared); verify at 320/390/430 and tablet 834 and on desktop (`verify-ui`).
- Czech section ids in both languages (`#web`, `#java`); page rules in `reis-page/CLAUDE.md` apply (scannable, persona test, text in HTML).
- Migration is additive and applied to prod **before** the build that sends the label ships; no `begin;`/`commit;`.
- `npm run check` before every push in reis-extension. Base the PR on `test`.

## Review Focus

- A box with no `courseCode` (old cache) → no line, no crash.
- A viewer with no programme label (`null`) or another faculty → no line.
- English UI → English page URL (`/en/guides/project-data`), Czech → `/navody/data-pro-projekty`.
- Impersonated persona outside the audience → no line, even if the real admin is in it.
- Export leaks: any output string containing `@`, a `garant`/`teachers`/`student`/`email` key, or any Erasmus free text fails the build; blank or comma-decimal costs (`"2,60"`, `""`) become `2.6` and `null`.

---

### Task 0 (done 2026-11-28, before everything else): remove the leaked student e-mails

Every Erasmus report in the public `reis-data` carried `student.email` (UČO@node.mendelu.cz): 1,717 addresses in 28 files. Removed in reis-mendelu/reis-data#10; the crawler that would bring them back is fixed in reis-mendelu/reis-scraper#25. **Both must be merged, and the changed files purged from jsDelivr, before Task 2's page goes live**, so a visitor who follows the page into the repo finds no addresses. Not done here: removing `student.name` (the app shows it) and history rewriting; both are Dominik's decisions. Task 5 also drops `email` from `ErasmusReport.student` in `src/types/erasmus.ts`.

**Distribution decision (Dominik, 2026-11-28):** the data is offered through the odevzdávárna card only. Nothing is posted in the B-OI Discord. Demand is read from the `project_data_opened` counter and, for the files themselves, from jsDelivr's per-file hit statistics.

### Task 1: Name-free export in reis-data

**Files:**
- Create: `/Users/Dominik.Holek/Documents/reis/reis-data/scripts/buildStudentData.mjs`
- Create: `/Users/Dominik.Holek/Documents/reis/reis-data/scripts/buildStudentData.test.mjs`
- Create (generated): `student-data/success-rates.json`, `success-rates.csv`, `erasmus.json`, `erasmus.csv`, `README.md`

**Interfaces:**
- Produces: `buildSuccessRows(subject): SuccessRow[]` with `SuccessRow = {code, nameCs, nameEn, facultyId, semester, year, term, a, b, c, d, e, f, fn, pass, fail}`; `buildErasmusRows(country): ErasmusRow[]` with `ErasmusRow = {countryId, hostUniversity, hostCountry, stayFrom, stayMonths, accommodationPerDay, foodPerDay, transportCost, recognized, rating}`. Public URLs: `https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/student-data/<file>`.

- [ ] **Step 1: Write failing tests** (follow `curatedZ.test.mjs` style): `buildSuccessRows` on `subjects/A1AP.json` yields one row per semester per term with no `garant`/`teachers` keys; `buildErasmusRows` on a fixture report with `student: {name, email}` and free text yields rows whose `JSON.stringify` contains no `@` and no student name; `"2,60"` → `2.6`, `""` → `null`.
- [ ] **Step 2: Run** `node --test scripts/buildStudentData.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the two functions plus a `main()` that reads `subjects/*.json` and `erasmus/country-*.json`, writes the four files (JSON and CSV from the same rows), and exits non-zero if any output string matches `/@/`. Erasmus keeps only the fields in `ErasmusRow`; free text is never read.
- [ ] **Step 4: Write `student-data/README.md`** (Czech, short): per file the columns with one-line meaning, sources named as "IS MENDELU statistiky" and "veřejné stránky MENDELU (Erasmus)", the licence line. **Do not commit the licence line or publish until Dominik confirms the licence and the anonymisation** (spec "Still open").
- [ ] **Step 5: Run** `node --test scripts/*.test.mjs` and `node scripts/buildStudentData.mjs`. Expected: all pass, four files written, `grep -l '@' student-data/*` prints nothing.
- [ ] **Step 6: Commit** on a branch from `main`, open a PR to reis-data; do not merge before Dominik's OK.

### Task 2: The page in reis-page

**Files:**
- Create: `navody/data-pro-projekty.html`, `en/guides/project-data.html` (read `reis-page/CLAUDE.md` first; copy `navody/reis-v-claude.html` / `en/guides/reis-for-claude.html` as the shape)
- Modify: `navody/index.html`, `en/guides/index.html` (list the guide), `seo/changes.csv` (one row), sitemap via script

**Interfaces:**
- Consumes: Task 1's file URLs.
- Produces: stable anchors `#web` and `#java` on both pages.

- [ ] **Step 1: Write the page**: first screen = what it is in one line, "termíny z roku 2026"; two sections `#web` and `#java`, each with the datasets as cards (direct URL, 4–5 sample fields, one copy-paste snippet: `fetch(url)` for web, a JSON read for Java) and three one-line project ideas (e.g. "Který předmět letos pálí", "Kolik stojí Erasmus v Helsinkách"). Text in the HTML, no JS-built content.
- [ ] **Step 2: Run** `node scripts/guide-lists.mjs && node scripts/sitemap-lastmod.mjs`; add the `seo/changes.csv` row per `seo/README.md`.
- [ ] **Step 3: Persona test**: a fresh subagent plays a B-OI first-year on a 390 px phone, 1–2 minutes; fix what it reports.
- [ ] **Step 4: Verify**: serve locally, open both pages at 390 and desktop, click every dataset link and expect HTTP 200 with `access-control-allow-origin: *` (the files must be on `main` of reis-data first).
- [ ] **Step 5: Send Dominik the 390 and desktop screenshots; open the PR; merge only after his OK** (a new layout waits for him).

### Task 3: Counter label end to end

**Files:**
- Create: `supabase/migrations/20261127140000_feature_project_data.sql`
- Modify: `src/api/featureUsage.ts` (add to `FEATURE_SIGNALS`), `src/components/AdminConsole/featureSignalLabels.ts`, `src/i18n/locales/cs.json` + `en.json` (`admin.stats.signalProjectDataOpened`), `privacy/disclosures.ts` (`feature_counters`: count words, one more policy row)
- Test: `src/api/__tests__/featureSignalWhitelist.test.ts` (existing, must pass) and `scripts/lib/__tests__/privacyDisclosures.test.ts`

**Interfaces:**
- Produces: `FeatureSignal` includes `'project_data_opened'`, used by Task 5 via `trackFeatureSignal('project_data_opened')`.

- [ ] **Step 1: Add the label to `FEATURE_SIGNALS` only; run** `npx vitest run featureSignalWhitelist`. Expected: FAIL (migration disagrees).
- [ ] **Step 2: Write the migration** by copying `20261127130000_feature_library_booking.sql` and widening the list in `track_feature_usage`, `track_feature_usage_v2` and the column check with `'project_data_opened'`.
- [ ] **Step 3: Admin label, i18n, disclosure** (seven→eight feature uses; "a tap on the project-data line on an odevzdávárna card"), then `npm run privacy:generate`.
- [ ] **Step 4: Run** `npx vitest run featureSignalWhitelist privacyDisclosures`. Expected: PASS.
- [ ] **Step 5: Commit.** The migration must be applied to prod before the build ships (`/release` does it; note it in the PR).

### Task 4: Targeting rule

**Files:**
- Create: `src/utils/projectData.ts`, `src/utils/__tests__/projectData.test.ts`

**Interfaces:**
- Produces: `projectDataUrl(courseCode: string | undefined, language: string): string | null` (`https://reisapp.cz/navody/data-pro-projekty#web` / `#java`, English `https://reisapp.cz/en/guides/project-data#web` / `#java`; `null` for any other code or none); `isProjectDataAudience(viewer: AudienceViewer): boolean`, which delegates to `isReisForClaudeAudience` (no new programme list in code: `noProgrammeListsInCode`).

- [ ] **Step 1: Write tests**: EBC-VWA cz → `#web` URL; EBC-PJ en → `#java` English URL; `undefined` and `EBC-M` → `null`; viewer `{facultyKey: 'pef', programme: 'B-OI'}` true, `B-EM` false, `{facultyKey: 'af', programme: 'B-OI'}` false, `programme: null` false.
- [ ] **Step 2: Run** `npx vitest run projectData`. Expected: FAIL.
- [ ] **Step 3: Implement** with `matchesAudience` from `utils/partnerAudience.ts`; subject map is a const object in the same file.
- [ ] **Step 4: Run** the test. Expected: PASS. **Step 5: Commit.**

### Task 5: The line on the box card

**Files:**
- Create: `src/components/SubmissionBoxes/ProjectDataLink.tsx`
- Modify: `src/components/SubmissionBoxes/SubmissionBoxCard.tsx` (render it after `BoxInstructions`), `src/i18n/locales/cs.json` + `en.json` (`odevzdavarny.projectData`, `odevzdavarny.projectDataHint`)
- Test: `src/components/SubmissionBoxes/__tests__/projectDataLink.test.tsx` (use `boxFixtures.ts`, render through `ZaznamnikTab` like `ZaznamnikTabBoxes.test.tsx`)

**Interfaces:**
- Consumes: `projectDataUrl`, `isProjectDataAudience` (Task 4), `trackFeatureSignal('project_data_opened')` (Task 3), `useViewer()`, `useTranslation()`.
- Produces: `ProjectDataLink({ courseCode }: { courseCode: string | undefined }): JSX.Element | null`.

- [ ] **Step 1: Write failing tests**: B-OI viewer + EBC-VWA box → link with `href` ending `#web`, text from `odevzdavarny.projectData`; B-OI + `courseCode: undefined` → none; `B-EM` viewer → none; B-OI + EBC-M → none; click and `auxclick` with `button: 1` each call the tracker once, `button: 2` none; English language → `/en/guides/project-data`; impersonated persona `B-EM` while the real viewer is B-OI → none.
- [ ] **Step 2: Run** `npx vitest run projectDataLink`. Expected: FAIL.
- [ ] **Step 3: Implement** `ProjectDataLink` as a plain `<a target="_blank" rel="noopener noreferrer">` row styled like `BoxInstructions` (`border-t border-base-content/10 px-3 py-1.5`, `text-xs`, `ExternalLink` icon), outside the card's own `<a>`; mount it inside the card wrapper after `BoxInstructions`.
- [ ] **Step 4: Run** the new test plus `npx vitest run SubmissionBoxes SubjectsPanel` . Expected: PASS.
- [ ] **Step 5: `verify-ui`** at 320/390/430, tablet 834 and desktop with a seeded B-OI persona and an EBC-VWA box; confirm the line is present, nothing overflows, and it is absent for a B-EM persona. Send Dominik before/after PNGs.
- [ ] **Step 6: `npm run check`, commit, open the PR to `test`** (answer "does the tree-parity hook ask": the edit is in shared code, so both trees have it).

---

**Rollout order:** Task 1 → Task 2 (both merged and live) → Task 3 migration applied → Tasks 4–5 in one PR to `test` → release.
