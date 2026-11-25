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
Record the call count (target after steps 3 and 4: overview plus search plus at most one read).

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

## Which step moves which scenario

| Scenario | Today                                                        | Moved by         |
| -------- | ------------------------------------------------------------ | ---------------- |
| S1       | passes with a cooperative persona, 9 calls (see Baseline)    | steps 2, 3, 4, 5 |
| S2       | fails: nothing is kept past the process                      | step 2           |
| S3       | fails: no overview and no change record exist                | step 3           |
| S4       | passes, 10 calls (one points call per subject)               | step 3           |

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
whether it had coached the first runs. It had not.

**S1: pass, 8 calls.** Same date, same two files, same quoted harmonogram line, same honest
"this is inferred" wording.

**S4: pass, 15 calls.** Points for every subject that has a points sheet (five), the study-plan
credits, open assignments, exam terms and the week's timetable, unasked. Five more calls than
the first run because it also read the study plan, grades and three syllabi.

**Reading:** the real failure (a date answered "IS has no date" until the student said "projdi
soubory") does not reproduce with a fresh agent on a fresh question. S1 and S4 stay regression
checks with call-count targets after steps 3 and 4: **S1 at most 5 calls, S4 at most 8**. The
map's measurable gains here are fewer calls and no per-subject points loop, plus S2 and S3.
