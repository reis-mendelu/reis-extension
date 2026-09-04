# /release

Opens the release PR that ships `test` to the stores. Merging it pushes the tag;
CI does the rest.

## Steps

1. **Preflight** — abort if anything is wrong:
   - `git status` — must be clean
   - Confirm you are on `test` and it is up to date with `origin/test`
   - `gh pr list --base main --state open` — must be empty. Two open release PRs
     race the same tag.
   - Read the current version from `package.json`

2. **Ask the user** (AskUserQuestion, both in one message):
   - New version number (suggest the next patch increment)
   - One-line summary of what this release contains

3. **Bump on `test`**:
   - Edit `package.json`: `"version"`
   - Edit `wxt.config.ts`: `version:` inside the `manifest:` block — the same value
   - Commit: `chore: bump to X.Y.Z - <summary>`
   - Push to `test`

4. **Wait for the preview deploy** of that exact commit to go green. The release
   gate requires it, and it is the last chance to look at what is shipping.

5. **Open the release PR**: `gh pr create --base main --head test --title "release: X.Y.Z - <summary>"`.
   The checklist is injected automatically. Work through it.

6. **Stop.** Merging is the user's call — it is an irreversible store submission.

## Rules
- Never bump on `main`. The version must be in the release PR's diff.
- `package.json` and `wxt.config.ts` move together or the manifest shows the wrong version.
- **Do not merge into `test` while the release PR is open.** The gate requires a
  green deploy of the PR's head SHA, and a merge moves the tip out from under it.
- Never push a `v*` tag by hand. `release-tag.yml` owns that.

## Reference

Merge → `release-tag.yml` pushes `vX.Y.Z`, then dispatches `publish.yml` (a tag
pushed with `GITHUB_TOKEN` does not trigger `publish.yml`'s own `push: tags`
listener — GitHub exempts `workflow_dispatch`/`repository_dispatch` from that
restriction, not `push`) → `publish.yml` builds and submits via `wxt submit`.
If the dispatch itself fails, `release-tag.yml` fails the job and prints the
exact `gh workflow run publish.yml --ref vX.Y.Z -f tag=vX.Y.Z` command to run
by hand — the tag will already exist at that point, so that dispatch is the
only remaining way to ship it.

**Store review SLAs:** Chrome 1–3 days · Firefox AMO days–weeks (manual review) ·
Edge 1–7 days.

iOS is **not** part of this flow and is still released by hand.

**GitHub Secrets** (repo → Settings → Secrets → Actions):

| Store | Secrets |
|-------|---------|
| Chrome | `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` |
| Firefox | `FIREFOX_EXTENSION_ID`, `FIREFOX_API_KEY`, `FIREFOX_API_SECRET` |
| Edge | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY` |

> `CHROME_REFRESH_TOKEN` is permanent only while the Google OAuth consent screen
> is set to **"In production"** (currently set). If it reverts to "Testing",
> tokens expire after 7 days.
