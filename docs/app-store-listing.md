# App Store submission pack — reIS for iOS

The iOS counterpart to `play-store-listing.md`. Same rule: answered from what
the app actually does, verified against the code and against a real simulator
run, not from what the extension's older policy says.

Verified 2026-08-23 against version 5.0.6 (CFBundleVersion 50006), built for
`iPhone 17 Pro Max` (iOS 26.5) from `ios/App/App.xcodeproj`.

Anything marked **YOU** needs a human: an Apple form, a payment, a password,
or a decision only you can make.

---

## 1. The blocker: an App Review reviewer cannot get into the app

This is the finding that shapes everything else, so it goes first.

**Measured, not assumed.** A clean simulator install of 5.0.6 launches straight
into MENDELU's own UIS sign-in page in a WebView. `ensureSession`
(`src/mobile/ensureSession.ts:36`) reads the stored token, finds none, and
`boot()` awaits the resulting promise before it will hide the splash screen.
There is no guest mode, no read-only preview, no "look around first" path. No
MENDELU account, no app.

Two things follow from that, and they are not the same problem:

### 1.1 Apple requires working demo credentials — Guideline 2.1

App Store Connect has a mandatory **App Review Information → Sign-In Required**
section. For a login-gated app you must supply a username and password that the
reviewer can actually use. An app the reviewer cannot open is rejected under
Guideline 2.1 (App Completeness) essentially every time, and the rejection loop
costs days each round.

Three ways out, and they are genuinely different in cost and in risk:

| Option | What it costs | What it risks |
|---|---|---|
| **A. Hand Apple your own MENDELU login** | Nothing, today | Almost certainly breaches MENDELU's acceptable-use rules, and it hands an Apple reviewer your real grades, timetable and study record. Also fragile: a password change mid-review breaks the app for the reviewer. |
| **B. Ask MENDELU for a dedicated test UIS account** | An email and a wait, with no guarantee | Clean if granted. Out of our hands, and it is also the moment MENDELU learns reIS exists — which is either fine or is the §4 conversation arriving early. |
| **C. Build a demo mode into reIS** | Real engineering — see below | None externally. Fully in our control. |

**Recommended: C.** Not only because it is the safe one, but because it also
answers Play's "App access" declaration when we apply for production, and lets
a reviewer judge reIS without ever touching MENDELU's servers, which takes some
weight off §4.

It does **not** unblock screenshots — an earlier draft of this page claimed it
did, and that was wrong. `scripts/store-shots.mjs` already renders the app from
synthetic fixtures with no login at all, and the iOS sizes are captured. See
§3.

**How much work C actually is** — worth stating honestly rather than as "we
already have mocks":

- `MockManager` and `MOCK_REGISTRY` already exist (`src/utils/mock/`), already
  validate against `StoreSchemas`, and are already wired into `initializeStore`
  behind `VITE_USE_MOCK_DATA` (`src/store/useAppStore.ts:90`). Three datasets
  ship: `esn`, `ldf`, `supef`.
- But `SocietyDataset` covers only **exams, schedule, syllabuses and success
  rates**. Grades, study plan, documents and the person sheet have no fixtures.
- And the build-time flag is the wrong shape for this. A reviewer needs a demo
  they can enter from the login screen of the *shipping* build, not a separate
  binary. So the work is: a "Prohlédnout ukázku / Try the demo" affordance on
  the login gate that loads the mock dataset and marks the session as demo,
  plus fixtures for whatever screens the demo should show.

Scope it to the screens the screenshots need and the reviewer will look at:
calendar, exams, subject difficulty. A demo that covers three screens well is
worth more here than one that covers eight thinly.

### 1.2 Google will ask the same question for production

Play Console's **App content → App access** wants the same credentials before
production access is granted. The closed test is live without it (verified
2026-08-23: track Active, 50006 available to selected testers), so it is not
blocking the 14-day clock — but it is on the path to production, and option C
answers it too. **YOU** — check whether App access is already declared.

---

## 2. App Privacy — the nutrition label

Apple's questionnaire is per data type: is it **collected**, is it **linked to
the user**, is it used for **tracking**, and for which **purposes**.

