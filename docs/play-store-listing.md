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

This is issue #163. Options, cheapest first:

1. **Rotate the webhook and ship anyway.** Accepts the risk, costs nothing, and
   the blast radius is one Discord channel you can re-rotate. **YOU** (Discord
   admin).
2. Move delivery behind a Supabase Edge Function, the way the other proxies
   already gate on `x-reis-extension-secret`. Correct fix, needs a deploy.

I have not changed this — it is your call whether it blocks a public listing.

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
| **User IDs** | Yes | No | Analytics | Optional | `trackDailyUsage` (`src/api/feedback.ts:30`) sends a **SHA-256 hash** of the student ID to Supabase once per day, to count active users. The raw ID never leaves the device. Runs on Android — it is in `initializeStore`, which the phone tree reaches through `useAppLogic`. |
| **Crash logs** | Yes | No | Diagnostics | Optional | The `report_error_v2` RPC. Fields: an ephemeral random session UUID (regenerated every app start, not tied to a person), error type, message, file path, line, stack excerpt, timestamp, app version, browser name/version. Sanitised first (`src/services/errorReporter/sanitize.ts`): e-mail addresses, bearer/cookie tokens, all `*.mendelu.cz` URLs and 6–7-digit student/staff IDs are redacted. |
| **Other in-app messages** | Yes | Yes | App functionality | Optional | Only if the student opens the feedback form and submits it. The text they type is delivered to a Discord channel — that is a third party, so this row is `Shared: Yes`. See §1.1. |

### Handled but NOT collected (nothing leaves the device)

Declare these as **not collected**; they never reach a server we control.

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

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512×512 PNG | `android/play-store-icon.png` exists at 512×512. It currently **has an alpha channel** — flatten it onto an opaque background before upload, since Play composites its own shape mask and transparency can render as black. |
| Feature graphic | 1024×500 PNG/JPEG | **Missing.** Required for every listing. |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | **Missing.** Can be captured from the connected handset once the release build is installed. |
| Tablet screenshots | Optional | Skip — the app deliberately ships the phone UI on tablets. |

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
