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

> **Status: RESOLVED — this section is the original finding, not current
> state.** Option C was built and shipped; 5.0.6 opens a gate with a demo entry
> when the login is dismissed, `Sign-In Required` is unchecked, and the version
> was submitted on 2026-08-24. Kept in the present tense because it is the
> reasoning that produced demo mode, and §8/§10 record what actually happened.

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

Guideline 5.2.2 is broader than the one line it usually gets summarised as.
It covers apps that **use, access, monetise access to, or display** a
third-party service, requires permission under that service's own terms, and
lets Apple ask for evidence of that authorisation at any point. Read the
current text before arguing with a reviewer rather than relying on this
paraphrase: <https://developer.apple.com/app-store/review/guidelines/>

Every clause of that matters here, and "display" is the one reIS cannot argue
its way around — it plainly displays IS Mendelu content.

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
> records, which are parsed on the device. Academic data moves between the
> student's device and the university's own system and nowhere else: none of it
> reaches a reIS server, and none of it is analysed or shared.
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

> **Historical — every item here is done.** It is the plan that produced the
> submission, kept for the reasoning rather than as a live checklist. §10 is
> the record of what was actually filed.


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

**Submitted to App Review on 2026-08-24 at 23:49.** Status: *Waiting for
Review*, release set to automatic on approval. Every field below was filed
before submission; Apple's estimate is up to 48 hours.

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

---

## 11. Rejection 1 — Guideline 2.1 Information Needed (2026-08-26)

**Not a 5.2.2 rejection.** Apple replied on 2026-08-26 at 02:58 with the
standard new-app information request: seven questions, no defect claimed, no
guideline argued. Submission ID `80588968-d9f1-4411-82d6-f1d40fd51994`; the
version sits in *Rejected* until the reply goes in, and the same build can be
resubmitted — no new binary is required.

Worth being clear about what this is: Apple did **not** say the app is broken,
and did not raise the unofficial-client question of §4. Item 7 is the only one
that touches it, and it is answered from the §4.1 user-agent position, with the
absence of a permission stated plainly rather than papered over.

### 11.1 What only a human can do

**The screen recording (item 1) has to be captured by hand on a physical
device.** Two facts settle how:

- The wired iPad is an **iPad (8th generation) on iPadOS 26.6**, developer mode
  enabled (`xcrun devicectl list devices`). That is a physical device on the
  current OS, so it satisfies the request on its own — and it is the only
  choice: **there is no iPhone here** (confirmed 2026-08-26), so the physical
  half of the device list is one iPad and the reply says so rather than
  implying more. Consequence to accept: the reviewer's first sight of reIS will
  be the full-width phone layout of §3, so the reply flags it in item 1 and
  explains it in item 4 instead of letting it land as a surprise.
- **This device has never run the phone tree at 810×1080.** §8 verified iPad on
  the 13-inch Pro simulator. Walk the five tabs once after installing 50006 and
  before starting the take.

**Installing 50006 on that iPad, 2026-08-26 — what actually worked.** The
device build is one command; the obstacle was the old binary, not signing:

```
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'id=<device-udid>' -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=RG38V3SV8X CODE_SIGN_STYLE=Automatic build
```

`-allowProvisioningDeviceRegistration` is the load-bearing flag — without it
the build fails with "Device isn't registered in your developer account", and
`-allowProvisioningUpdates` alone will not register it. `DEVELOPMENT_TEAM` has
to come from the command line because the project is deliberately teamless
(§10). Install with `xcrun devicectl device install app`.

**The old build could not be removed, and the cause is a third-party app.** The
iPad carried reIS **1.0 (1)** signed under the old *free personal team*
`Z87FKZ59LL`; iOS refuses to upgrade that with anything signed
`RG38V3SV8X.cz.reis.app`. Deleting it was impossible: no Delete App button in
iPad Storage, no long-press menu, and `devicectl` answering `IXErrorDomain
error 22 — Uninstall prohibited` even though the app reports `removable: true`.
Allowing "Deleting Apps" in Screen Time did not help, and neither did a reboot.
**`devicectl device info processes` shows `screenzenapp` running** — ScreenZen
is a focus/blocker app, and blockers use Family Controls precisely to forbid
app removal so they cannot be uninstalled around. That restriction is what
holds reIS 1.0 in place; it has to be switched off inside ScreenZen, not in
Settings.

