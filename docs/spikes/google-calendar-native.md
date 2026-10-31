# Spike: Google Calendar inside the reIS phone app

Status: **in progress.** Source-reading and desk research are done (marked *read*). Device evidence is
marked **PENDING** and is filled in as it is measured. Nothing here is for merging.

Branch `spike/google-calendar-native` (from `origin/test`). Harness: `VITE_GOOGLE_SPIKE=1` mounts a bare
page of buttons (`src/spike/`), nothing else in the app changes.

## Recommendation

**PENDING device evidence.** Leading hypothesis: native Google sign-in through a thin `native/` plugin, because
the two off-the-shelf options have specific problems (Q1). It becomes a "no" if either platform cannot refresh
silently (Q3).

## 1. Plugin choice

Candidates checked by reading source (*read*, not run on a device):

- `@capgo/capacitor-social-login` 8.7.5, Capacitor >=8, maintained (modified 2026-10-21).
  - **iOS:** uses GoogleSignIn-iOS. `login()` takes `restorePreviousSignIn` whenever a previous sign-in exists
    and `forcePrompt` is unset, and that path never requests `additionalScopes`. A returning user can get a
    token without Calendar. This matches the reported iOS scope bug.
  - **iOS:** `Package.swift` always depends on `facebook-ios-sdk`. Its `facebook: false` stub is documented for
    Android only. Whether it is dropped on iOS is unverified.
  - **Android:** `refresh()` goes through Credential Manager (`GetGoogleIdOption`, autoSelect), which may show
    UI, and then the Authorization API. Scopes require changing `MainActivity`. Access token and scopes are
    persisted in plain SharedPreferences.
- `@belongnet/capacitor-google-auth`: not on npm (404). `@codetrix-studio/capacitor-google-auth`: Capacitor 6 only.
- **Chosen for the proof:** `native/capacitor-google-calendar` (iOS: GoogleSignIn-iOS only) plus
  `GoogleCalendarAuthPlugin.java` (Android: `AuthorizationClient.authorize()` only, no Credential Manager, no
  server client ID, no `serverAuthCode`). About 120 lines of Swift and 110 of Java.
- iOS must be a `native/` package (see `native/capacitor-secure-store/README.md`). `nativePluginsAreReachable`
  passes with it.

## 2. iOS scope consent

**PENDING.** Evidence line will be the harness `tokeninfo` output (`scope`, `expires_in`) after `connect`, with
a calendarList and an events call returning 200. The proof's `connect` never uses the restore path.

## 3. Refresh without UI or backend

**PENDING.** Harness button "2 Silent token" is called (a) after the 1 h expiry, (b) after killing and
relaunching the app. iOS relies on the SDK's Keychain-held refresh token (`refreshTokensIfNeeded`). Android relies
on `authorize()` returning a token without a resolution once consent exists, and the proof rejects with
`NEEDS_CONSENT` rather than showing UI. No `serverAuthCode` is requested on either platform.

## 4. Cost per platform

- OAuth clients already in `reis-479320` (created 8 Oct): `reIS iOS` (bundle `cz.reis.app`), `reIS Android (Play App Signing)`,
  `reIS Android (upload key / sideload)`. Spike added `SPIKE Android debug (gspike)`: iOS client (bundle `cz.reis.app`); one Android client per package + SHA-1 (debug, upload key,
  Play App Signing key). No Web client is needed in this design. **PENDING:** confirm on device.
- iOS: `CFBundleURLTypes` entry with the reversed client ID in `Info.plist`; one SPM dependency
  (GoogleSignIn-iOS >=9). No `AppDelegate` change was needed to compile; **PENDING:** whether the callback needs one.
- Android: `play-services-auth:21.4.0` in `app/build.gradle`; one `registerPlugin` line in `MainActivity`. No
  `onActivityResult` override (the plugin registers its own `StartIntentSenderForResult` launcher in `load()`).
- **Size, measured** (debug builds, unminified, so an upper bound; same web bundle in both):
  Android APK 11,913,963 B without the plugin, 12,539,128 B with it, **+625 KB (+5.2%)**.
  iOS `App.app` 15,176 KB without, 17,632 KB with, **+2.4 MB**, of which `App.debug.dylib` is +1.96 MB. The built `.app`
  has only `Capacitor` and `Cordova` frameworks (GoogleSignIn, AppAuth, GTMAppAuth, GTMSessionFetcher and Promises are
  statically linked), and no Facebook SDK. Release/archive sizes were not measured.

## 5. Privacy fallout

- **iOS manifest, read from the resolved packages:** GoogleSignIn-iOS ships a `PrivacyInfo.xcprivacy` that declares eight
  collected data types, all *linked to the user*, purpose App Functionality, tracking false: Name, EmailAddress,
  PhoneNumber, OtherDataTypes, CoarseLocation, UserID, DeviceID, OtherUsageData; plus UserDefaults API access (reason
  CA92.1). AppAuth's manifest is empty. So adopting the SDK will probably put those types on the reIS App Store label,
  where today the label lists only the three flows in `privacy/disclosures.ts`. Not yet confirmed with Xcode's Generate
  Privacy Report on an archive.
- **Android:** the Authorization API is part of Play Services; no manifest of its own. The plugin requests no ID token and
  no email, only the Calendar scope, and calendar data goes Google -> device, never to a reIS server, so a new Data safety
  entry is not expected. This is a reading of Play's definition of "collected", not confirmed with a Play review.
- Capgo would add the Facebook SDK on iOS (its `Package.swift` depends on it unconditionally), which a privacy-first app
  should not ship. That is one more reason the custom package is the better fit.
- reIS's rule holds with this design: no reIS backend, tokens stay in Google's SDK storage (iOS Keychain), calendar data
  goes only to and from Google. `noStudentDataLeaves` must be re-run after the plugin lands.

## 6. Verification status

- Consent screen can stay External/Testing with a test user for the spike. Refresh tokens issued in Testing
  expire after **7 days** (Google OAuth docs, "Refresh token expiration").
- Google's sensitive-scope verification page says review "can take up to 10 days". It requires brand verification,
  a verified authorized domain, a public home page, a privacy policy on the same domain, a justification per
  scope with why a narrower scope will not do, and an unlisted YouTube demo video showing the consent flow.
- Sensitivity tier, read from the Cloud console's Data access page (project `reis-479320`, 2026-10-31):
  **sensitive:** `calendar.readonly`, `calendar.events.readonly`, `calendar.events.owned.readonly`.
  **non-sensitive:** `calendar.calendarlist.readonly`, `calendar.app.created`. **None is restricted.**
  So reading events needs a sensitive scope whichever one is picked, and verification cannot be avoided. The
  narrowest event read, `events.owned.readonly`, would miss subscribed calendars (e.g. a school timetable).
- Account limit worth knowing: 100 refresh tokens per Google Account per client ID.

## 7. Fallback: the OS calendar

- `@capacitor/calendar` 1.0.1 (official, Capacitor >=8) reads EventKit on iOS and CalendarContract on Android;
  `@ebarooni/capacitor-calendar` 8.10.0 is the community alternative.
- Expected asymmetry, **PENDING device check**: Android sees Google Calendar through the device account; iOS sees
  nothing unless the Google account was added in iOS Settings.

## Estimate for the real feature

**PENDING** until Q2 and Q3 have evidence.
