---
description: Cut a reIS release — version bump and agreed What's new on test, the test→main release PR; merging it ships to the App Store, Google Play (closed testing) and Chrome/Firefox in one run.
---

# /release

Ships a release off `test`: version bump + release notes → release PR into
`main` → merge tags `vX.Y.Z` → **`ship.yml` takes it to all three stores in the
same run**: the App Store (build, upload, submit for review), Google Play's
closed-testing track, and Chrome + Firefox. One summary table says what reached
each. Setup, secrets and the dry run: `docs/release-pipeline.md`.

A store submission cannot be recalled, and the merge is what triggers it. So the
release PR is the last gate: walk its checklist before merging.

## Steps

1. **Preflight** — run these and abort if anything is wrong:
   - `git status` — clean working tree
   - on `test`, up to date with `personal/test`
   - no release PR into `main` already open (`gh pr list --base main`)
   - read the current version from `package.json`
   - the repository secrets in `docs/release-pipeline.md` exist (a missing one
     fails its store's job first, naming it, but find out before the merge)

2. **Ask the user** (AskUserQuestion, all in one message):
   - New version number (suggest the next patch increment)
   - One-line description for the commit
   - The **What's new** text, in Czech: agreed with Dominik per release. It
     becomes `release-notes/<version>.cs.txt` (max 500 characters; one text feeds
     the App Store and Google Play).

3. **Bump on a branch off `test`**:
   - `package.json` `version`, `package-lock.json` (the root `version` in two
     places) and `wxt.config.ts` `manifest.version` — same value, or
     `release-tag.yml` refuses to tag
   - `release-notes/<version>.cs.txt` with the agreed text — the Release gate
     fails the PR without it
   - Commit `chore: bump to X.Y.Z - <description>`, PR into `test`, merge it

4. **Open the release PR** `test` → `main`. `release-checklist.yml` injects the
   checklist; `release-gate.yml` requires CI's *Build web preview* to have passed
   for that exact SHA, and the release notes file. Walk the checklist — the
   device item is the one that actually catches things. The Release gate fails
   the first time, every time: it runs before CI's build has reported. Rerun it.

5. **Merge it.** `release-tag.yml` pushes `vX.Y.Z`, then `ship.yml` runs in the
   same run. **This submits to the stores.** Nothing to run on a Mac.

6. **Read the summary** at the bottom of the run (`gh run list --workflow
   release-tag.yml`): App Store, Google Play, Chrome + Firefox. A red row names
   what failed; "Re-run failed jobs" is safe, because each step reads the store's
   state first. A store that needs a human (another App Store version stuck in
   review, a Play permission) says so in its job.

## Rules
- Never skip the preflight — a dirty tree means uncommitted work ships as part of the release.
- `package.json`, `package-lock.json` and `wxt.config.ts` move together.
- Merging without a version change releases nothing, on purpose. The bump is the release.
- The release notes file is part of the release PR. No notes, no tag.
- A change to the pipeline itself (`ship.yml` and friends) is exercised by
  `ship-dryrun.yml` on its own PR: it builds and signs for real and releases
  nothing (Play opens and deletes a temporary edit). Do not merge it red.

## Running the pieces by hand

Each store job is a script, so a retry or an odd case does not need the workflow:

```bash
# iOS (on the Mac): build + upload, then attach and submit
git fetch --tags && git checkout vX.Y.Z && npm ci
npm run release:ios -- --tag vX.Y.Z
npx tsx scripts/release/ios-submit.ts --version X.Y.Z [--dry-run]

# Extension only
gh workflow run publish.yml --ref vX.Y.Z -f tag=vX.Y.Z
```

The whole pipeline can also be dispatched against an existing tag, with
`dry_run` on by default: Actions → Ship → Run workflow.
