# The release pipeline

Merging the `test` → `main` release PR takes a version to **all three stores in
one run**, with one summary table at the end:

```
release PR merged into main
  └─ release-tag.yml   pushes vX.Y.Z (only if package.json's version changed,
  │                    and release-notes/X.Y.Z.cs.txt exists)
  └─ ship.yml          (same run: a tag pushed with GITHUB_TOKEN starts no workflow)
       ├─ Database      supabase db push → prod, FIRST; every store waits on it
       ├─ Google Play   signed AAB → production, full rollout
       ├─ App Store     archive → upload → attach to version → submit for review
       ├─ Extension     Chrome Web Store + Firefox Add-ons (publish.yml)
       └─ Summary       one table; red if any store failed
```

The stores are **independent jobs**. One failing never stops the others, and
"Re-run failed jobs" is safe: the two **submission** steps (`ios-submit.ts`,
`play-upload.ts`) read the store first and report a step already done instead of
repeating it (a version already waiting for review, a versionCode already on
the track). The iOS job asks first (`ios-submit.ts --check`) and skips the
archive and upload when the version is already submitted, so a re-run never
sends a duplicate binary. If only the submit step failed, re-run just that by
hand: `npx tsx scripts/release/ios-submit.ts --version X.Y.Z`.

The **database** job is the exception: it runs first and the stores `need`
it. It applies every migration merged since the last release (`supabase db
push`, CLI pinned to 2.121.0). A file that fails is rolled back and not
recorded, and no store is submitted; see `docs/database-migrations.md`. With
nothing pending it changes nothing. It uses `SUPABASE_ACCESS_TOKEN`, which the
edge-function deploy already has. A dry run only lists what would apply.

## What a release needs in the PR

- The version bumped in `package.json`, `package-lock.json` and
  `wxt.config.ts`, all to the same value.
- **`release-notes/<version>.cs.txt`**: the agreed Czech "What's new". One text
  feeds the App Store (`cs`) and Google Play (`cs-CZ`, max 500 characters). The
  Release gate goes red without it, and the tag job checks again before tagging.
  Agree the words with Dominik per release, as before.

## Before the release PR

`npm run release:preflight -- --version X.Y.Z` (the version about to ship) is
read-only: it fetches `main` and `test`, reads App Store Connect, and changes
nothing. It exits 1 on either finding below. `/release` runs it first.

### main/test drift

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

### Another App Store version still in review

Only one iOS version can be edited at a time. If the previous release is still
waiting for review, in review, or otherwise editable (rejected, a stale draft),
`ship.yml` uploads the new build and then `ios-submit.ts` stops with "X is
WAITING_FOR_REVIEW; only one version can be edited". Google Play, the extension
and the database still ship, and only the summary goes red. That happened at
5.7.1 (unnoticed for 3 days) and again at 5.7.2. The preflight names each blocking
version with its version record id and, when it is in review, its review
submission id. The new version's own draft is not reported: `ios-submit.ts`
reuses it.

Two choices. **Dominik picks, and withdrawing always needs his OK:**

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
      without `--dry-run`.

   iOS users then skip the withdrawn version. Carry its What's new line into
   this release's notes (5.7.1's line went into 5.7.2's for iOS).

## One-time setup: repository secrets (Dominik adds these)

Nobody and nothing else may add them: they are credentials. A job whose secrets
are missing fails first and names the missing ones.