Note the definitional difference from Google before copying answers across.
Apple defines "collect" as transmitting data off the device *in a way that lets
you or your third-party partners access it beyond servicing the request in real
time*. Google's definition is just "transmitted off the device", full stop. On
the academic-data question Apple's wording is therefore **more clearly in our
favour**, not less: grades and timetables go to MENDELU, which is the student's
own service provider and not a partner of ours, and we never access them.

### 2.1 What to declare

| Apple data type | Collected | Linked to user | Tracking | Purpose | Source |
|---|---|---|---|---|---|
| **Identifiers → User ID** | Yes | **Yes** | No | Analytics | `trackDailyUsage` (`src/api/feedback.ts:31`) sends a SHA-256 hash of the student ID once a day. Pseudonymous, not anonymous — stable per student over a 6–7-digit ID space, so it is enumerable. That is why this says *linked*. Runs unconditionally (`src/store/useAppStore.ts:166`) — there is no switch. |
| **Contact Info → Email Address** | Yes | Yes | No | App Functionality | Only the feedback form's optional contact box → `suggestions.contact`. Blank unless typed. |
| **User Content → Customer Support** | Yes | Yes | No | App Functionality | Feedback title and body → `suggestions`, via the `submit-suggestion` edge function. reIS's own Supabase, no third party. |
| **Diagnostics → Crash Data** | Yes | **No** | No | App Functionality | `report_error_v2`. The session id is a random UUID regenerated every app start and is not tied to a person; message, path and stack are sanitised (`src/services/errorReporter/sanitize.ts`) of e-mails, tokens, `*.mendelu.cz` URLs and 6–7-digit IDs. Genuinely optional since PR #237 — reporting requires `errorReportingHydrated && errorReportingEnabled`. |

**Tracking is "No" across the board**, and that is a real answer rather than a
convenient one: nothing is shared with data brokers, nothing is combined with
third-party data, and there is no advertising SDK. Consequence worth knowing —
**no App Tracking Transparency prompt is required**, so do not add one.

### 2.2 What not to declare, and why

- **Location — not collected.** The campus map renders a static basemap and
  room data; nothing asks the device where it is. `ios/App/App/Info.plist` has
  **no `*UsageDescription` keys at all**, which a reviewer can verify in the
  binary. This row needs no argument.
- **Academic data (grades, timetable, exams, files, documents) — not
  collected**, per the definition above. Inbound data is not collection at all;
  the outbound flows (exam sign-up, submissions) are each an explicit tap by
  the student on their own university record, going to the university they hold
  the account with.
- **The feedback rate-limit IP hash — not declared**, matching the Play
  decision and resting on the same abuse-prevention reasoning. The same
  counter-argument recorded in `play-store-listing.md` applies here. If Apple
  queries it, amend; do not defend.

### 2.3 Apple's optional-disclosure exception — considered and declined

Apple lets you skip disclosure entirely when the collection is optional,
infrequent, not part of primary functionality, clearly labelled, affirmatively
chosen each time, and not used for tracking or advertising. The feedback form
fits that on every clause, so **Email Address** and **Customer Support** could
legitimately be omitted.

Declaring them anyway, for two reasons: the two labels should say the same
thing, and an unexplained mismatch between the Play and Apple labels is a worse
position to be in than an over-inclusive label. Disclosing costs nothing here.

---

## 3. Screenshots — DONE

**Not blocked on §1, which is the useful surprise here.** The Play listing's
screenshots were never shot on a device either — `scripts/store-shots.mjs`
renders the same React phone tree in headless Chromium against a synthetic
fixture, precisely so that no real student's name, enrolment or grades end up
on a public store page forever. That pipeline has no login gate, so it works
for the App Store today.

`--preset` now selects the store:

| Preset | Output | Pixels | Viewport | Required by |
|---|---|---|---|---|
| `play` | `.store-shots/` | 1080 × 1920 | 360 × 640 @3 | Play (2:1 aspect cap) |
| `ios-6.9` | `.store-shots-ios-6.9/` | **1320 × 2868** | 440 × 956 @3 | App Store, 6.9″ iPhone |
| `ios-13` | `.store-shots-ios-13/` | **2064 × 2752** | 1032 × 1376 @2 | App Store, 13″ iPad |

```bash
REIS_FIXTURE=teachingWeek npx vite --config vite.web.config.ts --port 4317
```

```bash
npm run store:shots -- --preset ios-6.9
```

