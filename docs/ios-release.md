# Releasing reIS to the App Store

`test` → `main` with a version bump pushes `vX.Y.Z`, and `ship.yml` (same run)
turns that tag into a build in App Store Connect and submits it for review
(`npm run release:ios`, then `scripts/release/ios-submit.ts`). Android and the
extension go out in the same run: `docs/release-pipeline.md`.

```text
feature PR → test → (bump version) → release PR → main
                                                   │
                                    release-tag.yml│ pushes vX.Y.Z, then ship.yml (same run)
                                                   ▼
                        ship.yml, macOS job: npm run release:ios --tag vX.Y.Z
                        sync → pick build no. → archive → export → verify → upload
                                                   ▼
                        scripts/release/ios-submit.ts: version → What's new →
                        attach build → read it back → submit for review
```

**This whole chain runs in CI now** (`docs/release-pipeline.md`): `release:ios`
signs with the App Store Connect API key (`REIS_XCODE_API_KEY_AUTH=1`) and
`ios-submit.ts` does what used to be done by hand in App Store Connect. The
Mac-only recipe below still works for a manual cut or a retry
(`npm run release:ios -- --tag vX.Y.Z`, then
`npx tsx scripts/release/ios-submit.ts --version X.Y.Z`). The extension and
Android go out in the same run.

## The App Store Connect API key — already set up

**Done on 2026-09-05.** Team key `reis-release`, role App Manager, key id
`2LV44GFJUP`. The private key is `~/.appstoreconnect/private_keys/AuthKey_2LV44GFJUP.p8`
(mode 600), which is where `xcrun altool` looks for it too, and the identifiers
are in the gitignored root `.env` that `release-ios.ts` loads. On this Mac the
`.p8` is never copied into a variable or the repo. For the CI release it is also
stored as the `ASC_KEY_P8` repository secret (with `ASC_KEY_ID` and
`ASC_ISSUER_ID`), and `ship.yml` writes it to the same
`~/.appstoreconnect/private_keys/` path on the runner.

**This is what removed the Organizer step.** Before the key, uploading was
GUI-only: `xcodebuild -exportArchive` with `destination upload` fails with
*"Failed to find an account with App Store Connect access for team
RG38V3SV8X"*, because it wants a signed-in Apple account it cannot reach.
Verified headless with the key on 2026-09-05:

```
$ xcrun altool --list-apps --apiKey 2LV44GFJUP --apiIssuer cc9d1e09-…
=  Name: reIS — IS MENDELU jednoduše   ID: 6804832714   Bundle ID: cz.reis.app
```

To replace the key (a lost `.p8` cannot be re-downloaded — Apple allows the
download exactly once): App Store Connect → Users and Access → Integrations →
App Store Connect API → **+**, role App Manager, then

```bash
mkdir -p ~/.appstoreconnect/private_keys
mv ~/Downloads/AuthKey_<KEYID>.p8 ~/.appstoreconnect/private_keys/
chmod 600 ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8
```

and update `ASC_KEY_ID` / `ASC_ISSUER_ID` in `.env` — or delete them, since a
single installed `.p8` has its key id inferred from the filename.

The key authorises the whole team account. It now lives in GitHub Actions as a
repository secret because `ship.yml` cuts and submits the build on a macOS
runner, signing with the API key (`REIS_XCODE_API_KEY_AUTH=1`). Whether the key's
App Manager role is enough for cloud-managed distribution signing is proven by
the pipeline's dry run (`docs/release-pipeline.md`); the local cut on this Mac
still works and is the fallback.

## What the script guarantees

`scripts/release-ios.ts`, with the logic in `scripts/lib/`:

- **The build number is free.** It asks ASC for every `CFBundleVersion` already
  uploaded and takes the next one, rather than trusting the stamp in
  `project.pbxproj` — a stamp is per-checkout and `sync-ios-version.ts` refuses
  to lower it, which is how a duplicate reached the last step of an upload
  before. A stamped rebuild counter is counted as taken too.
- **The web assets are fresh.** `cap:sync` runs inside the script; skipping it
  ships the previous build's JS inside a new binary.
- **The .ipa is what we think it is.** Distribution-signed (the archive is
  signed *Apple Development* and the export re-signs — that is expected), the
  exact `CFBundleVersion` that was reserved, and no `report_error` /
  `sendTelemetry` string anywhere in the bundle. Any of these failing aborts
  before the upload.
- **It stops at upload.** `release-ios.ts` itself never submits. Attaching the
  build to a version and submitting is the next step in the pipeline,
  `scripts/release/ios-submit.ts`, which reads the store first, refuses another
  editable version, and reads the attached build back before it submits.
- **It leaves the tree clean, until the upload starts.** The version stamp it
  writes into `project.pbxproj` is a build artifact, and a dirty tree blocks the
  next release's preflight, so it is reverted — reverting after a failed archive
  is also what makes the retry reuse the number rather than skip one. Once
  `altool` has been invoked the stamp **stays**: the bytes may already be at
  Apple, a build takes minutes to appear in `/v1/builds`, and the stamp is then
  the only local record that the number is spent. Clear it by hand
  (`git checkout -- ios/App/App.xcodeproj/project.pbxproj`) once the build shows
  up in App Store Connect.

## Traps that have actually bitten

- **The build picker offers stale builds**, oldest first, and only shows builds
  that have finished processing. Confirm the selected radio before Done.
- **The store provisioning profile goes stale when an entitlement changes.**
  `-exportArchive` then fails with *"doesn't include the …HotspotConfiguration
  entitlement"* even though the archive is signed correctly. Delete the stale
  profile in `~/Library/Developer/Xcode/UserData/Provisioning Profiles` and
  distribute once from Xcode's Organizer so it re-fetches — `xcodebuild` cannot
  do that fetch.
- **Certificates can exist in the account with the private key missing here**
  (`security find-identity -v -p codesigning` → 0 identities). Fix in Xcode →
  Settings → Accounts → Manage Certificates → + → Apple Distribution.
- **The listing is Czech-only.** English copy in the docs has never appeared on
  the store.
- **An "Agreement Update" modal** can block the version page. An outstanding
  agreement also blocks submission.

`docs/app-store-listing.md` is the submission record; the App record is
6804832714, team `RG38V3SV8X`, bundle `cz.reis.app`.
