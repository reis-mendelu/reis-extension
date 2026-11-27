# Admin personas: one-tap "view as" for reIS admins — design

**Date:** 2026-11-27 · **Status:** agreed with Dominik in chat (grilling, 2 rounds), pending plan
**Builds on:** `2026-09-26-admin-student-impersonation-design.md` (the overlay, the live IS fetch, the picker)

## Goal

A reIS admin taps the avatar and becomes a student of another programme in one tap, and back
again with "Já". The point is to **spot mistakes we never see**, because we only ever look at reIS
as students of our own programmes. A persona must therefore look like that student everywhere a
student's identity changes what reIS shows, not only in the plan and timetable.

## Decisions (Dominik, 2026-11-27)

| # | Question | Decision |
|---|---|---|
| 1 | Which personas | Eight fixed personas, all **1st year**: B-OI (IT), B-F (finance), B-EM (economics, our largest group), B-METS (FRRMS), B-ZIN (AF), B-SNBD (LDF), B-RASZ (ZF), Erasmus. B-OI stays even though Dominik is B-OI: Tonda (B-F) uses it. |
| 2 | What a persona changes | The **whole identity**: faculty, programme, Erasmus/exchange status and year, for every reader, plus plan, subjects and timetable. |
| 3 | Gesture | **Avatar only**: tap the avatar → one-tap persona list, "Já" first. No ‹ › on the banner. |
| 4 | Speed | Cache each persona after its first use; a switch to a cached persona is instant. No prefetch at boot. |
| 5 | Erasmus content | `Z-EXC` at PEF, ~5 real English-taught PEF courses (lecture + first seminar each), **no study plan** (IS's catalogue has none for Z-EXC). |
| 6 | Erasmus language | The UI switches to English while the Erasmus persona is active, in memory only; "Já" restores the admin's language. |
| 7 | Screens a persona cannot fill | Exams, grades, files, Záznamník, odevzdávárny show a "Persona: not available" note instead of their normal empty state. |
| 8 | Where the list lives | A constant in code. No Supabase row, no migration, no disclosure. |
| 9 | The old picker | Stays, as "Jiný obor…" at the bottom of the persona list. |
| 10 | Study group | The **first group IS lists** for the programme (not a literal `1`: a group that does not exist silently returns lectures only). |
| 11 | Freshness | A cached persona refreshes from IS in the background when older than one day. |
| 12 | Lifetime | The active persona survives a restart (as today). |
| 13 | Indicator | A slim, non-dismissible banner: persona name + "Já". |
| 14 | Who | `reis_admin` only (Dominik and Tonda). |
| 15 | Data must work | Every persona is checked live against IS before shipping and at each semester start (see *Persona check*). |

Usage numbers behind #1 (prod `daily_active_usage`, distinct installs, last 14 days, 2026-11-27):
B-EM 772, B-F 282, B-MOS 216, B-METS 216, B-OI 181, B-RER 129, … AF B-ZIN 85, LDF B-SNBD 49,
ZF B-RASZ 17, Z-EXC ≈ 130 across faculties (PEF 43, the most).

## Facts the design rests on

- **Today's impersonation** (`createImpersonationSlice.ts`, `ImpersonationPicker.tsx`) is four selects
  and a Start button, then a live IS fetch: ~4 requests for year 1, ~2 POSTs per subject for year 2+.
  It overlays `OVERLAY_KEYS` (`src/store/overlay/overlayGuard.ts`) and nothing else.
- **What it leaves as the admin's own today:** `userProgramme` (partner `faculty:programme`
  audiences, Novinky programme targeting, the programme Discord card), `isErasmus` (hard-coded false
  in `useViewer`), `userFaculty` (menu tabs, faculty search, `buildFeed`), and `getUserParams()`
  readers (`ErasmusPanel` faculty filter, `api/feedback.ts`). `useViewer` special-cases the
  impersonated faculty only.
- **Exchange students** are IS programme `Z-EXC` (`EXCHANGE_PROGRAMME`, `utils/eventAudience.ts`).
  `viewer.exchange` shows ESN's events (Erasmus-only ones included) and reIS's own rows, nobody
  else's, no partners (decision 2026-10-29). The persona inherits exactly that rule.
- The IS plan catalogue has no plan for `Z-EXC` (checked against reis-scraper's
  `data/study-plans/study-plans.json`).

## Design

### 1. The persona list — `src/features/personas.ts` (new)

```ts
interface Persona {
  id: 'it' | 'finance' | 'economics' | 'frrms' | 'af' | 'ldf' | 'zf' | 'erasmus';
  label: { cz: string; en: string };   // "IT · B-OI", "Erasmus · PEF"
  faculty: 'PEF' | 'FRRMS' | 'AF' | 'LDF' | 'ZF';
  /** Matched against loadOptions() by shortCode, so a re-accreditation (B-RSZ → B-RASZ) resolves. */
  shortCode: string | null;            // null for Erasmus
  year: 1;
  erasmus?: { courses: string[] };     // subject codes, Erasmus only
  language?: 'en';                     // Erasmus only
}
```

Codes are resolved at use, never stored as IS ids: programme ids change with every accreditation.
The Erasmus course codes are picked from IS's course list for incoming exchange students during
the build and pinned here; the persona check fails loudly when one stops resolving.

### 2. Identity overlay — the whole student, one place

Extend the overlay from "data" to "identity":

- Add `userFaculty`, `userProgramme`, `isErasmus` to the guarded keys (a separate
  `IDENTITY_OVERLAY_KEYS` list next to `OVERLAY_KEYS`, guarded by the same `overlayGuard`), so the
  real `loadContext` keeps writing IndexedDB but cannot overwrite the persona in memory.