**Captured 2026-08-23: four screens × both iOS sizes, at exactly the required
pixel counts** (calendar, exams, subjects, map). Apple imposes no aspect cap,
so the iOS viewports are simply the pixel target divided by the scale rather
than real device point sizes.

Two things worth knowing before uploading:

- **The iPad shots are the phone tree at full width, and they look sparse.**
  That is not a bug in the capture — it is what the iPad app shows.
  `resolvePhoneViewport` returns true for `isNativeApp` without measuring
  anything, deliberately: the desktop tree is genuinely broken under Capacitor
  (`PdfViewer.tsx` calls bare `chrome.runtime.getURL`, and the failure is
  swallowed into a spinner that never resolves).

  **DECIDED 2026-08-23: iPad support stays.** `TARGETED_DEVICE_FAMILY` remains
  `"1,2"`. Two consequences to act on rather than absorb: the reviewer notes
  now explain the full-width phone layout up front (§5), because that shape is
  exactly what gets flagged under Guideline 4.2; and the iPad screenshots
  should be shot against the **fullest** fixture available, since empty space
  is what makes them look thin. `dev/fixtures/` has `teachingWeek` and
  `examSeason` — the first capture landed on a Sunday with two lessons, which
  is the worst case rather than a typical one.
- Because a browser at 1032px wide measures as desktop, the `ios-13` preset
  patches `matchMedia` in an init script to force the narrow answer. That is
  emulating `isNativeApp`, not faking a screenshot: it makes the browser render
  the same tree the app does.

Simulator captures, kept only as evidence of §1 and not as submissions:
`shot1.png` (splash) and `shot2.png` (the UIS sign-in WebView). Worth recording
that `simctl io screenshot` on iPhone 17 Pro Max emits exactly 1320 × 2868
natively — useful if a future screen can only be shot on a real device.

Format rules either way: 1–10 shots per size, PNG or JPEG, **no alpha
channel**. Smaller iPhone and iPad sizes are optional; Apple scales them down.

---

## 4. Guideline 5.2.2 — the real rejection risk

> "If your app displays content from a third party, ensure you have the
> rights."

reIS is an unofficial client for a university system it does not own, and the
first screen a reviewer sees is MENDELU's own branded login page. Apple rejects
unofficial university and school clients under 5.2.2 with some regularity, and
this is the guideline most likely to cost us the September deadline.

**DECIDED 2026-08-23: we are not asking MENDELU for permission.** Written
permission is the only thing that would close 5.2.2 outright, so declining to
seek it is a real increase in rejection risk and the decision is recorded as
such rather than smoothed over. It is also defensible — asking has weeks of lead
time against a 15 September deadline, a "no" is worse than never having asked,
and the substantive argument below does not depend on permission. Stated once,
now built around; the fallback if Apple rejects on 5.2.2 is to ask then, having
spent review cycles.

### 4.1 The argument that does not need permission

The strongest position is that **reIS is a user agent, not a republisher**. It
is worth getting this framing right, because it is the difference between "an
app displaying a third party's content" (which 5.2.2 is about) and "an app
helping a person reach their own account" (which it is not):

- Every request is made **with the student's own credentials, for the student's
  own records**, at their explicit instruction. reIS holds no MENDELU data of
  its own and has no account of its own.
- **Nothing is redistributed.** Data is parsed on the device and shown only to
  the account holder. There is no server of ours in the path — the same
  argument the privacy answers in §2 rest on, and it is checkable.
- reIS **never sees the password**: the student types it into MENDELU's own page
  in a WebView. So it is not even credential-proxying.

That is the same relationship a browser or an email client has to the service it
talks to.

### 4.2 What to actually do instead

1. **Say "unofficial" loudly, in three places.** Today it appears exactly once,
   as the **last line of a 4000-character store description** — which is
   effectively nowhere. It should be: (a) in the App Store description's
   **opening** lines, not its closing ones; (b) **inside the app**, on the
   sign-in gate screen being built for demo mode — "Neoficiální studentská
   aplikace. Není provozována Mendelovou univerzitou."; (c) in the reviewer
   notes. This is the cheapest mitigation available and it is currently missing
   from two of the three.
2. **Demo mode** (§1.1) so the reviewer can evaluate reIS without authenticating
   into a third-party system at all.
3. **Reviewer notes that pre-empt the question** rather than waiting to be
   asked. Draft in §5.