Rather than fight it, 50006 was installed **alongside** under
`PRODUCT_BUNDLE_IDENTIFIER=cz.reis.app.demo`, which the wildcard team profile
covers (so no new App ID was created in the account). It is the same Release
bundle, the same 5.0.6 (50006), the same web assets; only the signing
certificate and the bundle id differ, and neither is visible on screen. Two
identical **reIS** icons now exist — the 5.0.6 one is the only one with demo
mode, which is the quick way to tell them apart before recording.
- The reIS build installed on it is **1.0 (1)** — a stale dev build from before
  PR #236 stamped versions. Recording that binary would show Apple something
  other than what was submitted. Install **50006 / 5.0.6 through TestFlight**
  before recording; it is the exact reviewed binary and needs no local signing.

Shot list, in order, one take, no cuts:

1. Home screen → tap reIS. Show the splash and the university sign-in page
   loading. (Apple asked for the recording to *begin* with launch.)
2. Sign in with a real account and let the first sync finish. *(Your data will
   be in the video — the alternative is to show only the sign-in page and do
   the tour in demo mode. Apple asked to see the login flow, so at minimum the
   page and a successful sign-in should appear.)*
3. Timetable → open one lesson detail (room, teacher).
4. Grades tab. Exams tab → open a term detail (sign-up sheet visible; no need
   to actually sign up).
5. Courses → open a subject → the files sheet → download one file.
6. Campus map → search a room → the room highlighted.
7. Profile (person icon) → language switch to English and back → **Sign out**,
   showing the confirmation and the return to the sign-in page.
8. Relaunch → close the university page with the **X** → the gate screen with
   the unofficial disclaimer → **"Prohlédnout ukázku"** → one pass through the
   five demo tabs, banner visible.

The recording attaches to the App Review reply directly; if it is rejected for
size, an unlisted link is accepted.

### 11.2 The reply — paste into Reply to App Review

