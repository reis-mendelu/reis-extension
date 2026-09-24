# Similar subjects when a subject has no success rates — design

**Date:** 2026-09-24 · **Status:** design approved section by section, spec for review

## Problem

A first-year B-RASZ student (ZF, ZS 2026/2027) opened Úspěšnost on all seven
enrolled subjects and got "Data nejsou k dispozici" every time. The seven codes
are EKOE1, PRVS, TAVKA1, BOTAZ, FYTOP1, GEODZ and ZABAH, and every one returns
404 on `reis-data/subjects/<code>.json`.

Nothing in reIS is broken. ZF rewrote the plan for this intake under the same
accreditation (B-RSZ and B-RASZ are both `B0812A370003`, IS programme 1832 → 3226)
and created new subject codes. The scraper learns subjects from IS's own grade
listing (`/auth/student/hodnoceni.pl`). A code nobody has been graded in yet is
not on it, so no data can exist before the Jan/Feb 2027 exam period.

Scale for ZS 2026/2027, counting subjects taught this semester without data (the
sport centre excluded): ICV 20, ZF 30, LDF 17, PEF 8, AF 3, FRRMS 2. Of these,
60 have a public syllabus. IS records no link from a new subject to an old one:
every one of the 60 has an empty "Vyučován v předchozích obdobích", and ZF
publishes no conversion table.

## What the stress test established

We compared the 60 against their closest old same-faculty subjects on name,
guarantor, teachers, literature and completion type. Two reviewers labelled each
one blind from the full syllabi and agreed on 57 of the 60. **They are the same
model with the same prompt, so their agreement shows consistency, not
correctness.**

- Verdicts: 25 have a same-course predecessor, 9 have a predecessor whose
  completion type changed (zápočet ↔ zkouška), 5 are ambiguous, 4 are splits or
  merges, and 14 have no predecessor among the candidates.
- **An automatic pick is unsafe.** Picking by name alone got 9 of 28 wrong. The
  strictest rule (same name, only one such old subject, same completion type,
  same guarantor) got 12 of 12 right, which means a floor of about 75%, not
  100%. It also found only half of the real matches, and 2 of its 12 hits have
  no syllabus content to check.
- The same subject's pass rate moves a median of 6 pp over up to four years.
  Different subjects with an identical name differ by a median of 4 pp in the
  same semester, and 13% of them by more than 20 pp. **A correct predecessor is
  a fair preview. The risk is in the picking.**

That gives the design: **reIS suggests, the student picks, and every preview is
labelled as another subject.** The app shows evidence, never a verdict.

## Goal and non-goals

- **Goal:** on a subject with no success rates, offer up to three similar
  subjects from past years, each with the plain reasons it was offered, and let
  the student preview one.
- **Non-goal:** attributing an old subject's numbers to the new one anywhere.
  Pass-rate badges in the subject list, semester insights and `AttemptBadge`
  keep showing nothing for the new code.
- **Non-goal:** a confidence score or "best match". The file carries reasons,
  not a ranking the UI could present as certainty.
- **Non-goal:** any change to what is transmitted about the student.

## 1. Data: reis-scraper → reis-data

### New step: `scripts/build-similar.ts`

It runs in the `scrape-reis-data` procedure right after `audit/export-data.ts`.
It reads that export (`dist-data/subjects/`, `dist-data/syllabuses/`) and the
committed `data/study-plans/`. It can't run inside `npm run semester`, because
that chain never exports `dist-data/`.

1. **Targets.** Every code in the current period's `study-plans.json` or
   `timetable-events.json` that has no exported `subjects/<CODE>.json`. Skip
   the sport centre (`CSA CP`), "Bloková akce" rows and combined timetable rows
   (`"TAVKA1, TVKA1"`).
2. **The new subject's side.** Resolve the IS subject id through the public
   catalogue search (`POST /katalog/index.pl`, `vzorek=<CODE>`), then fetch the
   public syllabus (`/katalog/syllabus.pl?predmet=<id>;lang=cz`). The first
   plan row carries `predmet_id` directly where it exists. We take the Czech and
   English names, completion type and credits, guarantor, teachers and
   literature. No credentials are used.