### 4.3 One thing a reviewer may query, left as-is for now

The listing title is **"reIS — IS MENDELU jednoduše"**, which uses the
university's name. Nominative use to describe what an app works with is
generally defensible, and dropping "MENDELU" would gut discoverability for the
only audience that wants this app. Left unchanged deliberately — but if Apple
objects specifically to the title, renaming is a cheap concession to make at
that point, and cheaper than arguing.

Two adjacent guidelines, lower risk but worth knowing:

- **4.2 Minimum Functionality** — "is this just a website in a wrapper?" reIS
  has a real answer: it fetches and *parses* IS's HTML into its own data model
  and renders native-feeling screens, plus features IS has no equivalent of
  (subject difficulty from the scraper pipeline, the campus map, eduroam setup,
  Drive backup). Say so; do not assume it is self-evident.
- **5.1.1 Data Collection and Storage** — well covered by §2 and the privacy
  policy, provided the policy URL is the app one and not the Chrome-extension
  one. `docs/privacy-policy-app.md` exists for this; check what is actually
  linked. See the note at `play-store-listing.md:449`.

---

## 5. App Review notes — draft

To paste into App Store Connect → App Review Information → Notes. Written for
the no-permission position decided in §4, so it leads with the user-agent
framing rather than with an authorisation claim it cannot make.

Keep it short. Reviewer notes are skimmed, and the first two sentences carry
almost all the weight.

> reIS is a free, non-commercial, open-source app made by students of Mendel
> University in Brno. **It is not an official university app and is not
> operated by or affiliated with the university.**
>
> WHAT IT IS: a client that helps a student read and act on **their own**
> records in the university information system (is.mendelu.cz), the same
> records they can already open in a browser. reIS holds no university data of
> its own and has no account of its own. Nothing is republished — everything is
> shown only to the account holder, on their own device.
>
> HOW IT WORKS: the student signs in on the university's own web page, shown in
> a WebView, so reIS never sees or stores the password. The resulting session
> token is kept in the iOS Keychain and used only to fetch that student's own
> records, which are parsed on the device. No academic data is transmitted to
> us or to anyone else.
>
> DEMO: a university account is required to use the app, so we have included a
> demo mode that needs no account. On first launch the app opens the
> university's sign-in page — **close it with the X in the top-right corner**,
> and the app's own sign-in screen appears underneath. Tap the second button,
> **"Prohlédnout ukázku"** ("Try the demo"), to browse the app with sample
> data. Every tab is populated; the banner across the top reads "Ukázka"
> (Demo). The sample student is fictional and no university account is
> contacted.
>
> LANGUAGE: the app opens in Czech, since it serves a Czech university. English
> is available under the person icon (top right) → language. The demo button's
> English label is "Try the demo".
>
> PERMISSIONS: the app requests none. There is no location access; the campus
> map is a static basemap.
>
> ON IPAD: reIS deliberately shows its phone layout on iPad. This is not an
> unadapted iPhone app — the layout is the tested one, and the tablet-specific
> layout is disabled because it depends on a browser-extension API that does
> not exist in the app.

That last paragraph exists because iPad support is now a requirement (§3) and
a full-width phone layout is exactly the shape a reviewer flags under
Guideline 4.2. Better to explain it than to be asked.

---

## 6. Version and build numbers — done

Handled by PR #236 and needs no manual step:

- `CFBundleShortVersionString` = `MARKETING_VERSION`, driven from
  `package.json` (5.0.6).
- `CFBundleVersion` = `CURRENT_PROJECT_VERSION` (50006), same encoding as
  Android's versionCode.
- `npm run cap:sync` re-stamps it and **reconciles rather than overwrites**, so
  a rebuild no longer resets a `REIS_IOS_BUILD` bump. Verified 2026-08-23: a
  fresh `cap:sync` reported `already at 5.0.6 (50006) — nothing to write`.

Unlike Play's globally monotonic versionCode, `CFBundleVersion` only has to
increase **within** one `CFBundleShortVersionString` train. Use `REIS_IOS_BUILD`
for a re-upload of the same marketing version.

---

## 7. Order of work

1. **Build demo mode** (§1.1 option C). Unblocks the reviewer and Play's App
   access in one change, and carries the in-app "unofficial" disclaimer that
   §4.2 says is missing. Spec:
   `docs/superpowers/specs/2026-08-23-demo-mode-design.md`.
