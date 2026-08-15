# Play Store submission pack — reIS for Android

Everything Google asks for at submission, answered from what the app actually
does rather than from what the extension's older policy says. Verified against
the code on 2026-08-14 at version 5.0.5 (versionCode 50005).

Anything marked **YOU** needs a human: it is either a Play Console form, a
payment, or a secret.

---

## 1. Before you submit — two real blockers

### 1.1 The Discord feedback webhook ships inside the APK

`src/constants/config.ts:1` hardcodes a Discord webhook URL, and
`FeedbackModal` is reachable on mobile from the profile sheet
(`ProfileSheet.tsx:210`). This was already public — the repo is open source —
but a Play Store listing hands the same URL to anyone who unzips the APK, and a
Discord webhook accepts unauthenticated POSTs from anyone holding it. Expect
channel spam eventually.

This is issue #163, and it **blocks a public listing** until the client stops
carrying a write-capable webhook.

**Rotating the webhook is not a mitigation.** The replacement URL ships in the
next APK exactly as the current one does, so the attacker who unzipped the first
build unzips the second. Rotation only resets the clock on a URL that has
already leaked; it does nothing about the one you are about to publish. It is
worth doing *after* the fix, not instead of it.

The fix is to move delivery behind a Supabase Edge Function, the way the other
proxies already gate on `x-reis-extension-secret`. Then the APK holds a
function URL that only accepts calls carrying the shared secret, and the Discord
URL never leaves the server. Needs a deploy.

Until that lands, the honest options are:

1. **Ship to a closed test only.** Exposure is the testers you invited rather
   than anyone on the store, which is a genuinely smaller number — but it is a
   smaller number, not zero, and every APK you hand out still contains the URL.
2. **Hold the listing.** Correct if the relay is close.

I have not changed the code. Whichever you pick, note that "rotate and ship
publicly" is not on this list on purpose.

### 1.2 New personal developer accounts must run a closed test first

If the Play Console account is a **personal** account created after
13 Nov 2023, Google requires a closed test with **at least 12 testers opted in
for 14 continuous days** before production access unlocks. Organisation
accounts are exempt. Check the account type early — it is a two-week lead time,
not a paperwork step. **YOU**

---

## 2. Data safety form

Google asks, per data type: is it *collected*, is it *shared*, is it
*processed ephemerally*, is it *required*, and *why*. These answers are the
truthful ones for the Android app.

### Collected and sent off the device

| Data type | Collected | Shared | Purpose | Required | Notes |
|---|---|---|---|---|---|
| **User IDs** | Yes | No | Analytics | Optional | `trackDailyUsage` (`src/api/feedback.ts:30`) sends a **SHA-256 hash** of the student ID to Supabase once per day, to count active users. The raw ID never leaves the device. The hash is **pseudonymous, not anonymous** — it is stable per student and the ID space is only 6–7 digits, so it is enumerable and must be declared as a collected user identifier, which is why this row says `Collected: Yes`. Runs on Android — it is in `initializeStore`, which the phone tree reaches through `useAppLogic`. |
| **Crash logs** | Yes | No | Diagnostics | Optional | The `report_error_v2` RPC. Fields: an ephemeral random session UUID (regenerated every app start, not tied to a person), error type, message, file path, line, stack excerpt, timestamp, app version, browser name/version. Sanitised first (`src/services/errorReporter/sanitize.ts`): e-mail addresses, bearer/cookie tokens, all `*.mendelu.cz` URLs and 6–7-digit student/staff IDs are redacted. |
| **Other in-app messages** | Yes | Yes | App functionality | Optional | Only if the student opens the feedback form and submits it. The text they type is delivered to a Discord channel — that is a third party, so this row is `Shared: Yes`. See §1.1. |

### Handled but NOT collected by reIS

Declare these as **not collected**. Google's definition of *collected* is
"transmitted off the device to a server the developer controls", and none of
these are — they never reach a server we run.

They are not motionless, though, and the distinction matters if a reviewer asks:
this data comes **from** `is.mendelu.cz` over the network, requested by the
student's own authenticated session, and edits (an exam sign-up, a submission)
go back the same way. That traffic is between the student and their university,
with reIS acting as the client. Nothing forks off to us.

- **Name, student ID (UIC), study details** — read from IS Mendelu, stored in
  IndexedDB on the device.
- **Grades, schedules, exam dates, course files, submissions** — same.
- **Credentials** — the student logs in on **IS Mendelu's own page** inside a
  WebView. reIS never sees the password. The resulting session token is stored
  in the Android Keystore (AES-256-GCM, key non-exportable,
  `SecureStorePlugin.java`) and sent only back to `is.mendelu.cz`.
- **Location** — the campus map has no geolocation permission; it renders a
  static basemap and room data. `AndroidManifest.xml` requests no location
  permission, which the reviewer can verify.

### Security practices (the three checkboxes)

- Data is encrypted in transit: **Yes** (HTTPS throughout; no cleartext
  permitted, and the manifest sets no `usesCleartextTraffic`).
- Users can request data deletion: **Yes** — signing out clears the stored
  token and the WebView cookie jar; uninstalling removes all local data. For
  the hashed-ID usage rows, provide a contact address. **YOU**
