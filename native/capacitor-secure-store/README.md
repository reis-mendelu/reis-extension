# @reis/capacitor-secure-store

iOS Keychain storage for the IS session token. Consumed by `src/platform/secureStore.ts`
via `registerPlugin('SecureStore')`; the Android half of the same JS contract is
`android/app/src/main/java/cz/reis/app/SecureStorePlugin.java`.

Local package, never published — `package.json` has `"private": true` and the app depends on
it as `file:native/capacitor-secure-store`.

## Why this is a package and not a file in the app target

**Because on iOS an app-local Capacitor plugin cannot be reached from JS at all.** This was
established by measurement, not doctrine, and each step below was verified on a simulator:

1. Writing `ios/App/App/SecureStorePlugin.swift` with `@objc(SecureStorePlugin)` and
   `CAPBridgedPlugin` compiles, and the symbols land in the binary — but every call rejects
   with `"SecureStore" plugin is not implemented on ios`. Capacitor 8 does **not** scan the
   ObjC runtime for plugin classes.
2. `bridge?.registerPluginType(...)` from `capacitorDidLoad()` in a `CAPBridgeViewController`
   subclass does not fix it. It populates the *native* registry but emits no JSExport user
   script: the `WKUserContentController` script count was unchanged (13 → 13) and no script
   mentioned `SecureStore`. The JS side resolves plugins against `window.Capacitor.PluginHeaders`
   (see `registerPlugin` in `@capacitor/core`) and throws **without ever calling native** when
   the name is absent, so a perfectly working plugin looks unimplemented.
3. What actually registers a plugin is `packageClassList` in `ios/App/App/capacitor.config.json`.
   Adding `SecureStorePlugin` there made the round-trip work first try (script count 13 → 14,
   `secureStoreInScripts=YES`).
4. That file is **gitignored and rewritten by `cap sync`**, and the CLI builds the list *only*
   from installed plugin packages — `getPluginFiles` walks each dependency's `capacitor.ios.src`
   directory and `findPluginClasses` regexes `@objc\(([A-Za-z0-9_-]+)\)` out of the Swift it
   finds there (`node_modules/@capacitor/cli/dist/util/iosplugin.js`). An app-target file is
   never scanned, so a hand-patched entry survives exactly until the next sync.

Hence: a package. `cap sync` then generates both the `CapApp-SPM/Package.swift` dependency and
the `packageClassList` entry, and a fresh clone works with no manual step.

**Two consequences worth carrying forward:**

- The `Downloads` and `Eduroam` plugins are app-local Java today. That is fine on Android —
  `MainActivity.registerPlugin()` runs before the bridge initialises — but their iOS halves
  will need this same packaging. Do not start them as files in the app target.
- The failure mode is an unbreakable **login loop**, not an error: `saveStoredToken` rejects,
  no token persists, and `loadStoredToken` throws `sessionExpired` on the next launch. If iOS
  ever starts asking for a sign-in every cold start, check plugin registration before
  suspecting the login code.

## Layout

Copied from `@capacitor/preferences`, the closest sibling:

```
package.json                                  capacitor.ios.src = "ios"
Package.swift                                 target SecureStorePlugin
ios/Sources/SecureStorePlugin/SecureStorePlugin.swift
```

There is no `dist/` and no JS entry point on purpose — the JS side lives in the app
(`src/platform/secureStore.ts`), so this package carries native code only.
