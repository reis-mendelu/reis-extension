# The release pipeline

Merging the `test` → `main` release PR takes a version to **all three stores in
one run**, with one summary table at the end:

```
release PR merged into main
  └─ release-tag.yml   pushes vX.Y.Z (only if package.json's version changed,
  │                    and release-notes/X.Y.Z.cs.txt exists)
  └─ ship.yml          (same run: a tag pushed with GITHUB_TOKEN starts no workflow)
       ├─ Database      supabase db push → prod, FIRST; every store waits on it
       ├─ Google Play   signed AAB → closed-testing track (Alpha)
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

The **database** job is the exception: it runs before the stores and they
`need` it. It applies every migration merged since the last release
(`supabase db push`, CLI pinned to 2.121.0), so a build never reaches a student
ahead of the column or RPC it calls. A file that fails is rolled back and not
recorded, the job goes red and no store is submitted. The failed file stays
pending and the next release tries it first, so fix that file itself, as
`docs/database-migrations.md` describes. It is idempotent: with nothing pending (a re-run,
a release without migrations) it changes nothing. It uses
`SUPABASE_ACCESS_TOKEN`, the secret the edge-function deploy already has. A dry
run and a PR's dry run only list what would be applied (`--dry-run`). How
migrations are written so old builds survive: `docs/database-migrations.md`.

## What a release needs in the PR

- The version bumped in `package.json`, `package-lock.json` and
  `wxt.config.ts`, all to the same value.
- **`release-notes/<version>.cs.txt`**: the agreed Czech "What's new". One text
  feeds the App Store (`cs`) and Google Play (`cs-CZ`, max 500 characters). The
  Release gate goes red without it, and the tag job checks again before tagging.
  Agree the words with Dominik per release, as before.

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

**Play Console, once:** Users and permissions → the service account → grant the
app permission **Release to testing tracks** for `cz.reis.app`. It already holds
the Data safety permission, which is a different one. If the closed track's API
name is not `alpha`, set the repository **variable** `PLAY_TRACK`; a wrong name
fails with the real track names listed.

## Proving it before a release depends on it

`ship-dryrun.yml` runs the whole pipeline with `dry_run: true` on every PR that
touches it (and `Actions → Ship → Run workflow` does the same by hand). A dry run
builds and signs for real and **releases nothing**:

- Android: builds the signed AAB, opens a temporary Play edit, lists the tracks,
  deletes the edit.
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

- **Android production.** Only the closed-testing track. Production needs Google's
  closed-test requirement first: 12 testers opted in for 14 days.
- **The Play Data safety form.** Still `play-data-safety.yml`.
- **Recall.** A store submission cannot be taken back. The gates are the release
  PR (the diff, the notes, CI, the privacy block) and the merge itself.
- A Play release is committed, not live: Google reviews a closed-track release
  before testers get it.
