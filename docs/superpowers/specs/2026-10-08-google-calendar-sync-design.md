# Timetable → Google Calendar sync

Date: 2026-10-08. Scope: the **phone/iPad tree only** (iOS + Android apps). The
extension deliberately gets nothing; see "Trees".

Request: Návrhy #29 (iOS 5.3.0, 5 Oct), *"Jestli je možné přidat si rozvrh nějak do
kalendáře v telefonu"*.

## Decisions (Dominik, 2026-10-08)

| Question | Answer |
| --- | --- |
| Target | **Google Calendar**, via the Google Calendar API. Outlook/O365 is out ("nobody uses that"). |
| Rejected routes | A one-time **.ics** file, and writing to the **device calendar** (EventKit / CalendarContract): "nobody uses those". It must be **one-click sync**. |
| Updates | **Must happen in the background.** Timetable and exam changes happen during the year; sync-only-when-open is "useless". It also syncs immediately whenever reIS notices a change. |
| No IS session | No sync. That is expected (the IS session lasts 2–4 weeks on the phone). |
| Which tree | **Phone and iPad only.** No extension, no desktop. |
| Contents | Lessons, **exams** and **custom events**. |
| Calendar | reIS creates its own calendar, **"Rozvrh"**, in the student's Google account. |
| History | The first fill writes everything reIS has. After that, **events before today are never touched**, so past semesters and years stay in Google. |
| Placement | A row in the phone **profile sheet** (where the removed Outlook toggle was). |
| Multiple devices | Option A: also request `calendar.calendarlist.readonly`, so a second device finds the same "Rozvrh". |
| Google identity | **reis.mendelu@gmail.com** owns everything. Never a personal account. |

## Why not the other routes (kept so they aren't re-proposed)

- **reIS-hosted ICS subscription URL:** reIS never hosts or relays student data.
- **IS Mendelu's own feed:** IS has no iCal export. Its timetable page offers only HTML,
  a list view and PDF.
- **IS → Office 365 → published ICS → Google subscription:** IS does push lessons and
  exams to O365 server-side (`/auth/ca/konfigurace_prenosu_udalosti.pl`). But Outlook is
  out, and it isn't one click.
- **Extension sync:**
  - `getAuthToken` works only in Chrome.
  - Edge, Firefox and Brave need `launchWebAuthFlow`, which with no client secret gives an
    hour-long token and no refresh.
  - A secret means a relay server. That was the design of the Google Drive backup removed
    in `27dc1c326`.
- **Device calendar:** rejected by Dominik. Also, an Android calendar that an app
  *creates* is `ACCOUNT_TYPE_LOCAL` and never syncs to Google (verified in
  `@capacitor/calendar` 1.0.1, `Calendar.kt:210`).

## Facts verified on 2026-10-08

On the **Pixel 9a**: signed release build, the app's process killed with `am kill`, then
the work run from a background job. The spike code was reverted; nothing from it is
committed.

1. **One Android OAuth client is enough** (package `cz.reis.app` + SHA-1). There is no
   Web client and no client ID in code. Google matches the app by signature, and the
   consent screen showed "reIS".
2. **`AuthorizationClient.authorize()`** called with the **application context** in a new
   background process returns a token silently (`hasResolution=false`). Same pattern as
   goodtime and octi, which are open source.
3. **Use a plain `JobService`, not WorkManager.**
   - WorkManager ran the work in-process, outside the JobScheduler job. JobScheduler
     logged "app called jobFinished" within 50 ms.
   - About 5 s later the firewall moved the app from `background-allow` to
     `background-default`, and the request died with
     `SocketException: Software caused connection abort`.
   - A plain `JobService` with `NETWORK_TYPE_ANY` kept the network for the whole run.
4. **Phone settings defer the job:** Battery Saver, including the *adaptive* one Android
   turns on at low battery (`force_all_apps_standby`), and "Background data" off for reIS
   (`REJECT_METERED_BACKGROUND`). Nothing is lost; the job runs later.
5. **Calendar API under `calendar.app.created`:**
   - `calendars.insert` 200, `calendars.get` by id 200;
   - **`calendarList.list` 403**;
   - an event with a client-chosen `id`: 200; the same id again: 409;
   - the `privateExtendedProperty` filter works;
   - **a deleted event's id stays reserved:** re-insert gives 409, and `PUT` with
     `status: confirmed` brings it back (200).
6. **Scope classification**, read from the reIS project's Data access page:
   - **non-sensitive:** `calendar.app.created`, `calendar.calendarlist.readonly`,
     `drive.appdata`;
   - **sensitive:** `calendar.events`, `calendar.events.owned`, `calendar.calendars`,
     `calendar.calendars.readonly`.
   - With only non-sensitive scopes, the app needs no sensitive-scope review and has no
     100-user cap.
