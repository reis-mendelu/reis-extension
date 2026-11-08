# Where a task lives, and finishing it

Part of the task-list skill (`SKILL.md`). Read it before triage.

| The task is… | Built in | Shown with | `y` means |
| --- | --- | --- | --- |
| the app or the extension | `reis-extension`, PR into `test` | screenshots page | squash-merge into `test` |
| the public site: the install guide ("reis-navod", reis-page `index.html`), SEO or landing pages | `reis-mendelu/reis-page`, PR into `main` | screenshots of the page | squash-merge into `main` — **that publishes the live site** |
| a document for Dominik to use: a proposal, mockups for a partner, a one-pager | a private Artifact page | the page itself | done, nothing to merge |

A run reaches reis-page only if it is in the `reis-extension` environment's
Repositories list; if the clone is refused, do the task's question or note as
usual and say in the run summary that reis-page access is missing — never
work around it (no fork, no other remote, no pasting the page elsewhere).

reis-page is a static site (`index.html`, no build, no CI of note): clone it,
branch `claude/<slug>`, check the page in a browser at 390px and 1280px, and
put those screenshots on the review page. A partner document follows the
linked example's structure and the reIS look (`reis-mendelu/reis-page` and
the app's own screens); it uses only public facts and never names a student.

A document is finished when its page is published: its note is "Hotovo:
<url> — Sedí to? (y/n)", and `y` marks the task done with the link.

## Finishing: show it, then ask to merge

When the PR is green (a document has no PR: when its page is published), do
not mark the task done yet:

1. **Screenshots on a review page.** For a UI change, screenshot every surface
   it touches (phone, iPad, extension; `verify-ui` widths) from the preview
   build, and publish them as a private Artifact page — the images go in the
   publish's `files`, never through the Docs connector. Put any trade-off and
   anything left to confirm on that page, not in the doc.
2. **One note under the task** with the page as a link:

   ```bash
   node scripts/task-list/cli.mjs note --doc D --md M --task N \
     --text "Hotovo: PR #651 (a1b2c3d), CI zelené. Screenshoty: <url> — Mergnout do test? (y/n)" --link "<url>"
   ```

   The task is now `asked`. Stop there. For reis-page, ask "Mergnout do main
   (publikuje web)? (y/n)"; for a document, "Hotovo: <url> — Sedí to? (y/n)".

A later session finds it `answered` and reads the reply after the `∎`:

- **`y`** approves the commit named in the note, nothing later: if the PR's
  head has moved since, refresh the review page and ask again. Otherwise merge
  the PR into `test` pinned to that commit (`expectedHeadSha`; mark it ready
  for review first; squash, as the repo does), then `done --note "PR #n, merged"`. Only if CI is green on
  the current head and **no release PR (`test` → `main`) is open** — while one
  is, leave a note saying the merge waits for the release. A reis-page PR
  merges into its `main` on `y` (no release gate there); a document is marked
  done with its link.
- **`n` + what to change** → change it on the same branch, refresh the review
  page, and ask again with a new note.

A "y" in the doc is the go-ahead because only Dominik edits the doc; the
Docs API cannot say who typed it. Never merge on anything less explicit.
