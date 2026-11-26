# reIS for Claude map: acceptance scenarios

The four "it works" checks from the design record
(`2026-11-25-reis-for-claude-map-design.md`), written as scenarios a student persona can run.
Each step of the map re-runs the ones it should move; the last column of the table says which.

## How a scenario is run

- A fresh sub-agent plays Claude in a chat with a **first-year student** (persona text below). It
  gets the student's message verbatim and nothing else: no hints about folders, no coaching.
- It may use only the reIS for Claude tools (`mcp__reis-for-claude__mendelu_*`, plus the new
  overview, search and build tools once they exist). No repo, no web, no other IS server.
- It reports its final answer, every tool call in order with a call count, and the exact quoted
  evidence. **The pass rule is fixed here and applied by the hub from that log, never by the
  persona**, so it cannot grade itself kindly.
- Runs are read-only against the founder's own IS account, on his laptop. Reports carry subject
  codes and counts only, never grades or names.

## The persona

First-year MENDELU Informatics (PEF) student, just installed reIS for Claude. Types short Czech
questions in their own words, does not know IS folders, Záznamník or odevzdávárna, never coaches
the assistant, expects it to look wherever the answer might be and to say plainly when something is
not there. Wants one concrete answer, date or number first, source after.

## Scenarios

### S1. A date that only a file knows

Message: "kdy píšu zápočtový test z podnikové ekonomiky?" (EBC-PE; the date is in the course
harmonogram PDF, not in IS's exam list).

Pass: the answer states a specific date, or the exact rule that gives it, **and** names the file it
comes from **and** quotes the sentence; the tool log shows a file or search tool used without the
student asking for files; the answer never says "IS has no date" before the files were opened.
Record the call count. Target after steps 3 and 4: at most 5 calls; the ideal run is three
(overview, one search, one read), but a four- or five-call run passes.

### S2. After a restart, IS is asked only for the cheap listings

Run the same S1 question in two server processes, restarting the server between them.
Pass: the second run makes no download of a file whose link and modified date are unchanged; only
the cheap listings (subjects, file listings, points, assignments, exams) go to IS.
Not runnable by a persona (it cannot restart the server or count IS requests): this is an
integration test in step 2, with a fake IS and two store instances on one folder.

### S3. A new file shows up in "what changed"

Pass: after a file is added to a subject's IS folder, the next overview lists it under what
changed, once, and the following overview does not repeat it.
Not runnable by a persona (it cannot change IS): this is an integration test in step 3, with
recorded listings, one before and one after.

### S4. Points and the week ahead, unasked

Message: "jak jsem na tom ve škole a co mě čeká tenhle týden?"

Pass: the answer contains the student's Záznamník points for every subject that has them (from
the points tool or, once step 3 exists, from the overview), the open assignments and the exam terms for the week, all without the
student naming points. Record the call count.

### S5. The ledger matches the student's own calendar

Message: "co mě čeká do konce semestru? testy, zápočty, obhajoby."

Answer key: the student's own University calendar and the school-related part of their Social
Events calendar (programme days with mandatory attendance, a specialisation lecture, university
and society events they chose to attend; personal events are never part of the key) for this semester (Google Calendar, read once by
the hub; **only subject code, kind and date go into this repo**, never points, names or marks). On
2026-11-25 the University calendar held eight school events, two of them already past: tests,
credit tests, a project defence and a written test in four courses, taken from the harmonogram,
the conditions files and IS.

The persona has only the reIS tools, so the **key for this run is limited to events those tools can
find**: the course files and IS. Events that come from a mail, a poster or what the student told
Claude are covered by the ledger tool's own tests (write, read back, merge into the overview) in
step 4b, not by this persona run.

Pass: every event in the key that is still ahead appears in the answer with its date (or window,
marked inferred, with the source file named); nothing in the answer is absent from both the key
and a source file; the answer does not call an inferred date certain. Record the call count
(target after step 4b: overview plus at most two reads). Runs after step 4b.

### S6. Mentioned a week ahead, on every cadence

Not runnable by a persona (it needs a fixed clock): this is an integration test in step 6 with a
ledger holding one test, one defence and one past event.
Pass: with the clock set 14, 7, 3 and 1 days before each event, the weekly digest first lists an
event no later than 14 days out, the daily digest no later than 14 days out and again on the day
before, an event that needs attendance carries the flag, a past event is gone, and an event whose
source file was replaced is listed as "recheck", not dropped.
The digest also proposes a University-calendar entry once for each new ledger event, in the student's
format, updates it when the ledger changes, finds an existing hand-made entry instead of adding a
second, and writes nothing until the student agrees.

