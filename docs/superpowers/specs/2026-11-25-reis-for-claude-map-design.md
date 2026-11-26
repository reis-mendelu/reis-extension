# reIS for Claude: a map on disk (design record)

Status: agreed in conversation 2026-11-25 and cut into build steps (see Steps). **Steps 1 and 2 are on
`test` (#753, #756), steps 3 and 4 too (#759, #761), and 4b (#765), and step 5 (#766), and step 6 (#768); step 7, the release, is prepared as a draft PR and waits for Dominik.**
Decided with Dominik. Follows PR #749 (in-memory tool cache), which he judged "pretty useless"
once he tried it: the server process does not outlive a window reload, an app launch or a
Claude Code session.

## Why

The failure is not rereading, it is **forgetting to look**. In real sessions the agent:

- answered "IS has no date" for a credit test, called five tools, and only found the date in a
  harmonogram PDF after the student said "projdi soubory";
- could not see Záznamník points at all (a missing tool, since fixed as `mendelu_points`);
- took a combined-study homework for the full-time student's, because it did not know the
  student's study form and group;
- re-ran the same listings and reread the same PDFs in every session.

A cache stores answers to calls Claude already made. What is needed is a **map of the
territory**: what each subject holds, what is new, what the files say, so Claude starts from the
map and checks only what changed.

Measured (the founder's own transcripts, 9 Oct to 23 Nov, 406 calls): across sessions file reads
came back identical 32 of 37 times, syllabus 10 of 10, subjects 12 of 15; assignments (0 of 19)
and exams (3 of 15) change. A download link never changes when a file is replaced, only its
`modified` date does.

## Goals

- Claude begins every IS question from a stored map and is told what changed since last time.
- Dates, test topics, reference sheets and project briefs inside course files are findable
  without the student telling Claude to open files.
- Works for every student who installs reIS for Claude (`.mcpb` and Claude Code plugin), not
  just the founder.

## Non-goals and anti-goals (confirmed)

- No model in reIS, so no summaries; findability comes from stored text and search.
- No sync across devices, no sharing between students.
- No network beyond IS and the existing anonymous update check.
- Still read-only toward IS. No new POST.
- The password and the session cookie never touch disk.
- Anti-goal: a map the student cannot see, find or delete.

## Decisions

1. **One product, one front door.** The ten typed tools stay (read-only, no raw page fetch, no
   online tests). New tools in front of them: an **overview** (the map, plus "what changed since
   last time", refreshed on first call), a **search** over stored text, **build my map**, and
   **forget everything**.
2. **What is stored:** an index (subjects, files, dates, points, deadlines, exams), the student's
   profile (study form, group) taken from IS data already read, the **full** extracted text of
   files read (never truncated in the store; cut only when handed back), and the **original
   files**. Page images are not rendered in the first version.
3. **Originals** of every file in subjects the map knows, stored next to their text, so Claude
   Code reads them natively by path. Zips stay zipped. Overview returns each file's path. File
   names come from IS and must be sanitised so none can write outside the store.
4. **Filling:** the index fills at first use. Text and originals fill when files are read, or
   all at once through the explicit **build my map** call. A dry run reports file counts and
   types per subject first. IS listings carry no sizes, so the dry run reports total size as
   unknown and makes no extra requests to learn it; the size budget is enforced while
   downloading (stop at the budget, report what was skipped).
5. **Daily routine:** the server stays passive (a host starts it; it never wakes itself). reIS
   ships a refresh tool and a documented scheduled-task prompt. The daily run refreshes cheap
   listings, diffs them against the store, and fetches new or replaced files in subjects it
   already knows, within the size budget. Changes are reported read-only; school changes do not go
   into the Y Soft knowledge base.
6. **On by default, local only.** No opt-in. The promise is rewritten honestly before it ships.
7. **One shared folder per laptop**, not per host: Desktop, every Code session and subagents use
   the same map. macOS `~/Library/Application Support/reIS for Claude`; Windows
   `%LOCALAPPDATA%\reIS for Claude` (fall back to `os.homedir()` + `AppData/Local`). Never
   Documents or Desktop (iCloud/OneDrive), never the extension's own folder (wiped on every
   update and uninstall), never `CLAUDE_PLUGIN_ROOT`. Uninstall does not delete the store, so
   the README says where it lives and **forget everything** removes it. Forget must be safe
   against writes in flight: no write may commit after forget starts, from any process,
   including the scheduled refresh, so forgotten content can never reappear. The mechanism is the
   builder's call (recommended: a generation marker that forget bumps first and that every write
   checks right before its rename). Built (PR #753, #755): a generation token that
   forget replaces first and every write checks around its rename, plus a `.forgetting-<id>` marker
   that forget keeps from before the bump until its last delete. While a live marker exists the
   token reads as unreadable, so no write, rebuild or index update starts or publishes during a
   forget, whatever token it captured. A marker is refreshed as forget deletes; one untouched for
   five minutes belongs to a crashed forget and is ignored and swept.
8. **Shared-laptop risk accepted:** one store per machine, not keyed to the IS login.
9. **An upcoming-events ledger, kept by Claude, in the store** (added 2026-11-25): one list of
   every dated thing that needs the student somewhere (tests from harmonograms, credit tests,
   defences, mandatory programme days, events they chose to attend), mentioned at least a week
   ahead and proposed as University-calendar entries. Full decision, entry fields, reminder rules
   and the calendar proposal: `2026-11-25-reis-for-claude-map-ledger.md`.

## Approaches considered

- **Persisted copy of the tool cache.** Cheap, but it only remembers calls already made, so it
  cannot fix "forgot to look". Rejected.
- **Fingerprint-only "what's new" record** (offered 24 Nov, declined then: in-memory only). Fixes
  change detection but not findability. Folded in as the diff step of decision 5.
- **Full map with originals (chosen).**
- **Render PDF pages to images** (WASM renderer, `@hyzyla/pdfium`): only candidate that fits the
  single-file bundle, but untested in Desktop's real runtime and on Windows, and over the plugin's
  5 MiB file cap. Replaced by storing originals; revisit only if native PDF reading proves
  insufficient.

## Constraints found

- Process lifetime: Claude Code starts one server per session (subagents share it); Desktop one per
  app launch, restarted on every window reload and extension update. Several processes write to
  one folder routinely.
- Writes: temp file in the same folder, fsync, atomic rename (retry on EPERM/EBUSY on Windows).
  The index must be rebuildable from content files, so a lost update never loses data.
- Claude Code closes the server on a message over about 16 MiB. That caps what is handed back, not
  what is stored.
- Today's text cut at 25,000 characters loses the tail of long lectures; the store keeps it whole.
- IS listings carry no file size, so total size cannot be measured before download. About 143
  files across 7 subjects were listed, roughly 80 of them PDFs; 19 zips; also .pptx, .ppt, .docx,
  .mlx, .mat, .m, .pkt, .ipynb, .drawio, .png, .html, .md, .txt. Types with no text extraction
  are stored as originals only.
- Native docx/pptx reading depends on the student's own Claude setup; Desktop chat has no file
  tools. Extracted text stays as the fallback for both.
- **The plugin build has no document extractor.** It swaps `documentText.ts` for
  `documentHandover.ts` (officeparser stays out, every plugin file under 5 MiB), so saving a
  read file there stores bytes, not text. Step 4 first measures whether a PDF-only extractor fits
  the plugin build under the cap. If it does, the plugin stores text too. If it does not, search
  in the plugin build covers text-native files (md, txt, m, html, ipynb, drawio) plus file names
  and listing metadata, Claude opens documents natively from the stored originals, and the plugin
  README says so. The `.mcpb` and the user-scope bundle extract everything. (Claude's call; the
  fallback narrows the promise for the plugin only.)
  **Measured in step 4 (2026-11-25):** the plugin bundle is 3.61 MB unminified, leaving 1.63 MB under
  the 5 MiB cap. Pure-JavaScript PDF extractors that read a Czech week table correctly: pdfjs-dist
  (in the tree, legacy build) 1.06 MB unminified but its worker is 2.38 MB, 1.26 MB minified;
  pdf2json 1.83 MB (0.96 MB minified); unpdf 2.45 MB (1.65 MB minified); pdf-parse needs a native
  canvas. None fits unminified in the one file the plugin ships, so the fallback above is taken. A two-file layout does fit and was tested (pdfjs legacy inline in `index.mjs`, 4.69 MB, plus its worker as a second plugin file, 2.44 MB: it loads under plain node and reads the harmonogram table). It is **parked for Dominik**: it makes the plugin carry a PDF parser and a second file, which `mcp-plugin.mjs` forbids today and the submitted listing does not have, and it leaves 0.5 MB of headroom in the main file.

## Promises that change (product decision, not a refactor)

`src/test/guards/mcpStaysReadOnly.test.ts` (the "never writes to disk" regex becomes "writes only
inside the store folder; never the password or cookie"), `mcp/cache.ts` header,
`mcp/README.md` ("Nothing is written to disk"), `mcp/plugin/PRIVACY.md` ("What it stores"),
`mcp/plugin/README.md`, `mcp/INSTALL.md`, `docs/superpowers/specs/2026-10-10-student-mcp-design.md`
(line "never write ... to disk" scoped to credentials), and the directory listing's data-handling
answer "not retained" (needs resubmitting).

## "It works" means

1. The credit-test date question is answered from the map, without anyone saying "projdi soubory".
2. After a restart, repeating a question asks IS only for the cheap listings.
3. A new file in IS shows up in "what changed" the next day.
4. Points appear in the overview without being asked for.
5. Every test, credit test and defence the course files and IS name for this semester is in the
   ledger, checked against the student's own University calendar (acceptance scenario S5).
6. Each of them is mentioned at least a week before it happens, in the weekly digest as well as
   the daily one (acceptance scenario S6).

## Builder's calls (not yet confirmed by Dominik)

- Store layout: a markdown tree plus a small JSON index, rebuildable from the files.
- If the folder cannot be written, fall back to memory-only instead of failing.
- A byte budget for the store, oldest copies evicted first (originals can be fetched again).
  The number is chosen after measuring; likely a few GB.
- A file that disappears from IS is dropped at the next listing.
- Ships as a new minor version, after a test on a real Windows machine.

## Still to measure or test before building

- Total size of a real student's files (learned by the first real **build my map**, since a dry
  run cannot know it).
- Windows: `LOCALAPPDATA` and `HOME` in Desktop's utility process; Store-installed Desktop
  redirects AppData.
- `/mcp` reconnect: does the server pid change?
- Plugin name clash: this plugin is named `reis`, the team plugin is `reis@reis-team`.
- Whether Claude reads a scanned PDF natively when the PDF page reader's helper (poppler) is
  missing on the student's machine.

## Steps

One session per step, one PR each into `test`, in this order. Steps 3 and 4 may run together once
2 has merged. Each step is verified with `npm run check`, `npx vitest run mcp/`, and a live run
against real IS (`npm run mcp:smoke -- --live <tool>`, plus `-- --desktop-host` where the server
start-up path changed). These are headless tools, so there is no UI tree and no screenshots.

| #   | Step                                                                                                                                                                                                   | State       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1   | The store module only: folder resolver, atomic writes, rebuildable index, memory-only fallback, size budget, with the guard test allowing writes inside that folder and nowhere else; a forget that no in-flight write can undo; nothing calls it. | On test     |
| 2   | Persist what is already read: subjects, file listings (link plus modified date), full untruncated file text and the study-form profile go into the store; the **forget everything** tool; every "nothing is written to disk" text rewritten in the same PR. | On test |
| 3   | The overview tool: refreshes the cheap listings on first call, diffs them against the store, and returns the map, the profile, points, deadlines and "what changed", with a tool description that tells Claude to call it first. | On test     |
| 4   | The search tool over stored text: keyword search across all subjects, returning subject, file, snippet and path; first measures PDF text extraction in the plugin build (see Constraints).                                                                                       | On test |
| 4b  | The upcoming-events ledger (decision 9): a ledger tool Claude writes dated events to, an "upcoming" section in the overview (soonest first, days left, attendance flag, stated or inferred), IS exam terms and assignment deadlines merged in by reIS, recheck marks when a source file is replaced, forget covers it. | On test   |
| 5   | Originals and **build my map**: download originals into the store (sanitised names, zips as-is, size budget, dry run of counts and types first), return their paths in the overview.                                       | On test     |
| 6   | The refresh tool for the daily routine (new or replaced files in known subjects within budget) and the documented scheduled-task prompt, in the README and on reisapp.cz. The prompt offers daily, weekly and on-demand digests as an email draft, with the one-week-ahead rule of decision 9 and a 14-day look for weekly, and a proposed calendar entry for every new or changed ledger event, asked before it is written. | On test     |
| 7   | Release: version bump, both builds, `mcp-v*` tag; ships only once the corrected directory-listing answer is published, or Dominik has said in writing that it ships with the stale "not retained" answer.                                                                                                                                                      | Draft PR, not merged |

Merge order: 1, 2, then 3 and 4 (either order, they share `mcp/tools.ts` and `mcp/register.ts`, so the
second rebases), 4b, 5, 6, 7. Step 4b needs 3 (the overview carries its section) and 4 (Claude finds
the dates with search).

**Parked for Dominik** (hard lines, asked once, never block steps 1 to 6): resubmitting the
directory listing's data-handling answer ("not retained"), the release in step 7, and the Windows
run of the store on a real machine before that release. Step 7 does wait on the first and the last
of these. Step 6 changes reisapp.cz, which is the `reis-page`
repo and needs its own PR there.
