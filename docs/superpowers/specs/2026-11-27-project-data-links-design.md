# Data for student projects — a link above the open odevzdávárny (design)

Discussed with Dominik on 2026-11-27 and 2026-11-28. Status: **approved and built**; the page and data are live, the app change and its migration ship with the PR that carries this file (the release applies the migration). Where it differs from the first draft (any subject, once above the list), the Decisions section says so.

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

- One line above a subject's open odevzdávárny, for informatics students and
  for any subject, linking to a page on reisapp.cz with the datasets.
- That page ("Data pro projekty"): per dataset a direct link (JSON and CSV),
  load snippets (web, Python, Java) and project ideas by kind of project, with
  subjects only as examples.
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

- Both trees. `SubmissionBoxList` is shared by the desktop `SubjectsPanel` and
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
- `courseCode` on a box is optional (old caches); since 2026-11-28 the line does not read it, so old boxes show it too.
- The reisapp.cz page follows `reis-page/CLAUDE.md` "Page rules" (scannable,
  visual, persona test).

## Approaches considered

1. **Link where the student reads the assignment, for listed subjects.** Costs
   a short subject list in code, and a release per added subject. Can
   deep-link to `#web` or `#java`. First draft's choice; replaced on 2026-11-28
   by the any-subject, once-per-list line described under Decisions.
2. **One general `study_aids` row under Předměty.** Almost free and retargetable
   from the admin console, but not where the student decides on a topic.
3. **Both.** Cheap safety net for subjects not on the list. Not chosen for now;
   easy to add later because `study_aids` already exists.

## Decisions

Dominik's:
- The link sits with the odevzdávárny (2026-11-27); on 2026-11-28 he chose "once above the list" over a row on every card.
- Informatics only; the page serves web and Java projects first.

My calls, for him to check:
- Audience: exactly reIS for Claude's (`pef:B-OI`, `pef:B-AII`, `pef:N-OI`),
  by calling `isReisForClaudeAudience`. Built that way because the guard
  `noProgrammeListsInCode` refuses a second programme list in code; the two can
  be split later in `utils/projectData.ts`.
- **Any subject (Dominik, 2026-11-28: "it doesn't matter for which subject it is").** The line shows under every open odevzdávárna for the informatics audience, and links the page top; the page itself splits web from Java. This replaces the earlier EBC-VWA / EBC-PJ list with `#web` / `#java` deep links.
- **Placement: once** above the open boxes of a subject (in the list header of
  `SubmissionBoxList`), only when at least one box is open; not on each card,
  and not when only submitted or closed boxes exist.
- One counter label (no partner is involved), say `project_data_opened`.
- No deep link: the line opens the page top and the page itself splits web from Java and the rest.
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
4. The list line, counter, disclosure, admin label, tests.

## Left to the builder

Wording of the line (cs/en), the exact data-page layout, file names of the
name-free export and test shapes. (Built as a plain bordered link row.)
