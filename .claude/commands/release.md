---
description: Cut a reIS release — version bump on test, the test→main release PR, the vX.Y.Z tag, and the iOS build. The extension store publish is a separate manual step.
---

# /release

Ships a release off `test`: version bump → release PR into `main` → merge tags
`vX.Y.Z` → **the iOS App Store build is cut from that tag**. The browser
extension is NOT part of this — see "Publishing the extension" at the bottom.

## Steps

1. **Preflight** — run these and abort if anything is wrong:
   - `git status` — clean working tree
   - on `test`, up to date with `personal/test`
   - no release PR into `main` already open (`gh pr list --base main`)
   - read the current version from `package.json`

2. **Ask the user** (AskUserQuestion, both in one message):
   - New version number (suggest the next patch increment)
   - One-line description for the commit

3. **Bump on a branch off `test`**:
   - `package.json` `version` and `wxt.config.ts` `manifest.version` — same value,
     or `release-tag.yml` refuses to tag
   - Commit `chore: bump to X.Y.Z - <description>`, PR into `test`, merge it

4. **Open the release PR** `test` → `main`. `release-checklist.yml` injects the
   checklist **and a generated privacy block**; `release-gate.yml` requires CI's
   *Build web preview* to have passed for that exact SHA. Walk the checklist —
   the device item is the one that actually catches things.

4b. **Privacy disclosures — do them, don't ask** (memory
   `claude-does-store-disclosures`). The privacy block lists only the store
   declarations that changed in `privacy/disclosures.ts` since the last tag:
   - `npm run privacy:publish` — republishes the policy gist (as
     ElijaahInverted, read back) and dispatches `play-data-safety.yml` to push
     `privacy/play-data-safety.csv`. Then open Play Console → Publishing
     overview in Chrome and **Send for review** if the change is waiting there.
   - App Store label items: App Store Connect → App Privacy in Chrome MCP, add
     or remove exactly the listed types with the listed purpose/linked/tracking,
     **Publish**. If ASC asks for a sign-in, ask Dominik to sign in, then continue.
   - Chrome Web Store items: Chrome blocks every extension from the Web Store
     dashboard, so give Dominik the exact ticks and let him do it.
   - Tick each item in the PR body as it is done. The Release gate re-runs on
     the edit and passes only when all are ticked and the live gist matches.

5. **Merge it.** `release-tag.yml` pushes `vX.Y.Z` and stops. Nothing is
   submitted to any store by any workflow.

6. **Cut the iOS build** on the Mac:
   ```bash
   git fetch --tags && git checkout vX.Y.Z && npm ci
   npm run release:ios -- --tag vX.Y.Z
   ```
   It picks a build number App Store Connect has not seen, syncs the web assets,
   archives, exports, verifies the .ipa (distribution-signed, right
   CFBundleVersion, no error telemetry) and uploads. It stops there.

7. **Submit by hand** in App Store Connect once processing finishes (~3 min):
   add the build to the version → Add for Review → Submit. Confirm the build
   picker really selected the new number; it lists stale builds first.
   `docs/ios-release.md` has the traps, `docs/app-store-listing.md` the listing.

## Rules
- Never skip the preflight — a dirty tree means uncommitted work ships as part of the release.
- Both `package.json` and `wxt.config.ts` move together.
- Merging without a version change releases nothing, on purpose. The bump is the release.
- Do not submit for review from a script. Upload is reversible; submission is not.

## Publishing the extension

`publish.yml` is `workflow_dispatch`-only and submits to Chrome and Firefox. Run it deliberately, against a tag:

```bash
gh workflow run publish.yml --ref vX.Y.Z -f tag=vX.Y.Z
```

Review SLAs: Chrome usually a few days, up to a few weeks; Firefox AMO days–weeks. Edge is not a target — Edge users install from the Chrome Web Store. Chrome goes through API v2 (service account); the four `CHROME_*` secrets are named in `publish.yml`.