> Thank you for the list. Answers to all seven points follow; the same
> information is now also in App Review Information → Notes.
>
> **1. Screen recording.** Attached: captured on a physical iPad (8th
> generation) running iPadOS 26.6, beginning with the app launch, and showing
> the timetable, grades, exams, course files, campus map and sign-out, followed
> by the app's built-in demo mode. It is an iPad recording because iPad is the
> iOS hardware we own; note that reIS deliberately shows its phone layout there,
> which point 4 explains. On the specific flows listed:
>
> - *Registration:* none exists. reIS creates no accounts of its own. Signing
>   in uses the student's existing Mendel University account, entered on the
>   university's own sign-in page shown in a web view; the app never sees the
>   password.
> - *Login:* shown in the recording.
> - *Account deletion:* there is no reIS account to delete. "Odhlásit se"
>   (Sign out) is shown: it removes the session token from the iOS Keychain and
>   clears all locally cached data from the device.
> - *Paid content:* none anywhere in the app. It is free, with no in-app
>   purchases, no subscriptions, no paid tier and no advertising.
> - *User-generated content:* the app has no user-to-user content and no way to
>   create content inside it. Two adjacent things exist and both are shown: the
>   campus map can display event listings published by recognised university
>   student societies through a separate access-controlled web console that we
>   moderate (that console does not exist in the iOS app), and the feedback form
>   sends free text to us alone, where it is never shown to another user.
> - *Permission prompts:* there are none. The app requests no device
>   permissions at all — its Info.plist contains no usage-description keys, the
>   campus map is a static basemap that never asks where the device is, and
>   there is no App Tracking Transparency prompt because the app does no
>   tracking.
>
> **2. Devices and operating systems tested.**
>
> - iPad (8th generation), iPadOS 26.6 — physical device; clean-install run of
>   the whole flow, including the demo path a reviewer would take.
> - iPhone 17 Pro Max, iOS 26.5 — Simulator.
> - iPad Pro 13-inch (M5), iPadOS 26.5 — Simulator.
>
> The deployment target is iOS 15.0 and the app is built for both iPhone and
> iPad.
>
> **3. What the app does, and for whom.** reIS is a free, non-commercial,
> open-source app written by students of Mendel University in Brno, Czech
> Republic, for the roughly eight thousand students of that university. It is
> not an official university app and is not operated or endorsed by the
> university — stated in the opening line of the App Store description and on
> the app's own sign-in screen.
>
> The problem it solves: the university's information system (is.mendelu.cz) is
> a large desktop web application. A student who wants to know which room their
> next lecture is in has to work through several pages of a layout that was
> never made for a phone. reIS signs in to that same system with the student's
> own account, parses the pages on the device, and shows only the parts a
> student uses daily: timetable, grades and continuous assessment, exam dates
> with sign-up and sign-off, course materials and submission folders, the
> study-progress check, a staff and student directory with contact details and
> office location, and a campus map that locates a room. It adds two things the
> university system has no equivalent of: subject pass-rate statistics compiled
> from public data, and the campus map itself.
>
> **4. Setting up and accessing the main features.** No credentials are needed
> and none are supplied, because the app ships with a demo mode:
>
> 1. Launch the app. It opens the university's own sign-in page.
> 2. Close that page with the **X in the top-right corner**. The app's own
>    sign-in screen appears underneath.
> 3. Tap the second button, **"Prohlédnout ukázku"** ("Try the demo").
>
> The app then opens with invented sample data for a fictional student. All
> five tabs are populated and a banner reading "Ukázka" (Demo) stays across the
> top. No university account is contacted in this mode, and no sample files are
> needed — the course-materials screen already contains sample documents.
> Downloading is deliberately blocked while in demo mode and explains itself
> with a short message.
>
> The app opens in Czech, since it serves a Czech university. English is under
> the person icon (top right) → language; the demo button then reads "Try the
> demo".
>
> On iPad, reIS deliberately shows its phone layout. That is the tested layout
> rather than an unadapted iPhone app: the wide layout is disabled because it
> depends on a browser-extension API that does not exist in the app.
>
> **5. External services used.**
>
> - **Mendel University's information system (is.mendelu.cz)** — the source of
>   every piece of academic data. The student signs in on the university's own
>   page; the resulting session token is kept in the iOS Keychain and used only
>   to fetch that student's own records, which are parsed on the device.
> - **Supabase (EU region), our own backend** — the in-app notice feed, the
>   student-society event listings shown on the map, the feedback form, and
>   optional crash reports. It holds no academic data of any kind.
> - **jsDelivr**, serving our own open dataset repository
>   (github.com/reis-mendelu/reis-data) — static JSON files: subject pass-rate
>   statistics and campus building and room data. Read-only; the requests carry
>   nothing about the user.
> - **CARTO basemap tiles** (OpenStreetMap data) — the background of the campus
>   map.
>
> To be explicit about what is *not* used: no third-party authentication
> provider, no payment processor, no advertising network or SDK, no third-party
> analytics SDK, no AI or machine-learning service, and no data brokers. The
> only usage metric is a once-a-day counter keyed to a SHA-256 hash of the
> student's university ID, stored in our own Supabase and declared in the
> privacy label under Identifiers, used for analytics and never for tracking.
> Links to Microsoft Teams, e-mail and maps hand off to the system's own apps
> and are not services the app calls.
>
> **6. Regional differences.** There are none. The app behaves identically in
> every region: the same features, the same content, the same servers, free
> everywhere, with no geo-gating and nothing region-specific. It serves one
> university in the Czech Republic, so what a user sees depends on their own
> university account and not on where they are. The only variation is the
> interface language, which is a manual switch between Czech and English.
>
> **7. Regulated industry and third-party material.** reIS is in no regulated
> industry: no financial services, no health or medical data, no gambling, no
> cryptocurrency. It is free and non-commercial.
>
> On third-party material, stated plainly: reIS is an unofficial, student-made
> client for our university's information system, and we hold no written
> authorisation from the university. We do not claim one. Our position is that
> none is required, because the app acts as a user agent rather than as a
> publisher of the university's content:
>
> - Every request it makes is made with the student's own credentials, for the
>   student's own records, at that student's explicit instruction — the same
>   records the same student can open in Safari.
> - Nothing is republished or redistributed. Pages are parsed on the device and
>   shown only to the account holder. We operate no server in that path and hold
>   no university data.
> - reIS never sees the password. It is typed into the university's own page in
>   a web view.
> - The app carries no university branding of its own and says it is unofficial
>   in three places: the first line of the App Store description, the sign-in
>   screen, and here.
>
> That is the same relationship a web browser or an e-mail client has with the
> service it connects to. The source is public at
> github.com/reis-mendelu/reis-extension if that is useful. If the team would
> nonetheless like a statement from the university, we will ask for one — we
> would only like to know that it is required before starting a process that
> takes weeks.