3. **Candidates.** Same-faculty subjects that have stats. A name prefilter
   (ratio ≥ 0.5, see below) runs over the whole pool first; only the survivors
   get their guarantor from `dist-data/syllabuses/`, or from the public syllabus
   by `predmetId` when no stored syllabus exists. A candidate qualifies through
   at least one of:
   - the same name after stripping programme tags: parentheticals, `Bc.`,
     `mgr.`, and programme short codes such as `ZAKR`, `RASZ`, `RSZ`, `KA` and
     `KRAA`;
   - the same guarantor and a similar name;
   - mostly the same teachers (Jaccard ≥ 0.5) and a similar name.

   **"Similar name"** means a character-sequence ratio of at least 0.5
   (`difflib.SequenceMatcher`, or its TypeScript equivalent) between the
   stripped, lower-cased, accent-free names. The acceptance case ZABAH →
   KLI sits at exactly 0.50. The §4 eval is what moves this threshold, never a
   single case.

   **The numbering guard:** when both names end in a number (I/II/1/2), the
   numbers must match. The stress test ranked "Fytopatologie II" above
   "Fytopatologie I" without it.
4. **Rank** by strength of evidence: same name, then same guarantor, then same
   teachers, then shared literature (ISBN or author). Keep **at most 3**.

The list of programme tags to strip was tuned on this same data. Keep it in one
exported constant so the eval (§4) exercises it, and extend it when a new
programme appears.

### Output: `similar/<CODE>.json`

Written only when at least one candidate qualifies.

```json
{
  "courseCode": "EKOE1",
  "generatedAt": "2026-09-24T12:00:00Z",
  "suggestions": [
    {
      "code": "EKO1R",
      "nameCs": "Ekologie I (RSZ)",
      "nameEn": "Ecology I",
      "reasons": ["sameName", "sameGuarantor", "sameTeachers"],
      "completion": "credit",
      "completionChanged": true,
      "lastYear": 2025
    }
  ]
}
```

- `reasons` is a subset of `sameName | sameGuarantor | sameTeachers | sameLiterature`.
- `completion` is the old subject's completion type (`exam | credit`).
  `completionChanged` compares it with the new subject's.
- `lastYear` is the old subject's newest year with stats.
- The stats are not copied. The app reads the existing `subjects/<oldCode>.json`.
- `meta.json` gains `similarCount`. Its `lastUpdated`, which is the version the
  app checks, covers the new files unchanged.
- A code that gains its own stats is skipped on the next run, so its
  `similar/` file disappears. The feature retires itself per subject.

## 2. App data flow (shared, reaches both trees)

- **`src/api/similarSubjects.ts`:** `fetchSimilarSubjects(code)` requests
  `${CDN_BASE_URL}/similar/${code}.json` with `cache: 'no-cache'`, like
  `subjects/`. A 404 returns `[]`. The payload is validated with a schema next to
  `src/types/schemas/successRates.schema.ts`, and anything malformed is dropped.
- **`src/store/slices/createSimilarSubjectsSlice.ts`:**
  `similarSubjects: Record<string, Suggestion[]>` and
  `fetchSimilarSubjects(code)`. It's persisted in IndexedDB and stamped with the
  reis-data version like stats are (`cdnVersion`, `isStaleForVersion`), so it
  works offline and refreshes after a scrape. That matters in the Capacitor apps,
  where a fetch-once cache would stay stale forever. The success-rate slice
  doesn't grow, because of the 200-line limit.
- **Trigger, from the store:** when `fetchSuccessRate(code)` finishes with no
  stats, it calls `fetchSimilarSubjects(code)`. No new `useEffect` in any
  component, and no extra request for subjects that have data.
- **Preview:** tapping a suggestion calls the existing
  `fetchSuccessRate(oldCode)`, so the stats land under the old code.
  `successRates[newCode]` stays empty. That keeps the non-goal about badges and
  insights true by construction.
- **Privacy:** one new public CDN request, keyed by a subject code that is
  already sent for `subjects/<code>.json`. No new Supabase caller, and
  `src/test/guards/noStudentDataLeaves.test.ts` passes unmodified.

## 3. UI: `SuccessRateTab` (both trees)

`DrawerTabBody` mounts it for the extension drawer and for the phone sheet
(`SubjectDrawerSheet` / `SubjectDrawerScroller`), which the iPad also runs. One
change covers all three, and nothing needs pinning in `src/test/guards/`.

It has three states, replacing today's single "Data nejsou k dispozici":

1. **No data, no suggestions.** "Zatím bez výsledků", with a one-line subtext
   saying reIS has no results for this subject yet. It doesn't claim "new
   subject", because the app only knows that the file is missing.
2. **No data, with suggestions.** The same heading, then "Podobné předměty z
   minulých let" and up to three `bg-base-200` cards. Each card has:
   - the code and name (`nameEn` in English);
   - the reasons as badges: *stejný název · stejný garant · stejní vyučující ·
     společná literatura*;
   - a warning badge when `completionChanged`: *dříve zápočet, nyní zkouška* (or
     the reverse);
   - *naposledy <year>* when `lastYear` is older than last year.

   Tapping a card opens the preview.