7. **iOS keychain:** GTMAppAuth 6.0, GoogleSignIn's token store, keeps tokens
   `AfterFirstUnlockThisDeviceOnly` "to allow background access".
8. **Timetable data is JSON** (`rozvrhy_view.pl?format=json`), so the background job needs
   no DOM. The exam parser does need `DOMParser`.
9. **`calendar.app.created` is scoped per *project*, not per OAuth client** (plan Task 1).
   - Two throwaway Desktop clients in reis-479320, one Google account, each with its own
     consent and token. Client B was granted `calendar.app.created` only.
   - Client A created a calendar and an event in it. Client B then got the calendar (200),
     listed its events (200), `PUT` an edit to A's event (200), inserted its own event
     (200) and deleted it (204). A deleted the calendar (204).
   - With `calendar.calendarlist.readonly` added, `calendarList.list?minAccessRole=owner`
     returned 200 and listed the app's calendar (the probe found and deleted an orphan from
     a failed first run that way), so a second device can find "Rozvrh".
   - So the iOS client, the Play-signing client and the upload-key client share one
     "Rozvrh". No sensitive scope and no per-device calendar are needed.

**Still unverified, so the plan does these next, in this order:**
- GoogleSignIn on iOS in a `BGAppRefreshTask`;
- how often iOS actually runs that task;
- whether GoogleSignIn works in the Mac ("Designed for iPad") build.

## Architecture

```
            ┌─────────── phone / iPad app ───────────┐
 IS Mendelu │ normal sync (TS) ──► reconcile (TS) ───┼──► www.googleapis.com
 (UISAuth)  │                                        │    calendar v3
            │ background job (Swift / Java) ─────────┼──►  (lessons only)
            └────────────────────────────────────────┘
   no reIS server anywhere in this path
```

### Sign-in: native, with no secret and no refresh token in reIS code

- **iOS:** a fourth plugin, `native/capacitor-google-calendar`, built like the other
  three. It uses GoogleSignIn-iOS 10.x and an **iOS** OAuth client.
  - **Info.plist:** `GIDClientID`, the reversed-client-ID URL scheme,
    `UIBackgroundModes: fetch`, and `BGTaskSchedulerPermittedIdentifiers:
    cz.reis.app.calendar-sync`.
- **Android:** `GoogleCalendarPlugin.java` and `CalendarSyncJobService.java` in
  `android/app/src/main/java/cz/reis/app/`, in Java like `EduroamPlugin`.
  - It uses `play-services-auth` `AuthorizationClient`. Credential Manager isn't needed,
    because this is not a Google login.
  - Phones without Play Services don't get the row.
- **Plugin API:**

  | Method | What it does |
  | --- | --- |
  | `connect()` | Consent, the first time only |
  | `accessToken()` | Fresh token, silently |
  | `disconnect()` | Revokes at Google |
  | `status()` | Connected or not, and the account |
  | `configure({ enabled, calendarId, studentId, language })` | Writes what the background job reads into native preferences. Non-secret only. |

- **Scopes:** `calendar.app.created`, `calendar.calendarlist.readonly`, and `email`.
  GoogleSignIn-iOS also always requests `openid` and `profile`; both are non-sensitive.
  - `email` is a Sign-in scope, which Google pre-fills as non-sensitive. Confirm it on the Data access page anyway.
  - It exists only so the row can say which Google account is connected; `AuthorizationClient` won't return the address without it. The address stays on the device. If Dominik prefers a shorter consent screen, drop it together with the account line in the UI.
  - Nothing else.
- **The background job reads the IS token** from the store the app already uses (keychain
  key `reis.session.uisAuth` on iOS, `SecureStorePlugin` Keystore on Android). It is
  never copied.

### Triggers

- **Foreground (TypeScript):** after any normal sync (open, resume, pull-to-refresh,
  exam registration), **if** lessons, exams or custom events changed. Also once, in
  full, when the toggle turns on.
- **Background, lessons only:**
  - Android: a periodic `JobService` (every ~6 h, `NETWORK_TYPE_ANY`, persisted across
    reboots, using the existing `RECEIVE_BOOT_COMPLETED`).
  - iOS: `BGAppRefreshTask`, every ~6 h at the earliest; the OS decides.
- **A per-device lock** (timestamped, in native preferences) keeps the foreground sync
  and the background job from running at the same time.
- **Never runs** without an IS session, without a network, or with the toggle off.

### Calendar

- **On connect:** list the student's calendars and reuse the one whose description
  contains the marker `reis:rozvrh:v1` (accessRole owner). Otherwise create "Rozvrh" in
  `Europe/Prague` with that marker.
- **Store** its id locally (platform storage plus native preferences).
- **Every sync** first calls `calendars.get`. A **404** means the student deleted it:
  switch the sync off and don't recreate it.

