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
and a source file; the answer does not call an inferred date certain. Record the call count.
Runs after step 4b.

Call ceilings (re-based 2026-11-26, **Claude's call, reversible**; the original "overview plus at
most two reads" was measured four times and is not reachable by a careful persona, because the
question sweeps seven subjects and the persona re-reads files to be sure): **first ask on a built
map, at most 40 calls** (it reads the files and writes the ledger); **the same question again on
the same store, at most 16** (the ledger already holds the file-derived events, nothing is
written). These are regression ceilings set just above what was measured (37 and 15), not a goal
the map has met; a lower number would need a persona that trusts the overview and the ledger instead of re-checking files.

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
| S5       | not run yet: no ledger exists                                | steps 4, 4b      | content pass 4 of 4; ceilings met (37 first, 15 repeat)   |
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

## Re-run on the finished map (2026-11-26, `test` at #768; later runs on #771)

The full log, call lists and findings are in `2026-11-26-reis-for-claude-map-acceptance-rerun.md`.
Fresh sub-agents played the persona through a stand-in client (not Claude Desktop itself), each on an
empty store of its own, against the real IS account, read-only. The pass rule was applied from the
call log. Results:

- **S1: pass, 5 calls** (overview, two reads, schedule, one ledger write). The date (Wed 9 Dec 2026
  13:00) is named as inferred, with both files and the harmonogram sentence quoted. On a built map it
  is two calls: overview plus one search (hub-run, not a persona).
- **S2: pass.** Integration test, and live: a second build downloaded 0 of 138 files.
- **S3: pass.** Integration tests; live, a second overview said nothing had changed.
- **S4: pass, 1 call** (baseline 10 and 15): points, open assignments, exam terms and the week.
- **S5: content pass four times; the original call target was never met and is re-based.** All six
  events in the key listed every time, inferred ones marked, nothing past listed as ahead. Calls: 20
  on an empty store (the persona never built the map), 32 and then 37 on a built map (reads plus 5 or
  6 ledger writes), and **15 for the same question asked again on that store** (14 reads, 1 ledger
  list, 0 writes: the ledger already held the five file-derived events). Even with search and a
  ledger the persona reads each subject's files to be sure, so "overview plus at most two reads" is
  not reachable and is dropped. My call, which Dominik can veto: ceilings of 40 for a first ask and
  16 for a repeat, written into the S5 scenario above.
- **S6: pass** on the integration tests; the digest, run with the real Gmail (one draft, not sent) and a
  read-only University calendar, matched existing entries, found the project hand-in missing, and
  proposed four updates and one new all-day entry. That walk found a ledger bug (three credit tests of one subject merged into one
  entry), fixed in #771.
- **The first real build:** 138 files, 124.6 MB, 87 seconds, 0 failed.
