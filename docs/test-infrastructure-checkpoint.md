# Test infrastructure checkpoint

Where this branch got to, what is deliberately unfinished, and why.

Scores below come from repeated **independent adversarial audits** run against
each commit — a reviewer instructed to verify by running commands, mutate the
source, and refute claims rather than accept them. Six audits; each is quoted
with the commit it judged.

| Dimension | Start | Now |
| --- | --- | --- |
| Test health | 4/10 | 7/10 |
| Risk-aligned testing | 7/10 → 6 (re-graded) | 6/10 |
| Coverage | 5/10 | 5/10 |
| CI completeness | 4/10 | 6/10 |

None reached the 8/10 target. The honest blocker is coverage, and everything
downstream of it — see [What is not done](#what-is-not-done).

---

## Two production bugs

Both were found by writing a test that could not be made to pass. Neither was
visible to any gate, and both had shipped.

### `push_notes_html` was dropped at the trust boundary

`createNotesSlice.ts:80` posted a `REIS_ACTION` with `action: 'push_notes_html'`,
and `messageHandler.ts` implemented a case for it — but the action was missing
from the Zod enum, so `isIframeMessage()` rejected every one and `handleMessage`
returned before the switch. The branch had never run.

The sender's own comment reads *"the snapshot push … now using the override
cached just above"*. Nothing was ever cached, so the notes backup always fell
back to the text-only rendering: students' formatted notes, and the images
`renderSubjectNotesHtmlWithImages` had just inlined, never reached Google Drive.
Silent, because the drop happened inside a guard whose job is to discard
malformed traffic.

### `registerExam` reported success for a term it never got

`verifyRegistrationSuccess` checked two tokens independently:

```js
html.includes(`termin=${termId}`) && html.includes('odhlasit_ihned=1')
```

The exam list shows every term for every subject. So on an ordinary page the
first matched the *register* link for the term that had just been refused, and
the second matched a *different* exam the student was already registered for.
The two never had to belong to the same link.

Any student already holding one exam seat who tried to register for a full term
was told it worked. During exam season that is the most expensive wrong answer
this app can give. The same file had already solved this for the *unregister*
direction, with a comment explaining why — the fix had been applied to one
direction and only that direction had tests.

---

## Bug classes closed structurally

Where possible, the fix makes the bug unrepresentable rather than merely tested.

- **Message-type drift.** `ActionType` and `DataRequestType` are now `z.infer` of
  the Zod enums instead of hand-written unions, and the five senders that built
  messages by hand go through `Messages.action()`. Removing an action from the
  enum is a compile error at its call site. For the two actions with no typed
  sender, a parity test asserts every enum member has a handler case and vice
  versa — it immediately found `toggle_outlook_sync` and `download_file`
  accepted by the validator with no case on any platform.
- **Order dependence.** Seven files leaked state: mock return values outliving
  `clearAllMocks`, Zustand keys never reset, store *actions* replaced by spies
  and never restored, and a `vi.spyOn` + `mockRestore` over a `vi.mock`'d export
  that put a plain function back. Fixed per file; `test-shuffled` runs a random
  seed each run so new ones surface.
- **Tests calling production.** A full run opened six TLS connections to the live
  `is.mendelu.cz`. Closed via happy-dom's navigation settings, and verified with
  a `net.Socket.prototype.connect` hook — with a positive control first, so a
  zero means the instrument works rather than that it is broken.

---

## Gates

`ci.yml` went from 3 jobs to 8. More importantly, several gates that existed
could not fail, and were fixed only after an audit demonstrated the exploit:

| Gate | Defect found | Now |
| --- | --- | --- |
| coverage thresholds | red on the commit that added them; calibrated off the wrong report row | green, and verified to fail when a test file is deleted |
| `lint:gate` | went **green** when eslint errors were added (one combined total) | per-file counts; a fresh violation cannot be paid for by suppressing an old one |
| `coverage:zero-gate` | a swap passed (count-based) | set-based; counts zero-**function** files (175) not zero-**statement** files (43) |
| threshold globs | a glob matching nothing was silently ignored | every glob asserted to match ≥1 measured file, both quote styles |
| `test-architecture.js` | exited 1 on main, wired to no script or job | ratcheted and wired in |
| `lint:dead` | `--include files` hid 128 unused exports, 121 unused types | full-report ratchet added alongside |
| `publish.yml` | shipped to three stores running 4 gates where CI runs 8 | runs the full set, on the node version that ships |
| `deploy-supabase-functions.yml` | deployed to production with no gate; the verify job I first added could not see the directory at all | `deno check` on every edge function, verified to fail on a real type error |

The pattern worth keeping: **check the exit code, not the output.** The coverage
gate shipped red because it was "verified" by grepping stdout, and the lint gate
shipped red for the same reason one commit later.

---

## What the gates caught on the merge from main

The branch was rebased onto seven commits that landed on `main` while it was
being built. That merge is the first real trial of the gates, because the code
arriving through it was written without them. Four fired, none of them on code
this branch wrote:

| Gate | What arrived | Resolution |
| --- | --- | --- |
| `nuia:gate` | a new test indexing a `NodeList` — `Element \| undefined` under the flag | fixed, not baselined; the gate has no `--write` by design |
| `lint:dead:full` | a new `export` read only inside its own file | un-exported |
| `coverage:zero-gate` | one file left the zero-coverage set | banked 176 → 175 |
| `test-shuffled` | five tests green in declared order, red under shuffle | two leaks fixed |

The shuffle finding is the one worth reading. Both new screens gate their
skeleton and error states on `syncLoaded`, and neither suite's `beforeEach`
reset it — so "renders the empty state" passed only while some earlier file
happened to leave the flag set, and rendered the *error* state under a different
file order. Resetting it then exposed a second leak underneath: three tests
asserted the empty state while setting only `firstSyncSettled`, free-riding on
`syncLoaded` written by the tests declared immediately above them.

Each now states its own premise. "The fetch came back" is the entire difference
between an empty timetable and a failed load, and it is the kind of thing that
should be written down rather than inherited.

One conflict was resolved *against* this branch, deliberately. Both sides had
independently fixed the same `MapScreen` flake — this branch by feeding
`snapDetent` real timestamps, `main` by stubbing it behind a flag and moving the
velocity coverage to `sheetDrag.test.ts`. Checked before deferring:
`sheetDrag.test.ts` does assert the threshold from both directions and at
`dt = 0` against the real `snapDetent`, so `main`'s comment is accurate and
nothing was lost. The `pointer()` helper survives at the two sites that did not
conflict — one of which is a real fix, since `fireEvent(el, { timeStamp })`
silently ignores the value: `timeStamp` is readonly on `Event`, so the handler
kept reading `performance.now()`.

---

## What is not done

Stated plainly so nobody reads the green checkmarks as more than they are.

- **Coverage is 58.3%.** Every audit puts 8/10 at ~70% with no zero-coverage
  files. That is ~5,500 more covered statements, and most of the remainder is
  the React component tree (`src/components` is roughly half of all statements).
- **175 files have never had a function execute.** Ratcheted, so the number can
  only fall — but it is the honest figure, four times what the gate reported
  before it counted functions instead of statements.
- **Coverage still drifts ~0.12pp run to run.** Four suites relying on the
  unmocked-fetch guard were fixed and each is clean in isolation, but a full run
  still shows ~19 late continuations: a promise left floating by one file
  resolving while another runs. Floors sit ~1.2pp below actual, about 10x the
  drift, so the gate is not at risk. Eliminating it means auditing every suite
  for floating promises.
- **`restoreMocks` / `unstubGlobals` are off.** They are the structural fix for
  the state leaks above. Turning them on fails 46 and 71 tests respectively —
  many suites set mock implementations at module scope. Adopting them means
  repairing ~70 suites in one change.
- **No e2e job.** The 20 Playwright specs need real `MENDELU_USER` /
  `MENDELU_PASS`; `e2e/global-setup.ts` signs in to the live IS. A job that
  cannot authenticate is a red-or-skipped gate that teaches people to ignore CI.
  Needs a dedicated test account in secrets, or a mock-data subset.
- **`supabase/migrations/**` is ungated.** RLS policies and the `report_error_v2`
  RPC ship with nothing checking them.
- **`deno lint` is not gated** — 38 pre-existing problems; it wants the same
  baseline ratchet as `lint-gate.mjs`.
- **`scripts/` is typechecked; `e2e/` is not.** It needs jsx and CSS-module
  handling in its own tsconfig project.
- **The ISKAM parser fixtures are synthetic.** See
  `src/utils/parsers/iskam/__tests__/fixtures/README.md`: they were rebuilt from
  the test assertions, so they guard refactors and prove nothing about real IS
  HTML. Per CLAUDE.md a parser change still needs a real sample.

---

## Conventions introduced

Four ratchets now follow the same shape as the existing `nuia-gate.mjs`: a
baseline file, a gate that fails when the number rises, and `-- --write` to bank
an improvement. They exist because the alternative — an absolute gate on a
codebase that does not yet satisfy it — lands red and gets ignored.

- `lint-baseline.json` — eslint backlog, errors and warnings tracked separately
- `zero-coverage-baseline.json` — files with no function ever executed
- `knip-baseline.json` — unused exports, types and dependencies
- `architecture-baseline.json` — hooks reaching the sync layer directly

A rise is never banked automatically. A drop must be banked in the same PR,
which is what stops the number quietly drifting back up.