- The persona's identity: its faculty label, its **base** programme code (`Z-EXC` for Erasmus), and
  `isErasmus: true` for Erasmus.
- `useViewer` drops its impersonation special case and reads the store like any other reader; the
  persona is already in the store. Same for `buildFeed`.
- `getUserParams()` readers that render identity (`ErasmusPanel`'s faculty, and any other found in
  the build by grepping `facultyLabel|studyProgram`) read the store's identity instead, so there is
  one source while a persona is active. `api/feedback.ts` keeps the **real** params: a report an
  admin sends must say who sent it. Each kept-real reader is listed with its reason in a guard test.
- **Language (Erasmus):** the persona sets the store's language without persisting it
  (`setLanguage` writes Chrome sync / storage; the persona path must not). Exit restores the admin's
  persisted language.
- Context ids (`studiumId`, `obdobiId`, `facultyId`, `studentId`) stay the admin's, as today: they
  address IS, and IS is still the admin's session.

### 3. Persona cache

- IndexedDB `meta`, one key per persona (`persona:<id>`): `{ selection, result, fetchedAt }`. No
  new object store, so no IndexedDB version bump (same as `impersonationStorage.ts`).
- **Switch:** cached → apply at once; if `fetchedAt` is older than 24 h, refetch in the background
  and re-apply only if the persona is still active. Not cached → fetch (spinner on that row), then
  apply. The old picker's one-offs are not cached.
- A failed fetch leaves the current identity in place and shows the error on that persona's row.
  Never half-applied.
- Cleared with the rest on admin logout, IS logout and an identity change (the existing exit paths).
  A cached result from another period is dropped, like today's `expired`.

### 4. Erasmus fetch

No plan. For each pinned course code: the timetable's `predmet=<id>` query, keeping the lecture(s)
and the first seminar slot (the existing year-2+ path, `pickSlots.ts`). Subjects are built from those
courses. The plan screen shows what a student with no plan sees.

### 5. Screens a persona cannot fill

While a persona is active, the views for exams, grades/stats, files, Záznamník and odevzdávárny
render one shared `PersonaUnavailable` note ("Persona: not available here" / CZ) instead of their
empty state. One component, used on both trees.

### 6. UI — both trees

- **Desktop:** the avatar's `ProfilePopup` gets a "Zobrazit jako" section: "Já" (checked when no
  persona), the eight personas (label, faculty chip, a check on the active one, a spinner while
  fetching, an error line on failure), then "Jiný obor…" which opens today's drawer.
- **Phone/iPad:** the same list in `ProfileScreen` (and the sheet that opens from it). Verify at
  tablet width too.
- **Banner:** today's `ImpersonationBanner`, labelled with the persona ("Erasmus · PEF") and a "Já"
  button. Non-dismissible.
- One shared list component (`PersonaList`) under `src/components/Impersonation/`, rendered by both
  trees, so the trees cannot drift.

### 7. Persona check — `npm run personas:check` (new, local only)

Signs in with the admin's own IS credentials from `.env` (the `scrape-real-data` pattern), runs the
real fetch for all eight personas and prints one row each: resolved programme code, group, plan
rows, subjects, lectures, seminars, Erasmus courses resolved. Exits non-zero when any persona has
0 subjects, 0 lectures, 0 seminars (year 1 with a group), or an unresolved code. Never in CI (IS
credentials never leave the laptop). Run before shipping and at each semester start.

## Out of scope

- Years 2+ as personas (the old picker still does them).
- Exams, grades, files etc. for a persona: personal in IS, cannot be fetched for a programme.
- Prefetching personas at boot.

## Tests (test first)

- `personas.ts`: every persona resolves against a trimmed `loadOptions` fixture; B-RSZ/B-RASZ-style
  variants resolve by name.
- Identity overlay: with a persona active, `loadContext` writing a real faculty/programme/Erasmus
  reaches IndexedDB but not the store; exit restores the real identity. One test per exit path.
- Viewer: the Erasmus persona sees ESN + reIS rows only; the B-OI persona matches a `pef:B-OI`
  partner and not `pef:B-F`.
- Language: entering Erasmus sets `en` in memory, writes nothing to storage; exit restores.
- Cache: cached switch applies without a fetch; >24 h triggers one background fetch; a failure keeps
  the current identity.
- `PersonaUnavailable` replaces the empty state on each listed view.
- Kept-real `getUserParams` readers pinned in `src/test/guards/` with reasons.
- Tree parity: the list on `ProfilePopup` and `ProfileScreen`; `verify-ui` at 320/390/430 and tablet
  width, both themes, before/after PNGs to Dominik.
- Live: `npm run personas:check` green, then each persona opened on the dev webapp and the iPad.

## Steps (one PR each, into `test`)

| # | Step | Depends on | State |
|---|---|---|---|
| A | A persona started from today's picker changes faculty, programme and Erasmus for every reader (design §2, without language). | — | On test |
| D | Screens a persona cannot fill show one "Persona: not available" note (design §5). | — | On test |
| B | The avatar opens the one-tap list of the seven programme personas, cached, with "Já" and "Jiný obor…", checked by `npm run personas:check` (design §1, §3, §6, §7). | A | Defined |
| C | The Erasmus persona: pinned English PEF courses, Z-EXC identity, English UI in memory, in the list and the check (design §1, §2 language, §4). | B | Defined |

A and D touch different files and run in parallel. B and C run after the step before them merges.

## Privacy and counting

- No new data leaves the device. The fetch is the admin's own IS session, as today; nothing goes to
  Supabase. `privacy/disclosures.ts` does not change.
- No feature counter: admin-only, two users. The PR says so in one line.
