# reIS for Claude map: acceptance re-run on the finished map

The results of the scenarios in `2026-11-25-reis-for-claude-map-acceptance.md`, run on the finished map (steps 1 to 6 on `test`).

## Scenarios S1 to S6 (2026-11-26, `test` at the step 6 merge, #768)

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

**S5 again on a built map: content pass, 32 calls.** To see whether the 20 calls came only from the
empty store, the same question was run on a store that had the full build. It listed the same six
events (plus the VWA project hand-in on 7 Dec, from a lecture slide, a stated date with its file named)
with the inferred ones marked, but made 26 reading calls (9 searches, 11 file reads, the rest
listings) and 6 ledger writes: the persona read each subject's files to be sure instead of trusting
the first search. The call target is missed with or without a map.

**S5 first ask, then the same ask again, on one built store (a fresh build: 138 files, 0 failed).**
Two fresh personas, same message, same store, run one after the other; counts are from the store's
call log. *First ask:* all six events listed, inferred ones marked, nothing past as ahead; 37 calls
(31 reads: 11 searches, 11 file reads, 2 folder listings, 2 schedule calls, overview, exams,
points, assignments, syllabus; 6 ledger calls: one list and 5 adds). The five adds are the file-derived
events (OTII test 2 stated, the PS hardware-skills and Netacad credits and the PE credit test as
inferred windows taken from the weeks table, the Java project hand-in on 3 Jan stated); the two
events IS already shows (VWA defence, MNG credit test) were correctly not written. No invented end
date this time. *Same ask again:* the same six events, same marks; **15 calls** (14 reads: overview,
5 searches, 4 file reads, listing, syllabus, points, schedule; 1 ledger list; 0 writes). It trusted
the ledger for the five events but still re-opened four files and searched five times to check the
rest. Both named, unprompted, what is not dated anywhere (Matlab tests 2, 4 and 5, the Java defence)
and the VWA conditions file that is only a PNG.

**Decision on the S5 call target (Claude's call, reversible, 2026-11-26).** Four runs
(20, 32, 37, 15 calls) show the original "overview plus at most two reads" cannot be met by a
careful persona on a seven-subject question. On a first ask the overview lists IS's own dates, not
the dates inside files, so the files have to be read once. On a repeat the overview already merges
the saved ledger events into "upcoming", and the repeat persona still spent 15 calls re-checking
files and searching before trusting it: that is caution, not a missing feature. The criterion is
re-based to regression ceilings just above what was measured: **40 calls for a first ask on a built
map, 16 for a repeat**, while the content pass rule stays exactly as written. What would lower the
numbers is a persona that trusts the ledger and the overview, which no step on the list changes.
Dominik can keep the original
target by saying so; the acceptance doc would then show S5 as failing.


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

## The persona walk of a student's week by email (2026-11-26)

Run after step 6, on a copy of the built map from the build above, by fresh Sonnet sub-agents that
followed `mcp/routine/digest-prompt.md` word for word through the same stand-in client. There was
no mail or calendar connector in the run (and none was touched): the draft went to a local file, the
calendar half was reported as "could not read a calendar". Nothing was sent and no calendar was written.

**Run 1, an empty ledger, daily then weekly.** Four tool calls in all. Both refreshes reported no
changes (the build had already saved every file), so the drafts held one event, the registered
project defence in 14 days, correctly without an "ověř" note because IS states it. The routine
did what it says; the drafts were thin because the ledger was empty, which is what a student's
first week would look like.

**Run 2, a weekly digest over a ledger of five events saved by the S5 persona.** Seven calls. The
draft (about 630 words, Czech) listed three events inside 14 days (two inferred credit-test windows
and the registered defence) and three further out under a separate "later" heading, every inferred
one marked "ověř u cvičícího" with its source file. It also checked the ledger against the files
without being asked and flagged the entry whose end date the S5 persona had invented (the file
says only "weeks 12 and 13"), a title that lists more topics than the file gives the student's
group, and a window narrower than its file. It proposed no calendar entries and offered "navrhni
všechny", because nothing had changed in that run.

**What the walk found in the routine** (for a later prompt change; none blocks 0.2.0):

- Step 5 proposes calendar entries only for events added or updated in that run when no calendar can
  be read. A student whose ledger already holds events that were never put in the calendar gets no
  proposals until something changes; with a calendar connector the first sentence of the step
  applies and this does not arise.
- Step 4 asks for "deadlines this week: assignment boxes not yet handed in", but the routine names
  no tool that lists open boxes (`mendelu_assignments`), so both runs wrote that open boxes could not
  be confirmed.
- The refresh's "N later" counts IS terms the ledger does not hold, and its pointer to the ledger
  for them is misleading.
- A weekly digest reaches every event a week ahead only if it runs every seven days; the run
  added a "later" group, which the prompt does not ask for.

## The week by email with the real connectors (2026-11-26)

The first walk had no mail or calendar connector, so it was run again with the student's real
Gmail and Google Calendar connectors, by a fresh sub-agent: an empty store, the S5 question and a
full build, then the weekly digest from the routine, word for word. It **created one draft** in the
founder's own mailbox (subject ending "TEST, smazat", addressed to itself; it was not sent and no
send tool was called) and **read** the University calendar for 26 Nov 2026 to 31 Jan 2027; it wrote
nothing to any calendar. Reports carry subject codes, kinds and dates only.

**It worked end to end.** The agent found each ledger event's hand-made entry in the calendar
(three credit tests and a test, by day, time and room), found the project hand-in missing, found
the defence and the Management credit test already present and matching, proposed an update of the
four entries (add the ledger id, the source file, a week-ahead reminder) and one new all-day entry,
and wrote nothing until a "yes". Nothing was proposed twice.

**A bug it found, fixed in this PR.** Three Počítačové sítě credit tests (hardware skills, the
final Netacad test, the PTSA test) share a subject, kind, week and source file, so the ledger took
the second and third `add` for the first and overwrote it: only the last survived and the agent
merged them by hand. The ledger's same-event key now includes the title (case, accents and spacing
ignored); `storeLedger.test.ts` has a test that fails without it.

**What the draft got wrong as a mail read on a phone** (prompt changes for later, none blocks 0.2.0):

- A reply to a draft in your own mailbox never reaches Claude, and the draft does not say so: it
  has to tell the student to answer "ano" in the chat with Claude. A draft also sits in Drafts with
  no notification, so the student may never see it.
- The calendar-proposals section is five dense blocks (about 75 lines). One line per proposal, with
  the detail only on request, would read better on a phone; weekdays next to dates, the unregister
  deadlines and a short "what to do this week" list were missing.
- It said "you already have all of these in the calendar" while one event was new, and told the
  student to answer with numbers while the proposals were lettered.
- Step 5 proposes calendar entries only for ledger events, so IS-sourced items (registered exam
  terms, assignment deadlines) are never offered; hand-made entries carry no ledger id, so matching
  falls back on subject, kind and day, which a window event has no single value for; a reminder "an
  hour before" and a room make no sense for an all-day deadline or a window.
- An image-only conditions file (a PNG) cannot be read, and the routine has no fallback for it.
- The mail connector writes plain text only, and `create_draft` returns no id: finding the draft
  again means listing the whole Drafts folder.