- Committed to Google Play Families policy: **No** (not a children's app).

---

## 3. Content rating questionnaire

Category: **Utility / Productivity / Communication**. Truthful answers:

- Violence, sexuality, profanity, controlled substances, gambling: **No** to all.
- User-generated content shared between users: **No**. Society events are
  authored by vetted society accounts, not by students, and there is no
  student-to-student messaging in the app.
- Shares user location: **No**.
- Allows purchases: **No**.
- Expected outcome: **PEGI 3 / Everyone**.

---

## 4. Store listing copy

### Title (30 chars max)

```
reIS — IS MENDELU jednoduše
```

### Short description (80 chars max)

Czech:
```
Rozvrh, známky, zkoušky a soubory z IS MENDELU — přehledně a na pár klepnutí.
```

English:
```
Your MENDELU timetable, grades, exams and course files — finally simple.
```

### Full description (4000 chars max) — Czech

```
reIS je studentská aplikace, která zpřehledňuje Univerzitní informační systém
MENDELU. Přihlásíš se svým běžným účtem přímo na stránce IS — reIS tvoje heslo
nikdy nevidí — a všechno podstatné máš hned po ruce.

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
• eduroam — nastavení univerzitní Wi-Fi na jedno klepnutí, včetně certifikátu.

SOUKROMÍ

Tvoje studijní data zůstávají v telefonu. reIS je nikam neposílá — čte je z IS
stejně, jako by sis je otevřel v prohlížeči, a ukládá je jen lokálně.
Přihlašovací token je uložený v Android Keystore.

reIS je otevřený projekt studentů MENDELU a není oficiální aplikací univerzity.
```

### Full description — English

```
reIS is a student-built app that makes the MENDELU University Information
System usable on a phone. You sign in with your usual account on IS Mendelu's
own page — reIS never sees your password — and everything you need is one tap
away.

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
• eduroam — one-tap university Wi-Fi setup, certificate included.

PRIVACY

Your academic data stays on your phone. reIS reads it from IS exactly as your
browser would and stores it locally only. Your login token is kept in the
Android Keystore.

reIS is an open-source project by MENDELU students and is not an official
university app.
```

---

## 5. Graphic assets

The two assets have **opposite** transparency rules, which is the easy thing to
get backwards here:

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512×512 **32-bit PNG, alpha required**, max 1024 KB, sRGB | **Ready.** `android/play-store-icon.png` is 512×512 RGBA — exactly what Play asks for. **Do not flatten it.** Play applies its own shape mask and rounding, so upload the full square with its alpha intact and add no rounded corners or drop shadow of your own. |
| Feature graphic | 1024×500 **PNG or JPEG, opaque — no alpha**, max 15 MB | **Missing.** Required for every listing. Flatten this one onto an opaque background before upload; a PNG that keeps an alpha channel is rejected. Keep text inside the centre ~820×400, since the graphic is cropped on some surfaces. |
| Phone screenshots | 2–8, min 320px, aspect ratio capped at 2:1 | **Missing.** Capture them with `scripts/store-shots.mjs` — see below. |
| Tablet screenshots | Optional | Skip — the app deliberately ships the phone UI on tablets. |

### Screenshots must come from a synthetic fixture, not a handset

A screenshot taken on a developer's phone shows a real student's name, real
enrolment and real grades, and a Play listing is public forever. `store-shots.mjs`
drives the same React phone tree in a headless browser against a committed
synthetic fixture, at 1080×1920 (a 360×640 viewport at scale 3 — 16:9, safely
inside Play's 2:1 cap, which is why the tempting 1080×2400 is not used):

```bash
REIS_FIXTURE=teachingWeek npx vite --config vite.web.config.ts --port 4317
node scripts/store-shots.mjs --url http://localhost:4317
```

Only one fixture is served at a time, so re-shoot a screen that wants a
different one with `--only`, e.g. an exam season for the exams tab:

```bash
REIS_FIXTURE=examSeason npx vite --config vite.web.config.ts --port 4317
node scripts/store-shots.mjs --url http://localhost:4317 --only 2-zkousky
```

Output lands in `.store-shots/` (gitignored). The script exits non-zero if a
requested screen was not captured, so a green run means every image is current.

Do not substitute handset captures for these. The images go out under the
university's name with nobody's data in them, and that is the whole point.

---

## 6. Privacy policy

Play requires a publicly reachable privacy policy URL, and the current
`PRIVACY.md` opens with "reIS is a Chrome extension" — a reviewer reading it
for an Android submission will find the app it describes is not the app being
submitted.

A rewritten policy covering both surfaces is at `docs/privacy-policy-app.md`,
ready to publish as a page on the `reis-page` site (Vercel). **YOU** publish it
and paste the resulting URL into the Play Console — I have not deployed
anything.

The substantive changes it makes versus `PRIVACY.md`:

- Says "browser extension **and Android app**" throughout.
- Documents the Android Keystore token storage, which did not exist when the
  policy was last updated (May 2026).
- Drops WebISKAM from the app's scope — ISKAM is not in the Android build.
- Drops Google Drive backup from the app's scope — deliberately absent on
  mobile.
- Keeps the daily hashed-ID usage counter and the error reporting, which are
  the only two things that do leave an Android device automatically.
