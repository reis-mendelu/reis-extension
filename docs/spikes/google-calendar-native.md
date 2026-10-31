# Spike: Google Calendar inside the reIS phone app

Status: **in progress.** Source-reading and desk research are done (marked *read*). Device evidence is
marked **PENDING** and is filled in as it is measured. Nothing here is for merging.

Branch `spike/google-calendar-native` (from `origin/test`). Harness: `VITE_GOOGLE_SPIKE=1` mounts a bare
page of buttons (`src/spike/`), nothing else in the app changes.

## Recommendation

**PENDING the two after-expiry checks.** Leading call: **go with native Google sign-in** through the thin plugin.
Reasons: it works on both platforms with no reIS backend; iOS shows nothing through EventKit for a student who only uses
the Google Calendar app (so the OS route cannot be the main path); Capgo has the iOS scope and Facebook SDK problems.
It becomes a "no" only if a token cannot be refreshed silently after expiry on one platform.

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

**Verified on a physical iPad 8 (iPadOS 26), 2026-10-31.** `connect` with `calendar.readonly` showed Google's account
picker and consent screen. Log lines are in the app's `Documents/spike-log.txt`, pulled with `devicectl`:

- `grantedScopes`: `calendar.readonly`, `userinfo.email`, `userinfo.profile`, `openid`.
- `GET oauth2.googleapis.com/tokeninfo`: 200, `scope` = `email profile .../auth/calendar.readonly ... openid`,
  `expires_in` 3599, `azp` = the iOS client `576873601004-j691...`.
- `GET calendar/v3/users/me/calendarList`: 200, 5+ calendars returned (owner role).
- `GET calendar/v3/calendars/primary/events?singleEvents=true&timeMin..&timeMax..`: 200, returned the account's
  "reIS - release test" event on 6 Nov.
- Before connecting, the same three calls returned 400/401 and the silent path said `not connected`, so the
  plugin and registration work and the 200s are not a cache.

The iOS trap (extra scope silently skipped) did not occur because `connect` never uses `restorePreviousSignIn`.
No `AppDelegate` URL handling was needed: the sign-in returned through the SDK's own web authentication session.

## 3. Refresh without UI or backend

- **iOS, cold relaunch: verified.** Kill + relaunch restored the session in 25 ms (first launch after connect) and 72 ms
  (after a full reinstall of the app), no UI, same account, token reused while still valid. The session lives in the
  iOS Keychain, held by GoogleSignIn-iOS. No `serverAuthCode`, no reIS server.
- **iOS, after expiry:** **PENDING** (token issued 13:59:41 UTC expires 14:59:40 UTC; a scripted relaunch runs after that).
- **Android, connect + relaunch: verified on a Pixel 9a (package `cz.reis.app.gspike`, debug build).** Before connecting,
  `getAccessToken` rejected with `NEEDS_CONSENT` (the no-UI guarantee: it never shows a sheet by itself). After `connect`
  and choosing a test-user account: `tokeninfo` 200 with `calendar.readonly` granted, `expires_in` 3598, `azp` = the
  Android client `576873601004-b5u6j3g...`, calendarList 200, events 200. `force-stop` + relaunch: the silent call
  returned in 165 ms with no UI, same token still valid. `tokeninfo` says `access_type: online`: the app holds no refresh
  token, Google Play services holds the consent.
- **Caveat on consent:** no separate consent screen was seen on Android. The same Google account had consented to this
  project's iOS client minutes earlier, which probably let Google skip it. A first-ever Android consent was not observed.
- **After expiry:** iOS and Android results below (**PENDING** until the scripted relaunches finish).

## 4. Cost per platform

- OAuth clients already in `reis-479320` (created 8 Oct): `reIS iOS` (bundle `cz.reis.app`), `reIS Android (Play App Signing)`,
  `reIS Android (upload key / sideload)`. Spike added `SPIKE Android debug (gspike)`: iOS client (bundle `cz.reis.app`); one Android client per package + SHA-1 (debug, upload key,
  Play App Signing key). No Web client / server client ID is needed: Android connected with only the package + SHA-1 client, and iOS with only the iOS client (verified on both devices). Each build flavour needs its own Android client (debug, upload key, Play App Signing key); the project already has the last two.
- iOS: `CFBundleURLTypes` entry with the reversed client ID in `Info.plist`; one SPM dependency
  (GoogleSignIn-iOS >=9). No `AppDelegate`/`SceneDelegate` change was needed: sign-in completed on the iPad without one.
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
- **iOS, verified on the iPad 8:** after granting calendar access (iOS 17+ asks for *full* calendar access, a heavy
  prompt), EventKit listed only `Home`, `Work`, `Österreichische Feiertage` and `Birthdays`. The Google event
  "reIS - release test" (6 Nov, returned by the Calendar API a minute earlier for the same person) was **not** visible,
  because that Google account is not added in iOS Settings. A student who only uses the Google Calendar app sees nothing.
- **Android, verified on the Pixel 9a:** after the plain "Allow reIS to access your calendar?" read prompt,
  CalendarContract listed ~25 calendars, including every Google calendar of the accounts added in Android Settings
  (`Ideal Week`, `Exercise`, `Personal`, `Work`, ...) next to holiday calendars. So the OS route works on Android and not on iOS.

## Estimate for the real feature

About **7 to 10 working days** for one developer, plus Google's verification wait (up to 10 days per Google, run in parallel).

| Piece | Work |
|---|---|
| Plugin hardening | Real error codes, `disconnect` (iOS `GIDSignIn.disconnect`; Android revoke via the Authorization API), pin the account on Android, tests for the JS wrapper. 1 to 1.5 d |
| Slice + storage | `createGoogleCalendarSlice`, an IndexedDB store for events, chosen calendar ids. 1 d |
| Sync service | `events.list` per chosen calendar with `singleEvents=true`, a window of about -1 / +3 months, paging, cancelled events, timezone handling, 401 means reconnect. 2 d |
| Rendering | Map to the lesson shape like `customEventToLesson`, read-only and visually distinct, merged into `CalendarScreen` (phone) and `useCalendarData` (tablet/desktop width) after the hidden-items filter. **All-day events** need a banner row (the lesson shape has start and end times only). 2 d |
| Settings UI | Connect, calendar picker from `calendarList`, disconnect, CZ and EN strings. 1 d |
| Disclosures + guards | `privacy/disclosures.ts`, `PRIVACY.md`, the policy docs, the App Store label (the SDK's eight types), Play Data safety, and `www.googleapis.com` in `noStudentDataLeaves` (the guard fails on it today). 1 d |
| Parity guard | A test in `src/test/guards/` that the extension bundle contains no Google Calendar code. 0.5 d |
| Verification (parallel) | Brand verification, a verified domain with the privacy policy on it (today the policy is a gist, which does not qualify), a demo video, a per-scope justification. Until verified: 100 users in total, and refresh tokens last 7 days in Testing. |

Biggest risks: verification of a sensitive scope (no restricted scope is needed), and the policy needing a verified domain.
