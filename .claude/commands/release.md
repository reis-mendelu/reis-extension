# /release

Automates the full release flow: version bump → commit → tag → push → CI publishes to Chrome, Firefox, and Edge.

## Steps

1. **Preflight** — run these and abort if anything is wrong:
   - `git status` — must be clean (no uncommitted changes)
   - `git log --oneline -3` — confirm on main
   - Read current version from `package.json`

2. **Ask the user** (AskUserQuestion, both in one message):
   - New version number (suggest next patch increment, e.g. if current is 5.0.0 suggest 5.0.1)
   - One-line description for the commit (e.g. "improve exam card UI")

3. **Apply changes**:
   - Edit `package.json`: update `"version"` field
   - Edit `wxt.config.ts`: update `version:` field inside `manifest:` block
   - Commit: `chore: bump to X.Y.Z - <description>` — no Co-Authored-By
   - `git tag vX.Y.Z`
   - `git push origin main vX.Y.Z`

4. **Report** the triggered Actions run:
   - Run `gh run list --repo reis-mendelu/reis-extension --limit 1` to get the run ID
   - Tell the user to watch with: `gh run watch <id> --repo reis-mendelu/reis-extension`

## Rules
- Never skip the preflight — a dirty working tree means uncommitted work gets left out of the release
- Both `package.json` and `wxt.config.ts` must be updated together — mismatch causes the extension manifest to show the wrong version
- Commit message format is load-bearing for the git log pattern used by the team

## Reference

Pushing a `v*` tag triggers `.github/workflows/publish.yml` → builds Chrome + Firefox zips → submits to all three stores via `wxt submit`.

**Store review SLAs** (version goes live after review):

| Store | Typical review time |
|-------|-------------------|
| Chrome Web Store | 1–3 days |
| Firefox AMO | days–weeks (manual review) |
| Edge Add-ons | 1–7 days |

**GitHub Secrets** (repo → Settings → Secrets → Actions):

| Store | Secrets |
|-------|---------|
| Chrome | `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` |
| Firefox | `FIREFOX_EXTENSION_ID`, `FIREFOX_API_KEY`, `FIREFOX_API_SECRET` |
| Edge | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY` |

> `CHROME_REFRESH_TOKEN` is permanent only while the Google OAuth consent screen is set to **"In production"** (currently set). If it ever reverts to "Testing", tokens expire after 7 days.
