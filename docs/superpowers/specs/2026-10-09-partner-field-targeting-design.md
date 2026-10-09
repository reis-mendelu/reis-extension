# Partner field targeting — design

Date: 2026-10-09 · Builds on: society catalog (#452, `20260926120000_societies_catalog.sql`),
event audience (`20260916210000_spolky_events_subscribers_only.sql`, `src/utils/eventAudience.ts`)

## Problem

reIS sells one partner per field: a company is shown only to students of its faculty, or of
specific study programmes inside a faculty (e.g. SAP or Red Hat → PEF informatics, KPMG → FRRMS,
EY → PEF). The pitch deck and the outreach emails to KPMG, ADMD and Red Hat promise this
**"od jarního semestru 2027"**.

Today none of it is enforced:

- A partner is an ordinary `societies` row (EY = `ey`). Nothing marks it as a company.
- `facultyKey` only drives first-run auto-follow and the audience label (`resolveSociety.ts`). An
  event is restricted only when its author ticks "for our people" (`subscribersOnly`).
- The "Spolupracujeme s firmami" block (`AboutSection.tsx`) hard-codes `EyMark` for every student,
  exists on the phone tree only, and is hidden under 780 px of height.
- Usage statistics know the faculty, not the programme, so partner pitches quote estimates from
  admission caps.

## Goal

Adding a partner, or changing who it reaches, is a data edit in the admin console. No code
change and no app release. Matching happens on the student's device. Partners keep seeing nothing
from a student's IS.

## Decisions

### 1. Data (one migration)

`public.societies` gains:

| Column | Type | Rule |
|---|---|---|
| `kind` | `text not null default 'society'` | `check (kind in ('society','partner'))` |
| `audience` | `text[] null` | Every element matches `^(mendelu\|pef\|af\|ldf\|zf\|frrms)(:[A-Z]-[A-Z0-9]{1,10})?$`; a partner must have a non-empty audience. |
| `mark_light_path` | `text null` | Same bucket and path rule as `logo_path`. A transparent, full-colour wide mark. Required for a partner by the console form, not by the database, so the `ey` backfill below is valid before its marks are uploaded. |
| `mark_dark_path` | `text null` | Same rule. Optional dark-mode variant; when absent the light mark is used. |

- **Audience tokens.** `'frrms'` is the whole faculty. `'pef:B-OI'` is the PEF programme whose base code is `B-OI`. `'mendelu'` is everyone. A student matches if any token matches.
- **Validation.** The array rule is enforced through an immutable SQL function, `societies_audience_valid(text[])`, used in a check constraint. A typo is rejected at write time instead of silently hiding a partner from everyone.
- **Societies are unchanged.** Their `audience` stays null and their behaviour is exactly today's.
- **Data change in the migration:** `ey` becomes `kind = 'partner'`, `audience = '{pef}'`. Its marks are uploaded in the console after the migration. Until then the block falls back to `EyMark` for `ey` only (see §4).

`public.daily_active_usage` gains `programme text null`, checked against `^[A-Z]-[A-Z0-9]{1,10}$`.

`track_daily_usage` gains `p_programme text default null`.
- **Keep one function.** Drop the old signature and create the new one, as the earlier usage migration did. Released clients call it with three named arguments and keep working; PostgREST must never see two overloads.
- **Same coalescing as faculty.** A null programme does not erase a known one for the same day.

Stats RPCs return a programme breakdown beside the faculty one.
- **Hide small groups.** Groups under 5 devices are suppressed, as for faculty.
- **Count the failures.** A "programme unknown" bucket is returned for students whose faculty is known but whose programme was not parsed.
- **Production differs from the repo.** The live `usage_stats` / `usage_stats_unchecked` were edited by hand and differ from the repo's migration. Read the production definitions (`pg_get_functiondef`) and build on those, not on the repo copy.

### 2. Matching on the device

- **Viewer gains `programme: string | null`.**
  - It is the base code of `UserParams.studyProgram`: the first two hyphen-separated parts, so `B-OI-ZBOI` becomes `B-OI`. It is null when the `#titulek` regex did not match.
  - The store gets `userProgramme`. It is cached in the existing `meta/viewer_audience` IndexedDB record beside faculty and Erasmus, so a cold start knows it before IS answers.
  - An identity switch already wipes that record.
- **New pure module `src/utils/partnerAudience.ts`.** It holds `baseProgramme(code)` and `matchesAudience(audience, viewer)`.
  - A null viewer faculty matches nothing.
  - A null programme still matches faculty-only tokens.
- **`canSee` (`eventAudience.ts`).** For a partner's events it returns `matchesAudience(...)`, whatever the event's `subscribersOnly`. Society events keep today's rule.
- **First-run auto-follow (`resolveSociety.ts`).** A partner is followed only when it matches.
- **Old builds stay safe.** For a partner author the composer forces `subscribersOnly = true` (`ComposerAudienceField` / `EventComposer`). Old builds then show partner events only to the partner's `faculty_key`, never to everyone. A partner row's `faculty_key` is set to its main faculty (PEF for SAP or Red Hat).
- **Admin impersonation.** The picker selects a faculty only, so impersonation sees faculty-level partners, not programme ones. Accepted; a programme override is out of scope.

### 3. Admin console

- **`SocietyForm` gains a type switch: Spolek / Partner.** For a partner it shows:
  - **An audience editor.** One chip per faculty. A chip alone means the whole faculty; an optional comma-separated list of programme codes under a chip narrows it. `societyFormRules.ts` validates with the database's regex and shows the error inline.
  - **Two mark uploads (light, dark).** Each reuses the logo upload path and checks, and previews on the matching background.
- **Saving.** `saveSociety` and `societiesAdmin.ts` write the new columns. `SOCIETY_COLUMNS`, `SocietyRow` and `rowToSociety` read them. An unknown `kind` reads as `'society'`.
- **Stats panel.** It shows the programme breakdown and the "programme unknown" share.

### 4. Partners block on both trees

- **Shared hook `useMatchingPartners()`.** It returns the active partners that match `useViewer()`, sorted by `sortOrder`.
- **Shared `PartnersBlock`.** It renders the existing heading and body copy (`about.partnersLabel` and `about.partnersBody`), then each partner's mark:
  - the dark mark in dark mode when one exists, otherwise the light mark;
  - for `ey` without uploaded marks, `EyMark`;
  - no plate, no card and no link, as today.
- **No match, no block.** When nothing matches, it renders nothing.
- **Phone and iPad.** It replaces the hard-coded mark in `AboutSection.tsx` and keeps the `max-height: 779px` hide: Profile must fit without scrolling. That means short phones (SE, mini) do not show partners. This is a known limit.
- **Extension.** It goes at the bottom of `ProfilePopup.tsx`, where the desktop tree has no partners block today.
- **Copy.** The EY-specific line `about.eyBody` ("Díky nim reIS běží.") is removed; the block shows the shared heading, the body text and the marks only.
- **Layout check.** Verify at 320, 390 and 430 px and at tablet width, in both themes (verify-ui skill).

### 5. Privacy

The daily count gains the programme base code, a new data flow, so these change in the same PR:

- `privacy/disclosures.ts`: the daily-usage row reads "random install id, faculty, programme and platform labels". The policy table is regenerated with `npm run privacy:generate`.
- `docs/privacy-policy-app.md` and `PRIVACY.md`.
- The published gist, at release.
- The store labels at release (`/release`).
- The pitch deck slide and `partner-pitch-brief.md`: stop saying only the faculty abbreviation reaches reIS.

What stays true and is restated in the disclosure:
- Partners receive nothing about students, only aggregate event counts.
- Programme matching for partner visibility happens on the device.
- The programme is sent only as an aggregate label with the anonymous daily count, never with any feature counter or event id. Items 4 and 5 of "What reIS still sends" stay unjoinable.

## Testing (test first)

- `partnerAudience`:
  - `baseProgramme`: plain codes, suffixed codes, junk and null.
  - `matchesAudience`: faculty token, programme token, `mendelu`, null faculty, null programme, multiple tokens.
- `eventAudience.canSee`:
  - a partner's event is hidden from a non-matching viewer even when `subscribersOnly` is false;
  - society behaviour is unchanged (the existing tests stay green).
- `resolveSociety` auto-follow for partners.
- `rowToSociety` with the new columns and an unknown `kind`.
- `societyFormRules`: the audience regex accepts and rejects the same strings as the SQL constraint, from a shared fixture list.
- `useMatchingPartners` and `PartnersBlock`:
  - no match renders nothing;
  - the dark mark is chosen in dark mode;
  - the `EyMark` fallback.
- A tree-parity guard in `src/test/guards/` naming both mounts.
- `feedback.ts` sends `p_programme` (the base code) and sends null when the code is unparsed.
- Migration: run against a local stub Postgres (verify-supabase-sql-locally). It covers the constraint, the `ey` backfill, the single `track_daily_usage` signature, a three-argument call from an old client, and stats suppression.

## Rollout

1. PR to `test`, parked until Dominik decides (park-features-as-prs-not-in-test).
2. Before applying, check every released tag's readers and writers of `societies` and `track_daily_usage` (db-changes-must-not-break-deployed-builds). The new columns are nullable or defaulted, so old readers ignore them.
3. Apply the migration by hand with `npx supabase db query --linked -f` after approval (migrations-do-not-self-apply). Dry-run first in a self-unwinding DO block.
4. Upload the EY marks and enter the partner audiences in the console. The LDF programme codes for ADMD are read from IS first.

## Out of scope

- An internships section.
- Programme impersonation in the console.
- Per-partner copy lines.
- Choosing what a student with several studies sees: the `#titulek` study that is currently selected wins (untested shape).
- Showing partners on phones under 780 px tall.
