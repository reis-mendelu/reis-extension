# @reis/capacitor-eduroam

iOS half of the native eduroam Wi-Fi setup. Consumed by `src/mobile/eduroamNative.ts`
via `registerPlugin('Eduroam')`; the Android half of the same JS contract is
`android/app/src/main/java/cz/reis/app/EduroamPlugin.java`.

Local package, never published — `package.json` has `"private": true` and the app depends on
it as `file:native/capacitor-eduroam`. It is a package and not an app-target file for the
reason measured in `native/capacitor-secure-store/README.md`: Capacitor 8 registers iOS
plugins only from `packageClassList`, which `cap sync` builds from installed plugin packages.

## Contract

`configure({ p12Base64, caDerBase64, passphrase })` resolves
`{ outcome: 'saved' | 'already-configured' | 'cancelled' | 'failed', detail?: string }`
or rejects with `FAILED at stage=<decode|keystore|ca|keychain|eapSettings|apply|platform>: …`.
The Android half resolves raw intent codes instead; `normalizeOutcome` in
`src/mobile/configureEduroam.ts` accepts both.

## Requirements the app must meet

- Entitlements (`ios/App/App/App.entitlements`): `com.apple.developer.networking.HotspotConfiguration`
  and `keychain-access-groups` containing `$(AppIdentifierPrefix)com.apple.networkextensionsharing`.
  Without the group, `SecItemAdd` fails with `-34018` (errSecMissingEntitlement).
- `Info.plist` key `AppIdentifierPrefix` = `$(AppIdentifierPrefix)`, which is how the plugin learns
  the team prefix for the access group without a hard-coded team ID.
- iOS 15.2+. On 15.0/15.1 the plugin rejects (platform bug with pinned server certificates).

## Behaviour worth knowing

- A network added through `NEHotspotConfigurationManager` is removed when the app is deleted.
  The sheet tells iOS students so (`eduroam.native.iosLifetime`).
- Re-running deletes the previous reIS keychain items first, so a renewed certificate
  replaces the old one in place.
- Design: `docs/superpowers/specs/2026-09-01-eduroam-ios-native-design.md`.