3. **Preview.** A sticky banner that can't scroll away: "Náhled jiného
   předmětu: <code> <name>", the type-change warning again when it applies, and
   **Zpět** back to the list. Below it are the normal chart, semester picker and
   IS backlink for the old code. The banner is sticky so that a screenshot of the
   chart can't be mistaken for the new subject's numbers.

**Files:**
- `src/components/SuccessRateTab.tsx`: picks the state.
- `src/components/SuccessRate/SuccessRateView.tsx`: today's chart body, moved
  and taking `stats` as a prop so the preview reuses it.
- `src/components/SuccessRate/SimilarSubjectsList.tsx` and
  `src/components/SuccessRate/PreviewBanner.tsx`.
- New `successRate.*` keys in `src/i18n/locales/cs.json` and `en.json`.

Styling is DaisyUI only: `bg-base-200` cards, `badge` / `badge-warning`, and
text contrast per the desktop-tree rules (ink on tints, `/70` muted text).

## 4. Errors, testing, rollout

### Errors

- If `similar/` fails to fetch or validate, the tab shows state 1 and calls
  `logError('Api.fetchSimilarSubjects', err)`, which stays local like every
  other `logError`.
- If a preview's stats fail, the banner stays up and the normal no-data message
  shows beneath it. Nothing ever renders as the new subject's numbers.

### Scraper tests

- Unit tests for tag stripping, the numbering guard and the qualifying
  conditions.
- The public catalogue search and syllabus parsers get real IS HTML fixtures,
  captured with `--dump-html` and kept in the private scraper repo, never in
  reis-data (parser rules).
- **An eval over the 57 subjects both reviewers agreed on**, pinned at the
  baseline measured on 2026-09-24 by simulating these rules:
  - the true predecessor is in the top 3 for **at least 32 of the 34** "same
    course" and "type changed" subjects. The known misses are ZLZG → LZE and
    2DCD → SYCAD, whose name ratio is below 0.5;
  - `completionChanged` is set for the five genuine credit ↔ exam changes the
    rules find: OZPS, GEODZ, EKOE1, UVDEK and ZABIHY. The other three "type
    changed" verdicts (BOTKA, ABOBC, ZABAH) were changes of content or
    guarantor, which no flag expresses; the student sees only the reasons;
  - **at most 2 of the 14** "no predecessor" subjects get any suggestion (PRKO
    and EBC-VZ do today).

  The eval runs over a frozen fixture (`audit/fixtures/similar/eval.json`):
  the 57 labels plus, for each new subject, every same-faculty old subject with
  stats whose name ratio is at least 0.5 (1,031 entries). The Python reference
  implementation beside it produced these numbers.

  A change that lowers either number fails the eval. Raising the recall is
  fine, but the noise bound still has to hold. The labels are an eval, not
  ground truth (same-model reviewers, whose inputs overlap the rules).

### App tests (test first)

- The schema.
- The slice:
  - a 404 gives `[]`;
  - missing stats trigger the similar fetch;
  - present stats trigger nothing;
  - a stale version triggers a re-fetch.
- The component, in each of the three states:
  - the banner is present in preview;
  - `successRates[newCode]` stays undefined after a preview.
- The `verify-ui` skill: the phone sheet at 320/390/430 px, the iPad width and
  the extension drawer, in both themes, with before/after screenshots.

### Rollout

1. Scraper step, then a reis-data push. The files sit unused until an app reads
   them, and older app versions never request `similar/`. The publish step
   today is `cp -r dist-data/* ../reis-data/`, which deletes nothing. It has to
   `rm -rf ../reis-data/similar` first, or a retired file would outlive its
   subject getting stats. The app never asks for it then, but the dataset
   should still not carry stale files.
2. App PR against `test`.
3. **Acceptance on the real case:**
   - EKOE1 offers EKO1R with the type-change warning;
   - BOTAZ offers BOTAR;
   - PRVS offers PRVES;
   - ZABAH offers KLI with *naposledy 2020/21*.

   Reproducing this in the dev webapp needs a seeded subject without data,
   because the maintainer's own account has none of these codes.

## Open risks

- **The first run happens early in the semester, and some syllabi are still
  empty** ("nebyl definován"). The new subject's name and guarantor are enough
  to qualify a candidate, but the literature signal is missing. Re-running
  mid-semester picks the literature up.
- **ICV and ZF dominate today.** A faculty that rewrites differently (a new
  naming scheme, no shared guarantors) could get no suggestions at all. That
  fails safe: state 1 is shown.
