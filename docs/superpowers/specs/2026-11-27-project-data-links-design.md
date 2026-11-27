# Data for student projects — a link on the odevzdávárna card (design)

Discussed with Dominik on 2026-11-27. Status: **draft, awaiting his approval**; nothing is built.

## Intent and why

Students on Otevřená informatika (B-OI) hand in web and Java projects through
odevzdávárny (EBC-VWA, EBC-PJ), and Dominik sees that many do not know what
data to work with: the VWA specification asks for a topic, market research, an
ERD and wireframes, so the student first has to invent a domain and find data.
reIS already holds real data from the student's own university that nobody else
has (subject success rates 2005–2025, Erasmus, syllabuses) and already serves it as JSON from jsDelivr with CORS open. It is
simply not offered to them. Success: a B-OI student reading a project
assignment sees, in one tap, where to get real MENDELU data for it.

## Goals

- A line on the odevzdávárna card, for informatics students and for listed
  technical subjects, linking to a page on reisapp.cz with the datasets.
- That page ("Data pro projekty"): per dataset a direct link, a plain
  description of the fields and 3–4 project ideas, split into "pro web" and
  "pro Javu".
- Both product trees get it, because `SubmissionBoxes` is shared.
- The link is counted (install-level feature counter).

## Non-goals

- No hosted API or backend, and nothing passes through reIS servers: data stays
  static JSON on the CDN.
- No new reIS for Claude tools in this step (the public map, building and
  Erasmus data in the MCP is a later step, only if students ask).
- No SQL sandbox revival in this step (the existing one is stale and unlinked).

## Anti-goals

- Becoming a "which teacher fails most" dataset: the data the page offers must
  not carry teachers' names (see Decisions).
- Showing the link to students outside informatics, or on every box.
- A settings screen, a toggle, or a multi-step flow.

## Constraints

- Both trees. `SubmissionBoxCard` is shared by the desktop `SubjectsPanel` and
  the phone's `SubjectsScreen`, so one edit lands on both; verify at tablet
  width too (`verify-ui`).
- Counting rule (`docs/feature-counters.md`): one label in `FEATURE_SIGNALS`, a
  migration widening the whitelist in the function and the column check, the
  disclosure in `privacy/disclosures.ts`, an admin label. **Apply the migration
  before the build that sends the label ships**; unknown labels are dropped
  silently.
- `reisapp.cz` is already a listed host in `noStudentDataLeaves`, so no new host.
- The audience is matched on the device (`matchesAudience`); nothing about who
  matched is sent.
- `courseCode` on a box is optional (old caches): a box without it shows no link.
- The reisapp.cz page follows `reis-page/CLAUDE.md` "Page rules" (scannable,
  visual, persona test).

## Approaches considered

1. **Link on the card, for listed subjects (chosen).** Appears when the student
   reads the assignment. Costs a short subject list in code, and a release per
   added subject. Can deep-link to `#web` or `#java`.
2. **One general `study_aids` row under Předměty.** Almost free and retargetable
   from the admin console, but not where the student decides on a topic.
3. **Both.** Cheap safety net for subjects not on the list. Not chosen for now;
   easy to add later because `study_aids` already exists.

## Decisions

Dominik's:
- The link sits on the odevzdávárna card (2026-11-27).
- Informatics only; the page serves web and Java projects first.

My calls, for him to check:
- Audience: exactly reIS for Claude's (`pef:B-OI`, `pef:B-AII`, `pef:N-OI`),
  by calling `isReisForClaudeAudience`. Built that way because the guard
  `noProgrammeListsInCode` refuses a second programme list in code; the two can
  be split later in `utils/projectData.ts`.
- Subjects to start with: **EBC-VWA and EBC-PJ**. More are added once we see
  which other technical subjects hand in projects.
- Shown on open boxes only, as a second fold line under Pokyny, not on submitted
  or closed ones.
- One counter label (no partner is involved), say `project_data_opened`.
- Deep link `#web` for VWA, `#java` for PJ.
- **Erasmus is offered only as an anonymised, numbers-only export.** Found on
  2026-11-27: all 1 580 Erasmus reports in the public `reis-data` carry the
  student's name and university e-mail (`student.name`, `student.email`), plus
  free text. The page links neither those files nor any free text; the export
  keeps host university, country, stay length, per-day costs, recognition and
  rating only. (The existing files and the app card that shows names are a
  separate, older matter, raised with Dominik apart from this work.)
- First datasets on the page: success rates (name-free export) and the
  anonymised Erasmus numbers.
  Not syllabuses (75 MB), not the 3D model, and **not buildings and rooms**:
  those are the only data that comes from My MENDELU's map API, and Dominik
  does not want My MENDELU mentioned (2026-11-27). So the page and the licence
  note name no such source because the page offers none. The map files stay in
  the public repo exactly as today. A map dataset on the page can come later,
  as its own decision.

Still open, his to answer before the page ships:
- **Licence for `reis-data`.** It has none today. Proposal: a short licence
  file covering reIS's own compilation of what the page offers, with its
  sources named (IS statistics, MENDELU's public Erasmus pages).
- **Teacher names.** Proposal: the page links only a name-free export
  (no `garant`, `teachers`, `course_teachers`); the existing files stay as they
  are for the app.

## Order of work

1. Migration for the label, applied to prod first.
2. Name-free export and licence in `reis-data`.
3. The page in `reis-page` (EN and CS) after reading its page rules.
4. The card line, counter, disclosure, admin label, tests.

## Left to the builder

Wording of the line (cs/en), the exact data-page layout, file names of the
name-free export, test shapes, and whether the line is a `<details>` fold or a
plain link row.
