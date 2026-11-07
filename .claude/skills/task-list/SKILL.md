---
name: task-list
description: Use when reading, working through, ticking off or commenting on the "reIS Task List" Google Doc — the Bucket list of things to build — including its screenshots, from any session (cloud or local). Not for a single task the user typed into chat.
---

# reIS Task List

The task list is a Google Doc named **reIS Task List** in Dominik's Drive. Work
is taken from its **Bucket list** section only. Never take, tick or annotate
anything under another heading — Sprint sections and the Archive are history.

## Needs

- The **Google Drive** connector (it brings the Google Docs tools with it).
- `docs.google.com` reachable, for the screenshots. The `reis-extension` cloud
  environment allows it; the Default environment does not.

## 1. Read (two calls, both results land in files)

1. Find the doc: `search_files` with `title contains 'reIS Task List'` and the
   Google Docs mimeType. Use the result's `id`.
2. `read_doc` (Google Docs) → structured JSON: write positions and image URIs.
3. `read_file_content` (Google Drive) → markdown export: the **only** place a
   ticked checkbox is visible. The Docs API does not expose checklist state.

Both outputs are too big for context and are saved to `tool-results/…txt`.
Do not read them; hand both paths to the CLI:

```bash
node scripts/task-list/cli.mjs list --doc <read_doc file> --md <read_file_content file>
```

`#n · title` is open, `✓` done, `?` unmatched. `--all` includes done tasks,
`--json` prints everything. Image URIs expire ~30 minutes after `read_doc`, so
fetch screenshots straight away:

```bash
node scripts/task-list/cli.mjs list --doc D --md M --task 4 --images "$SCRATCH/task-images"
```

then open each `image:` path with Read. A task with a screenshot is not
understood until its screenshot has been looked at.

## 2. Write (never by hand-computed index)

The CLI prints an `update_doc` payload. Pass its `requests` and `writeControl`
to `update_doc` unchanged. `writeControl` pins the revision you read: if anyone
edited the doc since, Google rejects the write — re-read and regenerate.
Every write changes the revision, so **re-read before each further write.**

| Intent | Command |
| --- | --- |
| Done | `cli.mjs done --doc D --md M --task N --note "PR #123"` → `✅` + strikethrough |
| Note (blocked, question, claimed) | `cli.mjs note --doc D --md M --task N --text "…"` |

No Google API can tick a checklist box, so "done" is `✅` + strikethrough. The
box itself stays for Dominik to tick. Notes go inside the task's own item as an
italic `↳ Claude YYYY-MM-DD: …` line; the connector cannot start a Doc comment.

## Taking a task

- Take tasks that are about this repo's code. Outreach, emails and partner work
  are Dominik's; leave them alone without a note.
- If a task is unclear, ask in a note instead of guessing — say what is missing.
- **Claim before working**: note `in progress — branch <name>` first, so a
  parallel or later session does not start the same task. A session can die
  mid-task (usage limit, machine reclaimed); push the branch early so the work
  survives, and a later session resumes from the claimed branch.
- Normal repo rules apply: branch → PR into `test`, CI green. Never merge.
- After the PR is green, mark done with `--note "PR #n"`.