## Which step moves which scenario

| Scenario | Before the map                                               | Moved by         | Re-run 2026-11-26 (build of `test` at #768)        |
| -------- | ------------------------------------------------------------ | ---------------- | -------------------------------------------------- |
| S1       | passes with a cooperative persona, 9 calls (see Baseline)    | steps 2, 3, 4, 5 | pass, 5 calls (2 after a built map)                |
| S2       | fails: nothing is kept past the process                      | step 2           | pass (test + live: second build downloaded 0 of 138) |
| S3       | fails: no overview and no change record exist                | step 3           | pass (integration tests)                           |
| S4       | passes, 10 calls (one points call per subject)               | step 3           | pass, 1 call                                       |
| S5       | not run yet: no ledger exists                                | steps 4, 4b      | content pass; call target missed (20 calls)        |
| S6       | fails: nothing reminds, the server is passive                | steps 4b, 6      | pass (integration tests); calendar half not run live |

S1 and S4 are regression checks with a call-count target until a harder persona reproduces the
real failure. S2 and S3 are the ones the build must turn from red to green.

## Baseline (2026-11-25, installed user-scope server, before any step)

The server build was not recorded; it is the one installed as `mcp__reis-for-claude__*` on that
day. Re-run on a build named by version before comparing.

**S1: pass, 9 calls.** Order: subjects, exams, syllabus, points, subject_files, assignments,
schedule, read_file (conditions PDF), read_file (harmonogram PDF). The answer gave Wednesday
9 Dec 2026 13:00, named both files, quoted the harmonogram line "12. týden a 13. týden:
zápočtové písemné práce", and said plainly that the exact date is inferred from the harmonogram
plus the student's even-week seminars, not stated anywhere. It opened files without being told to.

**S4: pass, 10 calls.** Subjects, schedule, exams, assignments, then points for six subjects.
Points for four subjects, the week's timetable, exam terms and open assignments, all unasked.
IS shows no maximum for three of the four, so the answer could not say "out of how many".

**Findings the baseline surfaced:**

- `mendelu_schedule` asked for a range to 15 Feb 2027 returned only through 17 Dec 2026 in the
  first run and rows through the end date in the second. Not a fetcher cap; IS data or a one-off.
- Points need one call per subject, so an overview that returns them together is a real saving.

## Re-run with a neutral persona (2026-11-25, same installed server)

The persona sentence "expects it to look wherever the answer might be" was removed, to test
whether it had coached the first runs. The re-run passes without it, so the sentence was not
necessary for a pass; one run each cannot show it had no effect at all.

**S1: pass, 8 calls.** Same date, same two files, same quoted harmonogram line, same honest
"this is inferred" wording.

**S4: pass, 15 calls.** Points for every subject that has a points sheet (five), the study-plan
credits, open assignments, exam terms and the week's timetable, unasked. Five more calls than
the first run because it also read the study plan, grades and three syllabi.

**Reading:** the real failure (a date answered "IS has no date" until the student said "projdi
soubory") did not reproduce in either run, with or without the sentence. S1 and S4 stay regression
checks with call-count targets after steps 3 and 4: **S1 at most 5 calls, S4 at most 8**. The
map's measurable gains here are fewer calls and no per-subject points loop, plus S2 and S3.

## Re-run on the finished map (2026-11-26, `test` at the step 6 merge, #768)

**How these were run.** The built server (`npm run mcp:build` on `test`, tool count 17) ran under
a stand-in client, `ask.sh`, that lists the tools as the server publishes them and makes one tool
call per fresh server process. Each persona was a fresh Sonnet sub-agent that had only that
stand-in, the persona text and the student's message, and **a fresh, empty store of its own** (so
nothing was saved when it started, the hardest case; the founder's real map was not touched). The
real IS account was read, read-only. The stand-in is not Claude Desktop or Claude Code, so the
tool descriptions reached the persona as text, not through an MCP client. The pass rule was
applied here from the call log, not by the persona. Reports carry subject codes, kinds and dates only.

**S1: pass, 5 calls.** Overview, read of the conditions PDF, read of the harmonogram PDF,
schedule, and one ledger write (4 without the write). The answer gave Wednesday 9 Dec 2026
13:00 as "probably", said plainly that the date is inferred from the harmonogram's "12. týden a
13. týden: zápočtové písemné práce" plus the student's one seminar in those two weeks, named both
files and quoted the harmonogram sentence and the 30-point rule. It opened the files without being
told to and never said "IS has no date". It saved the date to the ledger as inferred, on its own,
because the overview's description says to. With a map already built (see the build below), the
same question is two calls: the overview and one search for "zápočtové písemné práce" in EBC-PE,
which returns both files with the sentence (hub-run, not a persona).

**S2: pass.** `mapPersistence.test.ts` (two store instances on one folder, fake IS) passes. Live,
on the real account: after a full build, a second build in a new server process downloaded 0 of
138 files and reported 138 already saved.

**S3: pass.** `overviewChanges.test.ts` and `refresh.test.ts` pass (a new file in a folder is listed
once under what changed, the next overview and the next refresh do not repeat it). Live, a second
overview straight after the first said "Nothing changed in IS since the last overview."

**S4: pass, 1 call** (baseline 10 and 15). The overview alone gave the points of the four subjects
that have points and named the other four as having none in IS yet, the open assignment and the
handed-in one, the exam terms (none this week, the nearest two named) and the timetable of the
following week, all without the student naming points. Gaps: the answer said it did not know the
pass limits (no syllabus read) and called the rest of this week "empty" as an inference, because
the overview's next-seven-days list began on Monday 30 Nov (Thursday 26 Nov was the run day);
whether the list should start today is not checked.

**S5: content pass, call target missed (20 calls; target overview plus at most two reads).** Key,
read from the student's University calendar and limited to what the tools can find: six events
ahead (EBC-PS hardware-skills credit test, EBC-PE credit test, EBC-VWA project defence, EBA-OTII
test 2, EBC-PS Netacad credit, EBC-MNG credit test), two past tests and the reading week that must
not appear as ahead. The answer listed all six, with the defence and the Management test certain
(registered in IS) and the other four as windows or an inferred day marked inferred with the file
named; it listed nothing past as ahead. It added two things not in the key, each from a source file
or IS (the Java project hand-in on 3 Jan, an optional Matlab assignment on 20 Dec), said which
subjects have no dates anywhere, and said honestly that one subject's conditions are only a PNG it
cannot read. It never called an inferred date certain. Why 20 calls: the store was empty, its one
search found no saved text, and it never called `mendelu_build_my_map`, so it read nine files one
by one, then wrote five ledger entries (one rejected because a field was over 40 characters, then
retried). One ledger entry carries an end date the persona invented (18 Dec; the file says only
"weeks 12 and 13"), which the answer itself did not repeat.

**S6: pass (integration tests), calendar half not run live.** `ledgerOverview.test.ts` and
`refreshDigest.test.ts` pass: events 14, 7, 3 and 1 days out, the attendance flag, a past event
gone, a replaced source listed as "recheck", and the digest prompt's rules (draft only, proposals
until the student says yes, match an existing entry before adding). Nothing was sent and no
calendar was written; the digest prompt was not run against a real mail or calendar connector.

**The first real build** (new, from the design's "still to measure"). `mendelu_build_my_map` on the
founder's account: a dry run reported 138 files in 7 subjects (pdf, zip, pptx, docx, mlx, mat, png
and others), size UNKNOWN. The real build took 87 seconds, downloaded 138, saved text for 103,
skipped 0, failed 0, and stored **124.6 MB** of the 4.0 GB budget. The 35 files without text are
zips, images and similar.

**Findings for later (none blocks the release):**

- The overview shows no file names for the three biggest subjects (24, 26 and 35 files: "0 shown",
  call `mendelu_subject_files`), because the answer is cut to fit. S1 still passed, but the
  harmonogram and conditions files are the ones most likely to be wanted, so the cut could keep
  files with those words in the name.
- A persona with an empty store does not build the map by itself, and S5 pays for it in calls. A
  line in the overview ("N files have no saved text: call mendelu_build_my_map") would do it.
- The ledger's `points` field refused a 40-plus character value; the tool's own message was enough
  for the persona to retry, but a longer limit or a note in the description would save a call.
- Not run: Windows, Claude Desktop through the real MCP client, and the digest through a real mail
  and calendar connector.
