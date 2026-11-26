# reIS for Claude map: the upcoming-events ledger (decision 9)

Part of `2026-11-25-reis-for-claude-map-design.md`. Added 2026-11-25 on Dominik's words. Built in
step 4b; the digest and calendar proposals in step 6.

**An upcoming-events ledger, kept by Claude, in the store** (added 2026-11-25 on Dominik's
   words: he wants to know when the tests are coming, and those live mostly in course
   documents, not in IS's exam list). One list of everything dated that needs the student to be
   somewhere: tests, credit tests, project defences, resits, unregistration deadlines.
   - **Claude writes it, reIS does not.** reIS has no model and extracts nothing; Claude reads the
     harmonogram, conditions and brief files (through the overview and search) and saves each
     event through a ledger tool. IS exam terms and assignment deadlines are added by reIS
     itself, already exact.
   - **Each entry carries**: date and time (or the window when the file only gives one), kind,
     subject code, room, how long and how many points when stated, the rule that matters (minimum
     points, no aids), the unregister deadline, the **source file and its modified date**, and a
     flag **stated or inferred**. An inferred date says how it was inferred and tells the
     student to confirm with the teacher. Modelled on the student's own University calendar, where
     this is already kept by hand (title "Kind – Subject (CODE)", the description holding scope,
     rule, source and the "ověř u cvičícího" note, reminders a day and an hour before).
   - **Not only tests, and not only IS.** The student's own calendars show the real range: besides
     tests, credit tests and defences, they save programme days with mandatory attendance (an
     Erasmus+ blended intensive programme abroad, several days, some marked mandatory), a lecture
     about choosing a specialisation, and university and society events they decided to go to
     (a quiz night, a market day, an ISIC event). Many of these never appear in IS: they come from
     a mail, a course page or a poster. So an entry has a **source kind** (IS, course file, mail,
     calendar, the student told Claude) and the ledger tool takes any of them. reIS adds only
     what its own IS tools see; everything else is Claude's, from whatever the student's Claude
     can read. An entry also records **what depends on it** when stated (a programme that
     needs a test passed first), because that raises how early it should be mentioned.
   - **A replaced source file marks its entries "recheck"** (the diff in decision 5 already sees the
     new modified date); entries are never silently kept past their source. A past event is
     dropped after its day.
   - **Reminders:** an exam, a test, a credit test or any event that needs the student to come
     for its own reason (a project defence, an oral exam) is **mentioned at least a week ahead**; the day-before
     mention comes from the daily digest and from the reminders on its calendar entry (below). reIS stays passive, so the mention comes from the overview (an
     "upcoming" section, soonest first, with days left and a flag on events that need attendance)
     and from the daily or weekly digest of step 6. A **weekly digest looks 14 days ahead**, so
     even a weekly cadence reaches every event at least seven days out; a daily one flags
     anything inside 14 days.
   - **The email is a draft in the student's own mail**, written by their Claude through a
     connector they already have, daily, weekly or on demand. reIS never sends mail.
   - **The daily (and weekly) routine proposes calendar entries.** For every ledger event that is
     not yet in the student's University calendar, and every one whose date, room or rule changed,
     the routine proposes the entry in the format the student already uses (title
     "Kind – Subject (CODE)", room as location, a description with scope, rule, source and the
     "ověř" note for an inferred date, reminders a week before, a day before and an hour before).
     The proposal goes into the digest email; **nothing is written to the calendar until the
     student says yes**, because it is the student's own calendar. Each entry carries the ledger
     id in its description so a later run updates it instead of adding a second one, and finds an
     entry the student already made by hand rather than duplicating it. The calendar write is
     done by the student's own Claude through their calendar connector; reIS itself still writes
     nowhere but the store. Forget removes the ledger with the rest and leaves the calendar alone.

## Built in step 4b (builder's calls, 2026-11-26)

- **One file per event**, `ledger/ev-<12 hex>.json`, not one list: Desktop and every Claude Code
  window share the folder, so two adds at once each write their own atomic file. The id is made by
  reIS and never changes. A change that reads several files and writes back (the cap, the dedupe, an
  update of one entry) holds a lock file shared by every process on the folder
  (`withFileLock` in `storeFs.ts`, name starts `.tmp-lock-`, a holder gone for ten seconds is taken
  over), so two processes cannot each write from a stale copy. `list` reads the `ledger/` folder
  itself, not `index.json`: two commits at once can overwrite each other's index entry.
- **The tool is `mendelu_ledger`** with actions `list`, `add`, `update`, `remove`. It asks IS nothing,
  works with no login, and writes only the store. Adding the same event again (same subject, kind,
  day, time and source file) updates it instead of duplicating. Capped at 200 events; an event that
  ended more than 30 days ago is dropped only when the ledger is full and an add needs the room.
  `list` takes `offset`, `limit` and `id`; a long list is cut at what one answer can carry and says
  which offset to pass next.
- **Never evicted by the size budget** (`storeIndex.ts`): a ledger entry is the only thing in the
  store that cannot be fetched again from IS. It still counts in the budget. Step 5's originals will
  not push it out.
- **Recheck is stateless**: an entry records its source file's link and the date modified it was read
  at; every overview and every `list` compares that with the folder listing, so the mark stays until
  Claude reads the file again and updates the entry. The "changed" part adds one line, once, when the
  file's replacement or disappearance is reported.
- **The overview's upcoming rows are short** (id, when, days left, kind, subject, title, room,
  attendance, stated or inferred, recheck, `inNext14Days`); the rule, what depends on it and the source
  are in `mendelu_ledger list`. If a full ledger ever crowds the answer, the assignments list gives way
  first, then the upcoming list, and the cut is said.
- A past event is dropped from the overview after its Prague day; `list` hides it unless asked.
