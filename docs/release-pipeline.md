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
       ├─ VŠE           reIS pro VŠE → its own Chrome Web Store item (publish-vse.yml;
       │                off until set up)
       ├─ Claude        reIS for Claude → reis-mendelu/reis-for-claude, only if it changed
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

`npm run release:preflight -- --version X.Y.Z` reports main/test drift and an App
Store version that would block the submit, read-only. What each finding means
and the recipes (sync main into test; wait, withdraw or rename an App Store
version): [`docs/release-preflight.md`](release-preflight.md).

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
| `REIS_FOR_CLAUDE_TOKEN` | fine-grained token: resource owner **reis-mendelu**, only the repository **reis-for-claude**, permission **Contents: Read and write**. It expires (a year at most): renew it before then | github.com → Settings → Developer settings → Fine-grained tokens |

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

## reIS for Claude

The `mcp` job (`scripts/mcp-publish.mjs`) releases reIS for Claude with the
app, so nobody bumps or releases it by hand. Its version is the app's.
It publishes only when what it ships changed: it fingerprints the built `.mcpb`
and plugin with the version left out (`scripts/lib/mcpFingerprint.mjs`) and
compares with the `Fingerprint:` line in the last release's notes. Unchanged is
a success that publishes nothing. Changed:

1. pushes the plugin (`dist-plugin/reis`) to the root of `reis-for-claude`'s
   `main`, which Claude Code students update from (and Claude's directory, if
   the listing is live);
2. creates the release `mcp-vX.Y.Z` there with the `.mcpb`: the students'
   permanent download link, and what the `.mcpb`'s update notice compares against.

Job `mcp-build` runs `npm ci` and the build with no secret and hands over only
the built files; job `mcp` runs the publish script from a fresh checkout with no
`npm ci`, and is the only place `REIS_FOR_CLAUDE_TOKEN` exists. A re-run is safe:
a finished release means done, a draft left by a stopped run is removed and
published again, a release missing its `.mcpb` gets it uploaded, and an
unchanged plugin is not pushed again. A version older than the latest release
is refused, so re-running an old release never replaces newer code. To ship it
alone: `gh workflow run ship.yml -f tag=vX.Y.Z -f stores=mcp -f dry_run=false`.

Between app releases, from a clean checkout, run `npm ci`, then `npm run mcp:release` (with a
`GH_TOKEN` that can write to the repository) publishes the same way, but only
while `mcp-v<package.json version>` does not exist yet. Once that version is
released, changed contents are refused, not published: they ship with the next
app version (bump `package.json`, normally through `/release`).

## reIS pro VŠE (Chrome only)

The same release, built for VŠE (`REIS_SCHOOL=vse`, `src/utils/schoolProfiles.ts`),
goes to its **own** Chrome Web Store item. Job `extension-vse` in `ship.yml` calls
the reusable `publish-vse.yml`, the way `extension` calls `publish.yml`, with the
item id as an input and the secrets inherited. Same version, same tag, same
publisher and service account, so **no new secret**. No Firefox add-on, and no
release notes (CWS has no field for them).

- **Off until the repo variable `CWS_VSE_ITEM_ID` is set** (Settings → Secrets
  and variables → Actions → *Variables*, not *Secrets*: a job's `if:` cannot read
  secrets, and the id is public in the store URL anyway). Until then the job is
  skipped, the summary row says so, and the dry run stays green.
- **Before uploading it checks the built zip's manifest**, inline in
  `publish-vse.yml`: name `reIS pro VŠE`, host permissions `https://insis.vse.cz/*` only,
  no `mendelu` anywhere. A tag older than the VŠE listing ignores `REIS_SCHOOL`
  and builds MENDELU's extension; the check stops that before it reaches the
  VŠE item.
- **It refuses while the VŠE privacy policy URL is a placeholder**
  (`VSE_PRIVACY_POLICY_URL` in `src/utils/schoolProfiles.ts`;
  `scripts/assertStoreReady.ts`). So does `npm run zip:vse`. A plain
  `REIS_SCHOOL=vse npx wxt zip` still builds, for testing.
- **Its own row in the summary**: `success` when it ran, `skipped` while
  `CWS_VSE_ITEM_ID` is unset. Set and selected but not `success` is red.
- **Re-run failed jobs** reruns it alone; MENDELU's extension job is separate.

**The first version is uploaded by hand**: the publishing tool only updates an
item that exists. In order:

1. Publish `docs/privacy-policy-vse.md` (a gist, like MENDELU's) and put its URL
   in `VSE_PRIVACY_POLICY_URL`. That lands in a release like any change.
2. From that release's tag: `git checkout vX.Y.Z && npm ci && npm run zip:vse`.
   The zip is `.output/insis.vse.cz/reis-X.Y.Z-chrome.zip`.
3. Chrome Web Store dashboard, the same publisher as MENDELU's reIS: **New
   item**, upload that zip, fill in the listing and the Privacy tab (single
   purpose; `storage`, `unlimitedStorage`, `alarms` and the one host; no remote
   code; **no data collected**; the policy URL), submit.
4. Copy the item id from its URL into the repo **variable** `CWS_VSE_ITEM_ID`.
   Every later release ships it.

## Proving it before a release depends on it

`ship-dryrun.yml` runs the whole pipeline with `dry_run: true` on every PR that
touches it (and `Actions → Ship → Run workflow` does the same by hand). A dry run
builds and signs for real and **releases nothing**:

- Android: builds the signed AAB, opens a temporary Play edit, lists the tracks,
  deletes the edit. It does not prove the production permission: only a commit
  needs it, so a missing grant first shows on a real release.
- iOS: archives and exports a distribution-signed `.ipa` (`--skip-upload`),
  queries App Store Connect about the version the PR would release
  (`package.json` at the built ref, not the latest tag): its own draft is fine,
  another version waiting for review or being edited fails the dry run, as it
  would fail the real submit.
- Extension: `wxt submit --dry-run`, on the **latest existing tag**, not the PR's
  code (the extension leg is not exercised by a change to it). The VŠE job does
  the same once `CWS_VSE_ITEM_ID` is set, after its manifest check.

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
