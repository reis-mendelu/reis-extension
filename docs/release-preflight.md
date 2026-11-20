# Before the release PR: the preflight

Two traps each cost a manual detour after the 5.7.2 merge (2026-11-15). This is
what catches them and what to do about each. The pipeline itself:
[`docs/release-pipeline.md`](release-pipeline.md).

`npm run release:preflight -- --version X.Y.Z` (the version about to ship) is
read-only: it fetches `main` and `test`, reads App Store Connect, and changes
nothing. It exits 1 on either finding below. `/release` runs it once the version
is agreed, and again after the bump, before the release PR.

## main/test drift

A release PR squashed onto `main` leaves `main` with a commit `test` never had.
The next release PR then conflicts in the version files and `PRIVACY.md` (5.7.2;
fixed by hand in #702). The check is `git merge-tree --write-tree origin/main
origin/test`, and its exit code is the answer: 0 clean, 1 conflicts, anything
else an error, never "clean". It also says whether `main`'s tree is the tree of
some commit in `test`'s history. Then `main` holds nothing `test` lacks, and the
sync below is provably lossless.

A clean `merge-tree` is not the whole answer. Right after a squashed release,
`main` and `test` have the same tree and merge cleanly, but `main` changed the
version files relative to the merge base, so the version bump on `test`
conflicts with it. The preflight therefore also reports drift whenever `main`'s
tree differs from the merge base's tree: `main` adds something beyond `test`.

**Sync** (before the version bump: nothing may merge into `test` while a release
PR is open):

```bash
git fetch origin main test
git checkout -b sync-main-into-test origin/test
git merge -s ours origin/main -m "Merge main into test"
git diff origin/test --stat
```

The diff must be empty. Push, open a PR into `test`, and merge it **with a merge
commit** (`gh pr merge <N> --merge`). A squash would leave `main` out of `test`'s
history and fix nothing. Afterwards `main` is an ancestor of `test` and the
preflight is clean.

If the preflight says `main`'s tree is **not** in `test`'s history, `main`
holds something `test` lacks (a fix pushed straight to `main`, like #598). Do not
use `-s ours` then: it would drop it. Read `git diff origin/test origin/main`
first, and merge `origin/main` normally, resolving each conflict by hand.

**Prevention:** merge the release PR itself with a merge commit, never squash.
`main` then only ever gains merge commits whose second parent is `test`, so
`test` and `main` cannot drift. `release-tag.yml` already handles a merge
commit (it reads the first parent), and 5.4.0–5.7.0 shipped that way.

## Another App Store version still in review

Only one iOS version can be edited at a time. If the previous release is still
waiting for review, in review, otherwise editable (rejected, a stale draft) or
approved but pending release,
`ship.yml` uploads the new build and then `ios-submit.ts` stops with "X is
WAITING_FOR_REVIEW; only one version can be edited". Google Play, the extension
and the database still ship, and only the summary goes red. That happened at
5.7.1 (unnoticed for 3 days) and again at 5.7.2. The preflight names each blocking
version with its version record id and, when it is in review, its review
submission id. The new version's own draft is not reported: `ios-submit.ts`
reuses it.

**Dominik picks, and any change to a version in App Store Connect needs his OK.**
For a version in review there are two choices:

1. **Wait** until Apple finishes the review, then release. Or release anyway
   and run `npx tsx scripts/release/ios-submit.ts --version X.Y.Z` once the
   previous version is out of review.
2. **Withdraw** the version in review, when the new release cannot wait (5.7.2).
   `ios-submit.ts` only attaches a build that is already uploaded; it never
   uploads one. So what you run depends on whether the release has merged:
   1. `PATCH /v1/reviewSubmissions/<submission id>` with
      `{"data":{"type":"reviewSubmissions","id":"<id>","attributes":{"canceled":true}}}`.
   2. Wait until the version reads `DEVELOPER_REJECTED`. It goes through
      `CANCELING` first, which took under a minute at 5.7.2.
   3. Rename that version record to the new version, so no second editable
      record blocks: `PATCH /v1/appStoreVersions/<version record id>` with
      `{"data":{"type":"appStoreVersions","id":"<id>","attributes":{"versionString":"X.Y.Z"}}}`.
   4. **Before the merge (from the preflight): stop here.** Merge the release
      PR; `ship.yml` uploads the build and `ios-submit.ts` reuses the renamed
      record and submits it. **After the merge** (the iOS leg already uploaded
      the build and stopped, as at 5.7.2):
      `npx tsx scripts/release/ios-submit.ts --version X.Y.Z --dry-run`, then
      without `--dry-run`. The dry run must say `build … is VALID`: with no
      X.Y.Z build uploaded it still exits 0 ("No build … expected before the
      upload"), and the real run would then poll for about ten minutes and fail.

   iOS users then skip the withdrawn version. Carry its What's new line into
   this release's notes (5.7.1's line went into 5.7.2's for iOS).

**A blocker that is not in review** (the preflight shows a version record id and
no review submission): `DEVELOPER_REJECTED`, `REJECTED`, `METADATA_REJECTED`,
`INVALID_BINARY`, or another version's stale `PREPARE_FOR_SUBMISSION` draft.
Nothing waits on Apple, so neither choice above clears it. Rename that record to
the new version (step 3 above, without steps 1 and 2), and `ios-submit.ts`
reuses it like its own draft. If the new version already has a draft of its own,
there are two editable records: delete one of them in App Store Connect first.
Same approval rule: Dominik's OK.

**Pending release** (`PENDING_DEVELOPER_RELEASE`, `PENDING_APPLE_RELEASE`): the
previous version is approved but not out, and Apple will not create another
version until it is. Release it in App Store Connect (or let the scheduled date
pass) first. reIS submits with "release after approval", so this should not
normally happen.