2. **Move the "unofficial" line to the top of the store description** (§4.2).
   Minutes of work, and it is one of only three 5.2.2 mitigations left now that
   permission is not being sought. **YOU** — it is listing copy.
3. **App Privacy answers** into App Store Connect (§2). No blockers — these can
   be filed as soon as the app record exists.
4. **Reviewer notes** (§5).
5. **Re-shoot the iPad screenshots** against the fullest fixture once the demo
   banner exists (§3).
6. ~~Ask MENDELU for permission~~ — decided against, §4.
7. ~~Screenshots~~ — captured, §3.

---

## 8. Device verification — done 2026-08-24

Run on a clean install of the demo build, taking the reviewer's own path
(cancel the IS login, then the demo), not a developer's.

| Device | Result |
|---|---|
| iPhone 17 Pro Max (iOS 26.5) | **Pass.** Cancelling login opens the gate, not an error string. Demo enters; all five tabs render populated; a blocked download shows the toast and leaves no error state. |
| iPad Pro 13-inch M5 (iOS 26.5) | **Pass.** The gate is centred at 1032pt rather than stretched. Demo enters and the calendar renders. The phone tree at full width is sparse — expected, and explained in the §5 reviewer notes. |
| Android | Not re-run for the demo path. It does not gate this submission; it gates Play's App access answer, which is tracked in `play-store-listing.md`. |

Three defects were found by doing this rather than assuming, and fixed:

1. **The documents sheet was dead in demo mode.** `DocsSheet` disables every
   download button while `studiumId` is null, and nothing set it — `enterDemo`
   never supplied a context and `loadContext` reads IS, which demo mode blocks.
   A reviewer tapped five live-looking buttons and got nothing. `enterDemo` now
   sets a fabricated identity.
2. **A blocked tap could not explain itself.** `openIsFileNatively` throws
   `DemoModeError`, but the reply crosses postMessage, where the class was
   already flattened to a string — so the toast never fired and telemetry got a
   report about an intentional block. The reply now carries a `demoMode` flag.
3. **The toast covered the banner.** Both were anchored top and both spent
   `--safe-top`.

**Screenshots did not need re-shooting.** `store-shots.mjs` renders the phone
tree against a synthetic fixture in the dev webapp, where demo mode is off — so
the banner never appears in them. The four images at each of 1320×2868 and
2064×2752 taken on 2026-08-23 stand.

**Known and accepted:** demo mode does not survive an app relaunch (it is
in-memory state). Relaunching returns to the IS login, and cancelling it
reaches the gate again in two taps. Not worth persisting: a student who signs
in should not be able to be dropped back into fabricated data by a restart.

---

## 9. Listing copy — iOS

Adapted from the Play copy in `play-store-listing.md` §4, with four deliberate
differences. Do not simply paste the Play text.

1. **The "not official" line leads.** §4.2 lists this as one of only three
   remaining Guideline 5.2.2 mitigations, and it is worth nothing buried at the
   bottom where the Play version has it.
2. **Keychain, not Keystore.**
3. **eduroam is not mentioned.** It is advertised on Play because it works
   there — natively, campus-verified. On iOS the sheet still falls through to
   the desktop→phone QR path (`canConfigureEduroamNatively` is
   `android`-only), so the app would show a QR code the same device would have
   to scan. That is issue #212, still open. Advertising it would be describing
   a feature the app does not have on this platform.
4. **The demo is called out**, so a student who has not signed in yet — and a
   reviewer skimming the description — knows there is a way in.

### Name (30) / Subtitle (30)

```
reIS — IS MENDELU jednoduše
```

```
Rozvrh, známky a zkoušky
```

### Keywords (100, comma-separated, no spaces after commas)

```
mendelu,uis,is mendelu,rozvrh,zkoušky,známky,studium,univerzita,brno,kampus,student,předměty
```

### Description — Czech (primary)

