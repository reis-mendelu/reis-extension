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

## One-time setup: an App Store Connect API key

Without it the upload cannot run headless — `xcodebuild -exportArchive` with
`destination upload` fails with *"Failed to find an account with App Store
Connect access for team RG38V3SV8X"*, because it needs a signed-in Apple
account that `xcodebuild` cannot reach. The API key is what replaces that
account.

1. App Store Connect → **Users and Access** → **Integrations** → **App Store
   Connect API** → **+**. Name it (e.g. `reis-release`), role **App Manager**.
2. Download the `.p8`. **Apple allows this exactly once.**
3. Put it where both this script and `xcrun altool` look for it:
   ```bash
   mkdir -p ~/.appstoreconnect/private_keys
   mv ~/Downloads/AuthKey_<KEYID>.p8 ~/.appstoreconnect/private_keys/
   ```
4. Export the identifiers — the key id is in the row, the issuer id is above the
   table:
   ```bash
   export ASC_KEY_ID=<KEYID>
   export ASC_ISSUER_ID=<ISSUER-UUID>
   ```
   Or put both in Infisical: `npm run release:ios` goes through
   `scripts/with-secrets.mjs`, so they arrive from there without a shell export.
   The `.p8` itself stays a file on disk and is never put in a secret store or
   an environment variable.

The key is a credential for the whole team account. It is not in the repo, not
in GitHub Actions, and there is no CI path that needs it — CI cannot sign iOS
builds here, which is the reason the cut is local.

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
