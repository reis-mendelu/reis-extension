# Instagram watch

Reads the latest public posts of MENDELU student societies and official accounts, so new
events can be proposed for import (`import-society-events`) instead of being found by hand.

It calls Apify's official `apify/instagram-profile-scraper` **logged out**. No Instagram
account is involved, and never @reis.mendelu: the Apify account is a personal one, and its
token is the only credential.

## Run

```bash
node scripts/instagram-watch/watch.mjs                      # all accounts in accounts.json
node scripts/instagram-watch/watch.mjs --only a,b --dry-run # two accounts, remember nothing
node scripts/instagram-watch/watch.mjs --no-baseline        # report a new account's posts in full
```

Needs `APIFY_TOKEN` in the environment or in the **main checkout's** `.env` (a worktree has
none; the script finds it through `git rev-parse --git-common-dir`). Plain Node 18+, no
dependencies.

## What it writes

Everything goes to `~/.reis/instagram-watch/` by default, outside the repo, so it survives a
worktree being removed and nothing scraped is committed. `$REIS_IG_STATE` moves it; never
point that inside the repo:

| Path | What |
| --- | --- |
| `seen.json` | shortCodes remembered per handle: reported, or baselined on a first run |
| `digests/YYYY-MM-DD.md` | new posts with caption, link and local image paths, plus problems |
| `latest.json` | the same as data |
| `posters/` | cover + up to 4 carousel slides per new post; Instagram's CDN links expire |
| `runs/` | the raw Apify dataset of each run |

A handle seen for the first time is **baselined**: its posts are remembered, not reported.
A new post is set membership on shortCode, not "newer than": profiles pin old posts on top.

## Cost and limits

$0.0026 per profile on Apify's Free plan; the 12 latest posts are included (pay-per-event,
`profile` only). 16 accounts daily ≈ $1.25/month inside the free $5, which stops rather than
bills. Each run is capped at $0.20 (`maxTotalChargeUsd`).

Stories are not scraped. Apify has returned partial profiles under a green run (13–15 Oct
2026), so the digest flags a handle that is missing, came back empty, or has not posted in
60 days (`--stale-days`).

Instagram's terms forbid automated collection without permission; scraping public data
logged out is what Meta v. Bright Data (N.D. Cal. 2024) held those terms do not reach.
Only event facts are imported, and a person confirms every row.