### Events

| Kind | Title | Location | Description | Reminders | Colour |
| --- | --- | --- | --- | --- | --- |
| lesson | `{subject} – {type}` (e.g. "Ekonomie I – přednáška") | room | teacher, group, "reIS" | none (`useDefault: false`) | calendar default |
| exam | `Zkouška: {subject}` | room | term type, registration | calendar defaults | distinct `colorId` |
| custom | its own title | its own | its own note | none | calendar default |

- **Times:** `dateTime` plus `timeZone: "Europe/Prague"`.
- **Language:** whatever reIS is set to at the time of the sync.
- **Event id:** `kindPrefix + base32hex(sha256(stableKey))`, lowercased, using only
  Google's `[a-v0-9]` alphabet.

  | Kind | Prefix | Stable key |
  | --- | --- | --- |
  | lesson | `l` | `id + date + startTime` (`src/types/schedule.ts`) |
  | exam | `e` | the exam term's id |
  | custom | `c` | the custom event's id |

- **`extendedProperties.private`:**
  - `reisKind`: lesson, exam or custom;
  - `reisHash`: a hash of the event body, so an unchanged event is skipped;
  - `reisV`: the mapping version.

### Reconcile

This is a pure planner. Inputs: the events that should exist, the events that do exist,
`todayStart` (00:00 Prague) and the reIS data window. Output: a plan.

1. **Past events are written only when reIS *creates* the calendar.** That first fill inserts everything reIS has, past included.
   - A device that *finds and reuses* an existing "Rozvrh" (a second device, or after a reinstall) does **not** do a past fill. It behaves like any later sync. Otherwise the 409 → `PUT confirmed` rule would bring back past events the student deleted, and a language change would rewrite past titles.
2. **Every other sync** considers only events starting **≥ todayStart**. Events before it are
   never updated, deleted or re-created.
3. **Insert** what's missing. On **409**, `PUT` with `status: confirmed`.
4. **Update** (`PUT`) when `reisHash` differs.
5. **Delete** what shouldn't exist, only within [todayStart, end of window], and only
   for the kinds this run owns. The background job owns lessons only.

**Delete safeguards.** IS returns identical bytes for "no lessons" and a failed query
(see the memory note on IS empty schedules), so:

- never delete based on a fetch that wasn't confirmed successful (exams: the subject list
  read successfully and is non-empty);
- **lessons only:** an empty lesson list is "no information", so delete nothing;
- **lessons only:** a plan deleting more than ⅓ of future lessons is held back, and runs
  only if the next sync produces the same plan.

Exams and custom events may legitimately go empty: a student deregistering from their last
exam must disappear from Google. (Revised in planning, 2026-10-08.)

**Transport:**
- **TypeScript** sends paced single requests at 5/s.
  - Revised in planning, 2026-10-08: Google's batch guide says "A set of n requests batched
    together counts toward your usage limit as n requests", and the project's limit is 600
    queries per minute per user, so batching saved nothing that mattered.
  - The ~500-event first fill takes about 100 s, shows "Synchronizuji 120/480", and is
    **resumable**: `pastFillPending` is persisted right after the calendar is created.
- **Native** sends small diffs one at a time, within iOS's ~30 s budget.

**Errors:**
- 401: refresh the token once.
- 403/429 rate limit: exponential backoff.
- Network failure: the next trigger retries.
- Everything is logged through `logError` (`GoogleCalendar.*` contexts).

### Three implementations of the lesson mapping

TypeScript, Swift and Kotlin each map lessons. They **must** produce byte-identical
bodies, ids and hashes, or devices would keep overwriting each other's events. One JSON
fixture file (lessons in → expected body, id and hash out) is asserted by Vitest, a
Kotlin JUnit test and a Swift XCTest.

## UI (phone and iPad, profile sheet)

**Off.** "Synchronizovat s Google Kalendářem". A tap opens Google's own sheet.

**On.** "Rozvrh · synchronizováno 14:02", the Google account, and "Otevřít v Google
Kalendáři". The first fill shows progress.

**Turning it off** offers two choices:
- "Vypnout a smazat kalendář Rozvrh" (off, and delete the Rozvrh calendar);
- "Jen vypnout" (off only, keep the calendar).

Both revoke the grant.

**Messages:**
- Revoked at Google: "Přístup ke Google Kalendáři byl odebrán", and the row turns off.
- Calendar deleted in Google: the row turns off.
- Lapsed IS session: the existing re-login prompt.

**Text and checks:** strings in `src/i18n/locales/{cs,en}.json`; DaisyUI classes only;
checked with `verify-ui`.

## Trees

- **Phone/iPad:** all of the above. The code lives in `src/mobile/googleCalendar/` and the
  native code. Shared code does not import it; the #266 content-script crash came from
  exactly that.