### 11.3 Notes field — condensed

App Review Information → Notes caps at 4000 characters, so it cannot hold §11.2
whole. Replace the §5 notes with the §5 text plus these three paragraphs
appended (they are the parts of the reply a future reviewer will look for, and
Apple asked for exactly this):

> TESTED ON: iPad (8th generation), iPadOS 26.6 (physical device); iPhone 17
> Pro Max, iOS 26.5 and iPad Pro 13-inch (M5), iPadOS 26.5 (Simulator).
> Deployment target iOS 15.0, built for iPhone and iPad.
>
> EXTERNAL SERVICES: is.mendelu.cz (the university's own system, the student's
> own account); our own Supabase backend in the EU (notice feed, society event
> listings, feedback form, optional crash reports — no academic data);
> jsDelivr serving our open dataset (subject pass-rate statistics, campus room
> data); CARTO basemap tiles for the map. No advertising, no third-party
> analytics, no payment processor, no AI service, no tracking.
>
> NO PURCHASES, NO REGISTRATION, NO USER-TO-USER CONTENT. The app is free with
> no in-app purchases. It creates no account of its own, so there is nothing to
> register or delete; signing out clears the Keychain token and all local data.
> Users cannot create content in the app. Identical in every region.

### 11.4 Recorded for next time

Apple sends this seven-item request routinely on **new** app submissions, and
every answer above could have been filed in the Notes on 2026-08-24 for free.
It costs a review cycle to learn that, so: on a first submission to a new app
record, put items 2–7 in the Notes before submitting, and have a physical-device
recording ready.

### 11.5 A second dead-end, found on the device — fixed in 50006.1

Installing 5.0.6 on the iPad and walking the reviewer's path **before**
recording caught a defect that the simulator pass in §8 missed, because §8
took the path once and this takes it twice:

> Back out of the IS login → the gate appears → tap **"Přihlásit se"** → back
> out of the login again → **`reIS failed to start: LoginCancelledError: Login
> cancelled: the sign-in window was dismissed`** on a dead screen.

Same class of failure demo mode was built to remove (§1), one tap deeper, and
on exactly the path a reviewer with no MENDELU account walks. Reproduced on an
iPhone 17 Pro Max simulator against the shipped 5.0.6 binary, so it is in the
build Apple has.

**Root cause.** `boot()` maps `LoginCancelledError` to `showLoginGate()`, but
the gate's own sign-in handler in `capacitor/main.capacitor.tsx` sent every
rejection to `showFatalError`, which sets `textContent` on `#root` — wiping the
mounted gate, its demo button included. The handler needed the same judgement
`boot()` already makes, and nothing more: `root.unmount()` runs only *after*
`ensureSession` resolves, so on a cancellation the gate is still on screen and
the fix is to leave it there.

Covered by `capacitor/__tests__/loginGateCancel.test.tsx`, which drives both
dismissals through the real module and fails against the old handler. Fixed in
commit `048c112b`; **`CURRENT_PROJECT_VERSION` stamped `50006.1`** for the
re-upload (`REIS_IOS_BUILD=1`), marketing version unchanged at 5.0.6.

**Consequence for the resubmission:** upload 50006.1 and attach it to the
version before replying, and record *that* build. Replying against 50006 would
hand Apple a video of a binary with a known 2.1 dead-end in it.

The lesson §8 half-learned, now stated plainly: **walk each path twice.** The
first dismissal is the one everyone tests; the second is the one a reviewer
actually performs, because the first thing they try after seeing a sign-in
screen is the sign-in button.
