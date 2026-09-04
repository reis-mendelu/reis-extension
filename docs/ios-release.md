# Releasing reIS to the App Store

The release train drives **iOS only**. `test` → `main` with a version bump
pushes `vX.Y.Z`; `npm run release:ios` turns that tag into a build in App Store
Connect. Nothing submits anything for review automatically.

```
feature PR → test → (bump version) → release PR → main
                                                   │
                                    release-tag.yml│ pushes vX.Y.Z, then stops
                                                   ▼
                        npm run release:ios --tag vX.Y.Z   (on a Mac)
                        sync → pick build no. → archive → export → verify → upload
                                                   ▼
                        App Store Connect: add build to version, submit  (by hand)
```

The browser extension is not on this train. `publish.yml` is dispatch-only:
`gh workflow run publish.yml --ref vX.Y.Z -f tag=vX.Y.Z`.

## The App Store Connect API key — already set up

**Done on 2026-09-05.** Team key `reis-release`, role App Manager, key id
`2LV44GFJUP`. The private key is `~/.appstoreconnect/private_keys/AuthKey_2LV44GFJUP.p8`
(mode 600), which is where `xcrun altool` looks for it too, and the identifiers
are in the gitignored root `.env` that `release-ios.ts` loads. The `.p8` is
never copied into a variable, a secret store or the repo.

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

The key authorises the whole team account. It is deliberately **not** in GitHub
Actions: CI still cannot sign an iOS build here, which is why the cut is local.

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
- **It stops at upload.** `test` is not a protected branch, so no push should be
  able to reach App Review. Adding the build to a version and submitting is
  done by a person.
- **It leaves the tree clean.** The version stamp it writes into
  `project.pbxproj` is reverted afterwards, success or failure — the stamp is a
  build artifact, and a dirty tree would block the next release's preflight.

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
