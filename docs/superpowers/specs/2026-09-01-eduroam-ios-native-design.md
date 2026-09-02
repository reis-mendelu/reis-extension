# Design — eduroam on iOS: native one-tap Wi-Fi setup in the Capacitor app

**Date:** 2026-09-01
**Status:** Approved design, not yet built.
**Closes:** #159 (iOS half), #212 (superseded). **Unblocks:** #191 on iOS.
**Sibling:** the Android half, shipped in PR #189 and campus-verified 2026-08-08.

## 1. Goal

A student opens **eduroam** in the reIS iOS app, taps one button, taps **Join** in
iOS's own alert, and the iPad or iPhone is on eduroam. No profile file, no QR, no
password typed, nothing leaving the device.

Definition of done: **the developer's iPad associates with a MENDELU eduroam access
point on campus** through the flow below, and the checklist in §8 is green.

## 2. Why now

Two things that were true on 2026-08-10 (issue #159's last iOS comment) are no
longer true, both measured on 2026-09-01:

1. **The entitlement gate is gone.** Building the `App` scheme against the paid team
   `RG38V3SV8X` with `com.apple.developer.networking.HotspotConfiguration` as a
   `CODE_SIGN_ENTITLEMENTS` override succeeded. `codesign -d --entitlements` on the
   product shows the key set to true, and the regenerated `iOS Team Provisioning
   Profile: cz.reis.app` carries it. Xcode enabled the capability on the App ID as a
   side effect (`-allowProvisioningUpdates`). The 2026-08-10 failure was the free
   personal team, and that team is no longer in use.
2. **The self-signed-root risk is smaller than the issue assumed.** geteduroam's
   open-source iOS app (`github.com/geteduroam/apple-app`, BSD-3) configures EAP-TLS
   with private institutional roots through exactly this API, for every eduroam
   institution whose CAT profile ships its own CA. Its recipe, checked against the
   iOS 26 SDK header `NEHotspotConfigurationManager.h`, is the one in §5. The
   question is still verified on device (§8 step 3), but it is no longer a coin
   flip.

## 3. Scope

**In**

- A Swift Capacitor plugin package that saves eduroam via `NEHotspotConfigurationManager`.
- A platform-neutral result contract between the native plugins and TypeScript.
- Admitting `'ios'` in `canConfigureEduroamNatively`.
- Resolving the sheet's target from Capacitor instead of the user agent (the root
  cause of #212 and of its latent "WKWebView says Macintosh" defect).
- Two copy strings made platform-neutral.
- Entitlements committed to the Xcode project.
- A device verification checklist, executed on campus.

**Out**

- The post-login welcome card (#191). Its iOS gate lifts when this merges; the card
  is its own design.
- The certificate-expiry prompt (#159 "Certificate expiry" section). The config side
  needs no mechanism — re-running replaces the credential in place (§5 step 3) —
  but the prompt is a separate design because it touches an IS write.
- The desktop → phone QR path. Unchanged, still the right answer in a browser.
- macOS. Keeps `.mobileconfig`; there is no app there.

## 4. Architecture

### 4.1 Pieces

| Piece | Location | Change |
|---|---|---|
| iOS plugin | `native/capacitor-eduroam/` (new) | `package.json` with `capacitor.ios.src = "ios"`, `Package.swift`, `ios/Sources/EduroamPlugin/EduroamPlugin.swift`. `@objc(EduroamPlugin)`, `jsName = "Eduroam"`, one method `configure`. |
| Android plugin | `android/app/src/main/java/cz/reis/app/EduroamPlugin.java` | **Untouched.** Keeps resolving its raw `{ resultCode, perNetwork }`; it is device- and campus-verified and this Mac cannot build Android, so the design does not reopen it (decided 2026-09-01). |
| JS bridge | `src/mobile/configureEduroam.ts` | Accepts both result shapes (§4.2): Android's raw codes through the existing `interpretAddResult`, iOS's `{ outcome }` through a normalizer. Keeps the password precondition and the fail-closed rule. |
| Host gate | `src/mobile/eduroamNative.ts` | `canConfigureEduroamNatively` admits `'ios'` alongside `'android'` when `getPlatform().kind === 'capacitor'`. |
| Sheet | `src/components/mobile/sheets/EduroamSheet.tsx` | `detectTarget()` asks `Capacitor.getPlatform()` on the Capacitor host, UA guess only in a browser. |
| Hook | `src/hooks/data/useEduroamSetup.ts` | Type change only. Its native branch already handles every outcome. |
| Entitlements | `ios/App/App/App.entitlements` (new), `project.pbxproj` | §6. |
| App deps | `package.json` | `"@reis/capacitor-eduroam": "file:native/capacitor-eduroam"`. |
| Copy | `src/i18n/locales/{cs,en}.json` | §7: two strings made platform-neutral, one new iOS-only key. |

The JS name `Eduroam` is shared by both native halves on purpose: `registerPlugin('Eduroam')`
resolves to whichever the OS provides, so TypeScript never branches on platform to
pick a plugin.

**Why a package and not an app-local Swift file:** `native/capacitor-secure-store/README.md`
records the measurement. Capacitor 8 builds `packageClassList` only from installed
plugin packages; an app-target file compiles and then every call rejects with
"not implemented on ios". Same layout as that package, same `cap sync` registration.

### 4.2 The result contract: two shapes, one normalizer

The Android plugin resolves raw `{ resultCode: number; perNetwork: string }` and
TypeScript decodes Android's constants in `interpretAddResult`. That stays. iOS has no
such codes, so its plugin resolves a neutral shape, and TypeScript accepts either:

```ts
export type EduroamConfigOutcome = 'saved' | 'already-configured' | 'cancelled' | 'failed';

/** Android: what ACTION_WIFI_ADD_NETWORKS returned. Decoded by interpretAddResult (unchanged). */
export interface NativeAddResult { resultCode: number; perNetwork: string }
/** iOS: the plugin already mapped NEHotspotConfigurationError (§5). `detail` is never shown raw. */
export interface NativeOutcomeResult { outcome: string; detail?: string }
export type NativeConfigureResult = NativeAddResult | NativeOutcomeResult;

export function normalizeOutcome(result: NativeConfigureResult | null | undefined): EduroamConfigOutcome;
```

- A result with `outcome` is iOS: one of the four strings passes through, anything
  else is `'failed'`.
- A result with `resultCode` is Android: `interpretAddResult` as today.
- Anything else (null, an empty object) is `'failed'`.

Fail-closed throughout: claiming success when the network was not saved sends a
student to campus with Wi-Fi that never connects; the opposite mistake self-corrects
on retry. An earlier draft moved the Android mapping into Java; it was dropped on
2026-09-01 so the verified Android plugin is not reopened.

Rejections (thrown errors) stay rejections on both platforms and reach the sheet
through `useEduroamSetup`'s `catch`, prefixed by `eduroam.native.error`.

### 4.3 Data flow

Unchanged from Android. `fetchEduroamCertMaterial()` runs in the WebView, which
holds the IS session, and returns the `.p12`, the MENDELU root DER and the extraction
password. The two blobs cross the bridge as base64 (a few KB). The password crosses
because iOS, like Android, needs it to open the PKCS#12. It is never written to a
file, never embedded in a profile, never uploaded. The no-embed rule from the QR path
exists because that path uploads; this path has no upload.

## 5. The Swift plugin

`configure(_ call: CAPPluginCall)` runs on the main thread — the API requires the app
in the foreground and shows a system alert — and reports the stage on every failure,
mirroring the Android plugin's `FAILED at stage=…` convention.

| Stage | What happens | Failure means |
|---|---|---|
| `decode` | Base64 → `Data` for `p12Base64` and `caDerBase64`; `passphrase` read. Any of the three missing → reject. | Caller bug. |
| `keystore` | `SecPKCS12Import(p12, [kSecImportExportPassphrase: passphrase])`. Take the first item's `SecIdentity` and `kSecImportItemCertChain`. | The password IS showed did not open the file. Same message class as Android. |
| `clean` | `SecItemDelete` any identity and certificates reIS added on a previous run, matched by our fixed labels in the access group. `errSecItemNotFound` is success. | — |
| `keychain` | `SecItemAdd` the identity, each chain certificate, and the MENDELU root into access group `<TeamID>.com.apple.networkextensionsharing`, `kSecAttrAccessibleAfterFirstUnlock`, labels `reIS eduroam identity`, `reIS eduroam chain`, `reIS eduroam root`. **Do not request persistent references** — iOS then rejects the profile as invalid EAP settings. `errSecDuplicateItem` after `clean` is a bug and rejects. Read the identity and root back with `SecItemCopyMatching(kSecReturnRef)`; those references are what the setters resolve. | `errSecMissingEntitlement` (-34018) = the keychain group is not in the entitlements (§6). |
| `eapSettings` | `NEHotspotEAPSettings`: `supportedEAPTypes = [13]` (EAP-TLS), `isTLSClientCertificateRequired = true`, `setIdentity(identity)`, `setTrustedServerCertificates([root])`, `trustedServerNames = ["aleph.mendelu.cz"]`. A `false` from either setter → reject. No `username`/`outerIdentity`: EAP-TLS takes the identity from the certificate. | — |
| `apply` | `NEHotspotConfiguration(ssid: "eduroam", eapSettings:)`; `joinOnce` false (unsupported for EAP anyway, error 12); no `lifeTimeInDays` (does not apply to enterprise). `NEHotspotConfigurationManager.shared.apply` shows the *"reIS" Wants to Join Wi-Fi Network "eduroam"?* alert. | Mapped below. |

**Team ID** is read at runtime from the app's own `keychain-access-groups`
entitlement (the first group's prefix), not hard-coded. geteduroam hard-codes theirs;
we have two signing teams in this project's history and a demo bundle id, so a
constant would be wrong on at least one of them.

**Why `clean` matters.** MENDELU certificates live 366 days. Re-running after renewal
must replace the identity; two identities under the same label would leave iOS to
pick one at authentication time. `apply` itself "adds or updates" the network
configuration, so the network side needs no removal.

**Why `trustedServerNames` is `aleph.mendelu.cz` and not `mendelu.cz`.** It is the
value the working `.mobileconfig` has pinned since June; the header describes the
match as against the server certificate's CN or DNSName, with wildcards allowed, so
the exact name is the tighter and already-proven choice. Android's `mendelu.cz` is a
different API with label-wise suffix semantics; the two are not interchangeable.

**Outcome mapping** from `NEHotspotConfigurationError`:

| Error | Outcome / action |
|---|---|
| none | `saved` — stored; iOS joins when eduroam is in range |
| `userDenied` (7) | `cancelled` — student tapped Cancel; offer the button again, no banner |
| `alreadyAssociated` (13) | `already-configured` — the device is on eduroam right now |
| `pending` (9) | reject: "a previous eduroam request is still open" |
| `invalidEAPSettings` (4), `internal` (8), `systemConfiguration` (10), `unknown` (11), anything else | `failed`, `detail = "NEHotspotConfigurationError <code>"` |

`applicationIsNotInForeground` (14) cannot follow a button tap and falls into the
generic failure. Unknown codes fail closed.

**iOS 15.0 and 15.1** have a platform bug where `setTrustedServerCertificates` makes
the profile invalid (Apple Developer Forums thread 688323, fixed in 15.2). On exactly
those two point releases the plugin rejects with a clear message rather than silently
dropping root pinning, which is what geteduroam chose. The deployment target stays
15.0; the population on 15.0/15.1 is negligible.

## 6. Entitlements and project wiring

`ios/App/App/App.entitlements`, committed:

```xml
<dict>
  <key>com.apple.developer.networking.HotspotConfiguration</key>
  <true/>
  <key>keychain-access-groups</key>
  <array>
    <string>$(AppIdentifierPrefix)com.apple.networkextensionsharing</string>
  </array>
</dict>
```

Nothing else. The App Store listing's "declares no entitlements" line
(`docs/app-store-listing.md` §10) becomes "declares two, both for eduroam", and
`com.apple.security.pkcs12`-style export-compliance answers are unaffected: the app
still implements no encryption of its own.

- `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` in `project.pbxproj` for **both**
  Debug and Release. The project stays teamless; the team keeps coming from the
  command line (`DEVELOPMENT_TEAM=RG38V3SV8X`) or from Xcode, as today.
- The App ID already has Hotspot Configuration enabled (2026-09-01). Keychain Sharing
  is enabled the same way on the first build with `-allowProvisioningUpdates`.
- `cap sync` generates the `CapApp-SPM/Package.swift` dependency and the
  `packageClassList` entry from the new package; no manual step.

**Device build for verification.** The iPad's old reIS 1.0 could not be removed on
2026-08-26 (ScreenZen forbids app removal). If that still holds, the test build goes
on as `PRODUCT_BUNDLE_IDENTIFIER=cz.reis.app.eduroam`, an **explicit** App ID that
`-allowProvisioningUpdates` registers — a wildcard profile cannot carry these
entitlements, so the trick used for `cz.reis.app.demo` does not transfer. If 1.0 is
gone, the build goes on as `cz.reis.app`. The plugin code is identical either way.

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'id=<xcodebuild-udid>' -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=RG38V3SV8X CODE_SIGN_STYLE=Automatic build
```

## 7. Sheet and copy

The sheet already collapses to two numbered rows on the native path and never
renders a QR there (`EduroamSheet.tsx`). Layout untouched. Changes:

- `detectTarget()`: on the Capacitor host, `Capacitor.getPlatform()` → `'ios' | 'android'`;
  the UA guess remains only for the browser. Closes #212's root cause and the
  Macintosh-WKWebView fall-through.
- `eduroam.native.working`: "Opening Android setup…" → "Opening Wi-Fi setup…" /
  "Otevírám nastavení Wi-Fi…".
- `eduroam.native.privacyNote`: "…reIS hands it straight to Android." →
  "…reIS hands it straight to the system." / "…reIS ho předá rovnou systému."
- `eduroam.native.already` stays; on iOS it is reached via `alreadyAssociated`, so
  "already set up on this phone" is true when shown.
- **One new key, iOS only: `eduroam.native.iosLifetime`** — "eduroam stays set up as
  long as reIS is installed." / "eduroam zůstane nastavený, dokud máte reIS
  nainstalovaný." Rendered under the privacy note when `Capacitor.getPlatform()` is
  `'ios'`. This is the one place the sheet branches on OS, and it is there because the
  trade-off in §7.1 is real and students should hear it from us.
- The `pending` rejection surfaces through the existing `eduroam.native.error` prefix
  like any other rejection.

### 7.1 The uninstall trade-off, decided

A configuration added through `NEHotspotConfigurationManager` auto-joins **only while
the installing app remains on the device, and is removed when the app is deleted**.
That is Apple's stated behaviour (DTS engineer, Developer Forums thread 719422) and
it is why geteduroam's iOS app stays installed after setup.

It is a real difference from the other two paths: Android's `ACTION_WIFI_ADD_NETWORKS`
produces a user-owned saved network that survives uninstalling reIS, and an iOS
`.mobileconfig` profile is installed by Settings and outlives the app too. iOS native
buys one tap at the price of "eduroam lives as long as reIS does".

**Decision (2026-09-01): accept it and disclose it** with the `iosLifetime` line above.
Considered and rejected: shipping issue 212's local `.mobileconfig` delivery as an
opt-in "install as a profile instead" for permanence (doubles the iOS surface and
reopens 212's unverified loopback question), and dropping native on iOS altogether
(keeps Apple's six-to-eight step ceremony). A student who later deletes reIS can
redo eduroam through MENDELU's own guide; nothing is left broken, it is simply gone.

## 8. Testing and verification

**Unit tests, written before the implementation.**

- `src/mobile/__tests__/configureEduroam.test.ts` — the existing Android-shape tests
  stay; new: the four iOS outcomes pass through; an unknown outcome string, a missing
  `outcome`, null and an empty object all become `'failed'`; a null password still
  throws before the bridge is called.
- `src/hooks/data/__tests__/useEduroamSetup.test.ts` — the four Android native-path
  tests unchanged; one new test drives `run('ios')` with the iOS shape.
- `src/mobile/__tests__/eduroamNative.test.ts` (new) — `canConfigureEduroamNatively`
  is true for `'ios'` and `'android'` on the Capacitor host, false for both on the
  extension and web hosts, false for `'mac'`/`'windows'` everywhere.
- `src/components/mobile/sheets/__tests__/EduroamSheet.test.tsx` — `detectTarget`
  prefers `Capacitor.getPlatform()` on the Capacitor host, so a WKWebView reporting
  Macintosh still resolves to `ios`; the `iosLifetime` line renders on iOS and not on
  Android.
- Android: no change, so no new test.

**Swift has no unit-test target in the Capacitor project.** The plugin is proven the
way the Android one was: a device checklist, committed as
`docs/superpowers/specs/2026-09-01-eduroam-ios-verification-checklist.md` in the form
of the Android checklist, executed on campus and filled in with what was observed.

**iPad checklist, on campus, in order.**

1. The build with the committed entitlements compiles, signs, and installs (§6).
2. Settings shows the eduroam sheet; tapping **Set up eduroam** shows iOS's Join alert.
   **Cancel** → the info banner, no error banner, button offered again (`cancelled`).
3. Tap again, **Join** → the success banner (`saved`). Settings → Wi-Fi lists eduroam
   and the iPad associates within about a minute. **This answers the self-signed-root
   question** and the association question in one step.
4. Tap a third time while connected → `already-configured`; one eduroam entry in
   Settings, not two.
5. Delete the app → eduroam disappears from known networks, confirming the §7.1
   behaviour on this OS version, and the keychain group is empty. Reinstall and
   re-run once to confirm the `clean` stage handles an empty group.
6. Zero `report_error_v2` rows from the session.

If step 3 fails with `invalidEAPSettings` (4) after Join, the two suspects, in order,
are a persistent reference having been requested, and the keychain access group
missing from the profile (`errSecMissingEntitlement` at the `keychain` stage would
already have said so). If it fails with a join failure after a successful `apply`,
the root or server name is the suspect; the `.mobileconfig` pins the same two and
works, so compare against it.

## 9. What this closes, and what stays open

- **#159 iOS half** — closed by this design plus the campus checklist.
- **#212** — closed as superseded, with a comment recording that the entitlement gate
  measured on 2026-08-10 no longer exists and why.
- **#191** — its iOS gate lifts once this merges; the card is still its own design.
- **Certificate expiry** — unchanged: no config-side mechanism needed (re-run
  replaces), and the prompt is a separate design because renewal is an IS write.

## References

- `NEHotspotConfigurationManager.h`, iOS 26 SDK — `setIdentity` / `setTrustedServerCertificates`
  keychain-group requirement, `lifeTimeInDays` not applying to enterprise, error codes.
- `github.com/geteduroam/apple-app`, `GeteduroamPackage/Sources/EAPConfigurator/EAPConfigurator.swift`
  — the keychain recipe, the no-persistent-ref rule, the iOS 15.0/15.1 workaround.
- Apple Developer Forums thread 688323 — `invalidEAPSettings` on iOS 15.0/15.1.
- Apple Developer Forums thread 719422 — DTS statement that an app's hotspot
  configuration is removed when the app is deleted (§7.1).
- `native/capacitor-secure-store/README.md` — why iOS plugins must be packages.
- `docs/superpowers/specs/2026-07-27-capacitor-spike-findings.md` — the Android
  evidence this design mirrors.