```
reIS je studentský projekt. NENÍ to oficiální aplikace Mendelovy univerzity a
univerzita ji neprovozuje ani nezaštiťuje.

reIS zpřehledňuje Univerzitní informační systém MENDELU. Přihlásíš se svým
běžným univerzitním účtem přímo na stránce IS — reIS tvoje heslo nikdy nevidí —
a všechno podstatné máš hned po ruce.

CO UMÍ

• Rozvrh — aktuální týden, přepínání mezi dny i týdny, detail každé hodiny
  včetně místnosti a vyučujícího.
• Známky a průběžné hodnocení — bez proklikávání se do hloubky IS.
• Zkoušky — termíny, přihlášení i odhlášení přímo z telefonu.
• Předměty a soubory — studijní materiály stáhneš na pár klepnutí.
• Odevzdávárny a kontrola studia.
• Lidé — vyhledávání studentů i vyučujících, kontakt, kancelář a odkaz na Teams.
• Mapa kampusu — najdeš místnost, do které máš namířeno, i akce studentských
  spolků.

CHCEŠ SE JEN PODÍVAT?

Na přihlašovací obrazovce klepni na „Prohlédnout ukázku“. Projdeš si celou
aplikaci s vymyšlenými ukázkovými daty, bez univerzitního účtu.

SOUKROMÍ

Tvoje studijní data zůstávají v zařízení. reIS je nikam neposílá — čte je z IS
stejně, jako by sis je otevřel v prohlížeči, a ukládá je jen lokálně.
Přihlašovací token je uložený v iOS Keychain a nikdy se nesynchronizuje na
iCloud.

reIS je otevřený projekt studentů MENDELU.
```

### Description — English

```
reIS is a student project. It is NOT an official Mendel University app, and the
university neither operates nor endorses it.

reIS makes the MENDELU University Information System usable on a phone. You sign
in with your usual university account on IS Mendelu's own page — reIS never sees
your password — and everything you need is one tap away.

WHAT IT DOES

• Timetable — the current week, day and week switching, and full lesson detail
  including room and teacher.
• Grades and continuous assessment, without digging through IS.
• Exams — dates, sign-up and sign-off straight from your phone.
• Courses and files — download study materials in a couple of taps.
• Submission folders and study-progress checks.
• People — search students and staff, with contact details, office and a Teams
  link.
• Campus map — find the room you are heading to, plus student society events.

WANT TO LOOK AROUND FIRST?

Tap "Try the demo" on the sign-in screen to browse the whole app with invented
sample data, no university account needed.

PRIVACY

Your academic data stays on your device. reIS reads it from IS exactly as your
browser would and stores it locally only. Your session token is kept in the iOS
Keychain and is never synchronised to iCloud.

reIS is an open-source project by MENDELU students.
```


---

## 10. Submission state — 2026-08-24

The app record exists and every field Apple requires is filled. `Add for
Review` is enabled; the version has **not** been submitted.

| Item | State |
|---|---|
| App ID `cz.reis.app` | Registered, team **RG38V3SV8X**, no capabilities (the app declares no entitlements). |
| App record | **6804832714** — "reIS — IS MENDELU jednoduše", Czech, SKU `reis-ios-5`. |
| Build | **50006 / 5.0.6** uploaded, processed, attached. Signed *Apple Distribution: Dominik Holek (RG38V3SV8X)*. |
| Export compliance | Answered "None of the algorithms mentioned above" — verified, the app implements no encryption of its own. Now also declared in `Info.plist` so it stops being asked. |
| Screenshots | 4 at 1320×2868 (iPhone 6.9"), 4 at 2064×2752 (iPad 13"), in order. 6.5" inherits from 6.9" automatically. |
| Description / keywords / subtitle | Filed from §9. Support URL is the GitHub repo. |
| Pricing | Free, 175 countries or regions. |
| Age rating | **4+** — matches the Play PEGI 3 answer. |
| App Privacy | Published: Email Address, Customer Support, User ID (linked); Crash Data (not linked). Tracking No on every row. |
| Privacy policy | Gist `e3007a01…` **rewritten** to cover iOS and the Keychain, and linked. It described a Chrome extension until now. |
| Content Rights | "Does not contain, show, or access third-party content" — the user-agent reading, consistent with the §5 reviewer notes. |
| App Review Information | Sign-in **not** required (that is what demo mode bought), notes filed with the real button labels, contact complete. |
| Release | Set to release automatically once approved. |

**The remaining risk is unchanged and is not a form field: Guideline 5.2.2.**
No permission from MENDELU was sought (§4). The three mitigations in the
binary are the gate disclaimer, the in-app banner and the reviewer notes.