- **Extension:** nothing. `src/test/guards/desktopHasNoGoogleCalendar.test.ts` records
  why, naming the files, after the `desktopHasNoShowOnMap.test.ts` pattern:
  - `getAuthToken` is Chrome-only;
  - `launchWebAuthFlow` without a secret gives no refresh, so no background sync;
  - the phone already keeps the student's Google calendar current.

## Privacy and stores

**What leaves the device:** lesson, exam and custom-event titles, times, rooms, teachers
and notes, sent **directly from the phone to the student's own Google account**. reIS
also reads the *list* of the student's calendars, only to find "Rozvrh". Nothing reaches
a reIS server.

**In the same PR:**
- **`privacy/disclosures.ts`:**
  - new flow `google_calendar_sync`, `when: 'background'` (Apple: ongoing after one
    permission must be disclosed);
  - `Flow` gains a third-party variant (host `www.googleapis.com`, plus the native files),
    because today it assumes Supabase `files`/`calls`;
  - `PLATFORM_PERMISSIONS` should stay unchanged: no new iOS usage key, and Android's
    `RECEIVE_BOOT_COMPLETED` is already listed. But `privacy:check` reads the
    **merged** release manifest, and `play-services-auth` may merge in permissions such
    as `ACCESS_NETWORK_STATE`. After adding the dependency, inspect the merged
    manifest and update `PLATFORM_PERMISSIONS` if it changed.
- **`noStudentDataLeaves.test.ts`:** `googleapis.com` under "carrying student data", and
  `accounts.google.com` for sign-in.
- **Policies:** `docs/privacy-policy-app.md` (published as the gist) and `PRIVACY.md` get
  a row: "only if you turn it on…". They also need Google API Services User Data Policy
  wording: what reIS accesses, that the data goes only to the student's own calendar, and
  that it isn't used for anything else.

**At release** (Claude does the store forms, as pre-approved):
- **Play Data safety:** *Calendar events* **collected**, optional, App functionality, not
  shared. Play counts any transmission off the device from the app, even to a third
  party; the user-initiated exemption covers "sharing" only.
- **Apple App Privacy:** *Other User Content*, App Functionality, not tracking. That's
  conservative: Apple's "third-party partners" includes SDKs in the app, and GoogleSignIn
  is one.
- **Apple 4.8** (Sign in with Apple) does not apply: Google is not the reIS login.

## Google project

The project is `reis-479320` ("reIS"), owner **reis.mendelu@gmail.com**.

**Done 2026-10-08:**
- Calendar API enabled.
- Android client "reIS Android (upload key / sideload)" for `cz.reis.app` +
  `E0:31:19:1C:68:77:66:51:11:2E:DD:70:7E:F7:6C:34:B5:E5:9C:0C`.
- Support email, developer contact and test user are reis.mendelu.
- The personal account that had created the project removed from IAM and test users.
- Old unused Chrome-extension client deleted.

**To do:**
1. **Data access:** save the scopes listed under "Sign-in".
2. **Clients:** an iOS client (bundle `cz.reis.app`), and an Android client for the
   **Play App Signing** SHA-1 (from the Play Console).
3. **Branding.** Without brand verification the consent screen shows only the domain,
   not "reIS". Verification needs homepage, privacy-policy and terms links on a domain
   verified in Search Console, and a gist can't qualify. So:
   - a **`reis-page` PR** adds privacy and terms pages on **reis-navod.cz**;
   - verify the domain;
   - logo;
   - replace the stale `chromiumapp.org` authorised domain with `reis-navod.cz`;
   - "Verify branding": automated, or 2–3 business days.
4. **Publish** (Testing → In production).

## Testing

- **Unit, written first:**
  - mapping, including the summer-time change;
  - id stability, alphabet, and no collisions between kinds;
  - the planner: past events frozen, the 409 → `PUT` rule, the three delete safeguards;
  - batch build and parse;
  - error handling (401 / 404-calendar / 429) against a fake `fetch`.
- **Shared fixtures** in Vitest, JUnit and XCTest, as above.
- **Guards:** the new desktop guard, plus `noStudentDataLeaves`, privacy disclosures and
  the content-script graph.
- **Devices** (release builds, signed in as reis.mendelu):
  - **Pixel:** first-fill count matches reIS; kill the app, then
    `cmd jobscheduler run -f`; a deleted future event returns and a deleted past event
    doesn't; Battery Saver and Background-data-off defer the job, then it catches up.
  - **Cabled iPad:** first fill; the BG task fired from the Xcode debugger; check the
    Mac build.
  - **Pixel and iPad on one Google account:** one "Rozvrh", no duplicates.
- **UI:** `verify-ui` at 320/390/430 and tablet width, both themes, with before/after
  screenshots to Dominik.