| Secret | What it is | Where it comes from |
| --- | --- | --- |
| `ASC_KEY_ID` | App Store Connect API key id (`reis-release`) | Users and Access → Integrations → App Store Connect API |
| `ASC_ISSUER_ID` | The issuer UUID on that page | same page |
| `ASC_KEY_P8` | The **text** of `AuthKey_<id>.p8` (the whole PEM) | the file on this Mac, `~/.appstoreconnect/private_keys/` |
| `ANDROID_KEYSTORE_B64` | The upload keystore, base64 on one line: `base64 -i ~/reis-upload-key.jks \| pbcopy` | `~/reis-upload-key.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | its store password | `android/keystore.properties` (`storePassword`) |
| `ANDROID_KEY_ALIAS` | `reis-upload` | `android/keystore.properties` (`keyAlias`) |
| `ANDROID_KEY_PASSWORD` | only if different from the store password | `android/keystore.properties` (`keyPassword`) |

**iOS signing.** An App Manager API key cannot use Apple's cloud signing for the
export (*Cloud signing permission error*), and each cloud-signed run also leaves a
"Created via API" development certificate behind. So CI signs archive and export
itself, with a distribution certificate made for CI through the API (own CSR, so
its private key was never only in someone's keychain) and an App Store profile
for `cz.reis.app`:

| Secret | What it is |
| --- | --- |
| `IOS_DIST_P12_B64` | the CI Apple Distribution certificate + private key, `.p12`, base64 |
| `IOS_DIST_P12_PASSWORD` | the password the `.p12` was exported with (generated with it) |
| `IOS_STORE_PROFILE_B64` | the App Store profile "reIS CI App Store", base64 |

`ship.yml` imports them into a temporary keychain; `release-ios.ts` then switches the app target's Release
configuration to manual signing (`scripts/lib/iosManualPbxproj.ts`), archives and exports with `scripts/lib/iosManualExport.ts`. Without the secrets
it falls back to cloud signing. The certificate and profile expire on 2027-10-11
(re-create both through `POST /v1/certificates` and `POST /v1/profiles`, then reset
the secrets) and the profile goes stale if the app's entitlements change.

Already present and reused: `CHROME_*`, `FIREFOX_*`, and the Google service
account `CHROME_SERVICE_ACCOUNT_*`, which also calls the Play Developer API.

**The privacy-policy gist** is republished by `privacy-gist.yml` with `GIST_TOKEN`:
a fine-grained personal access token of ElijaahInverted (the gist's owner) with
only the account permission **Gists: Read and write**. `GITHUB_TOKEN` is not
accepted for gists. `npm run privacy:publish` dispatches it and `play-data-safety.yml`;
a cloud session, which has no local `gh` login, dispatches the same two workflows
on `test` instead. Without the secret, `npm run privacy:publish -- --gist-local`
writes the gist from the Mac's `gh` the old way.

**Play Console, once:** Users and permissions → the service account → app
permissions for `cz.reis.app` → **Release to production, exclude devices and use
Play app signing** (it also holds **Release apps to testing tracks** and the Data
safety permission). Without it the commit fails with a 403. Releases go to
**production** at full rollout; to send one to another track instead, set the
repository **variable** `PLAY_TRACK` (e.g. `alpha`) or pass `--track`. A wrong
name fails with the real track names listed. A newer production version also
reaches the Alpha testers: Play gives everyone the highest versionCode they can
see, so the closed track needs no upload of its own.

## Proving it before a release depends on it

`ship-dryrun.yml` runs the whole pipeline with `dry_run: true` on every PR that
touches it (and `Actions → Ship → Run workflow` does the same by hand). A dry run
builds and signs for real and **releases nothing**:

- Android: builds the signed AAB, opens a temporary Play edit, lists the tracks,
  deletes the edit. It does not prove the production permission: only a commit
  needs it, so a missing grant first shows on a real release.
- iOS: archives and exports a distribution-signed `.ipa` (`--skip-upload`),
  queries App Store Connect.
- Extension: `wxt submit --dry-run`, on the **latest existing tag**, not the PR's
  code (the extension leg is not exercised by a change to it).

If iOS signing fails here, that is the one real unknown: a CI runner has no
Apple ID, so `xcodebuild` signs with the API key
(`REIS_XCODE_API_KEY_AUTH=1`, scripts/lib/iosRelease.ts `xcodeAuthArgs`).
Cloud-managed distribution signing may need a role above App Manager on the key.
The dry run skips Dependabot PRs and PRs from forks.
The fallback is a distribution certificate (`.p12`) and provisioning profile
imported into a temporary keychain.

## What it does not do

- **Staged rollout.** Production goes to 100% at once. A bad build is stopped
  in Play Console (halt the rollout), not by this pipeline.
- **The Play Data safety form.** Still `play-data-safety.yml`.
- **Recall.** A store submission cannot be taken back. The gates are the release
  PR (the diff, the notes, CI, the privacy block) and the merge itself.
- A Play release is committed, not live: Google reviews it before anyone gets
  it (the first production release, 5.4.1, cleared in about 5 hours).
