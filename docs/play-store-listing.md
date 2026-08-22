# Play Store submission pack — reIS for Android

Everything Google asks for at submission, answered from what the app actually
does rather than from what the extension's older policy says. Verified against
the code on 2026-08-14 at version 5.0.5 (versionCode 50005).

Anything marked **YOU** needs a human: it is either a Play Console form, a
payment, or a secret.

---

## 1. Before you submit — one remaining blocker

### 1.1 The Discord feedback webhook — RESOLVED

**No longer a blocker.** Feedback no longer touches Discord at all. The webhook
constant (`src/constants/config.ts`) is deleted, the webhook itself was deleted
at Discord's end and confirmed dead (HTTP 404, code 10015), and `FeedbackModal`
now posts to the `submit-suggestion` edge function, which validates,
rate-limits and inserts into the `suggestions` table. Triage happens inside reIS
under "Spravovat spolky", visible only to the `reis_admin` login.

Two consequences that matter for the rest of this document, because they change
answers rather than just history:

- **The Data safety "Shared" answer changed.** Feedback text used to go to a
  Discord channel, which is a third party, so the row below was `Shared: Yes`.
  It now goes to reIS's own Supabase project, so it is `Shared: No`. Submitting
  the old answer would be inaccurate — see §2.
- **The privacy defect that came with it is fixed.** The old payload included
  `window.location.href`, which on IS Mendelu carries `studium=`, `obdobi=`,
  `predmet=` and `termin=` — a pointer to the student's specific enrolment. The
  payload now carries a reIS screen name from a fixed allowlist. Two different
  guards, worth not conflating: the **client** normalises an unrecognised stored
  value to `calendar` (`src/api/suggestions.ts:27`), so the app never submits one;
  the **edge function** rejects an unrecognised value with a 400, which is what
  catches a payload posted directly rather than through the app.

Kept as a standing rule, because it was nearly repeated: **rotating a webhook is
not a mitigation.** The replacement ships in the next build exactly as the old
one did. That reasoning applies to any client-held credential, not just this one.

### 1.2 New personal developer accounts must run a closed test first

If the Play Console account is a **personal** account created after
13 Nov 2023, Google requires a closed test with **at least 12 testers opted in
for 14 continuous days** before production access unlocks. Organisation
accounts are exempt. Check the account type early — it is a two-week lead time,
not a paperwork step. **YOU**

---

## 2. Data safety form — SUBMITTED 2026-08-22

Google asks, per data type: is it *collected*, is it *shared*, is it
*processed ephemerally*, is it *required*, and *why*. These answers are the
truthful ones for the Android app.

**Filed in Play Console on 2026-08-22** and saved to Publishing overview (it
reaches Google with the next "send for review", not before). What went in:

- Collects required data types **Yes**; encrypted in transit **Yes**; account
  creation **"My app does not allow users to create an account"**; log-in with
  outside accounts **Yes → through employment or enterprise accounts**; data
  deletion **Yes**, pointing at the privacy-policy gist.
- Exactly four data types: **Email address**, **User IDs**, **Other in-app
  messages**, **Crash logs**. Nothing shared with anyone; nothing processed
  ephemerally.
- The two open judgement calls below were both decided the permissive way:
  academic data **not declared as collected**, and the rate-limit IP hash
  **not declared**. Both are defensible under Play's exceptions and both are
  disclosed in the privacy policy; neither is a fact the code settles, so if a
  reviewer challenges either, the answer is to amend the form, not to argue.

One answer changed against the table below during filing, and the table has
been corrected to match what was actually filed — see the **User IDs** row.

### Collected and sent off the device

| Data type | Collected | Shared | Purpose | Required | Notes |
|---|---|---|---|---|---|
| **User IDs** | Yes | No | Analytics | **Required** | `trackDailyUsage` (`src/api/feedback.ts:31`) sends a **SHA-256 hash** of the student ID to Supabase once per day, to count active users. The raw ID never leaves the device. The hash is **pseudonymous, not anonymous** — it is stable per student and the ID space is only 6–7 digits, so it is enumerable and must be declared as a collected user identifier, which is why this row says `Collected: Yes`. Runs on Android — it is in `initializeStore`, which the phone tree reaches through `useAppLogic`. **Required, not optional** (corrected at filing time): `initializeStore` calls `trackDailyUsage` unconditionally (`src/store/useAppStore.ts:166`) — it is not gated on `errorReportingEnabled` or on any other setting, so there is no switch a student can turn off. Contrast **Crash logs**, which genuinely is optional because `initTelemetry` is handed a live read of `errorReportingEnabled` (`src/entrypoints/main/main.tsx:20`) and the profile sheet exposes that toggle. If daily-usage tracking is ever put behind the same toggle, this row becomes Optional — change the code and the form together. |
| **Crash logs** | Yes | No | Diagnostics | Optional | **`Optional` was not actually true until PR #237** — worth recording, because the row was filed before the fix. The reporters are installed at module load, but the persisted opt-out is read from IndexedDB asynchronously, so a student who had switched reporting OFF still transmitted during startup — precisely when errors fire. Reporting now requires `errorReportingHydrated` AND `errorReportingEnabled`, so an unknown preference means silence. The `report_error_v2` RPC. Fields: an ephemeral random session UUID (regenerated every app start, not tied to a person), error type, message, file path, line, stack excerpt, timestamp, app version, browser name/version. Sanitised first (`src/services/errorReporter/sanitize.ts`): e-mail addresses, bearer/cookie tokens, all `*.mendelu.cz` URLs and 6–7-digit student/staff IDs are redacted. |
| **Email address** | Yes | No | App functionality | Optional | Only from the feedback form's optional contact box, stored as `suggestions.contact`. The field is labelled "Email / Discord" in both locales, so it collects an e-mail address often enough that Play's own data type applies — declaring only "Other in-app messages" would under-report it. Blank unless the student types something; never used for anything but replying to that report. |
| **Other in-app messages** | Yes | **No** | App functionality | Optional | Only if the student opens the feedback form and submits it. The text goes to reIS's own Supabase `suggestions` table via the `submit-suggestion` edge function — **not** to any third party, which is why `Shared` is `No`. It was `Yes` while delivery went to a Discord channel; that integration is gone (§1.1), so answering `Yes` here would now be wrong. Stored alongside it: the reIS screen name from a fixed allowlist, app version, browser name/version and viewport. **The page address is never recorded automatically** — that is the fix for the old leak. It is not a claim about the message itself: the title, body and contact are free text, so a student can always type a URL or an enrolment detail into them, and the schema cannot prevent that. |

#### The feedback rate-limit hash — DECIDED: not declared

Submitting feedback also writes a **salted** hash of the source IP to
`suggestions_rate_log`, purely to count submissions from that connection in the
last hour. The same pattern already covers library bookings.

Be precise about the retention, because the obvious phrasing overstates it: the
prune is **lazy**. `check_and_log_suggestion` deletes expired rows when it runs,
and it only runs on a submission — so with a quiet form an expired hash can
outlive its hour. It stops counting at the hour regardless. A guaranteed ceiling
needs a scheduled prune, which needs `pg_cron` (not currently enabled on the
project); tracked separately rather than done here.

Whether that needs declaring is a judgement, not a fact the code settles. The
argument for **not** declaring it is Play's security-and-abuse-prevention
exception; the argument against is that it is retained rather than processed
ephemerally, and an IP is personal data. It is disclosed in the privacy policy
either way, so the only open question was the Data safety form.

**Decided 2026-08-22: not declared**, resting on the abuse-prevention exception.
Worth re-opening if the lazy prune is ever replaced by something that retains
longer, or if the hash is ever used for anything other than counting.

**A review challenged this (2026-08-23) and the challenge is recorded rather
than dismissed**, because it is arguable and the decision is a judgement, not a
fact: the argument against is that Play's security exemption covers the
*purpose* of processing but does not by itself waive the *collection*
disclosure, so the honest answer would be to declare the type with a
fraud-prevention/security purpose rather than omit it. The counter — and the
reason the decision stands — is that the hash is never joined to a student, is
retained for an hour of counting and nothing else, and appears in the privacy
policy either way. **If Google ever queries it, amend the form; do not defend
it.** Declaring it costs almost nothing, so this is a cheap thing to concede.

### Academic data: DECIDED: not collected

Read Google's definition before answering this part, because the intuitive test
is the wrong one. Play defines **collected** as *transmitting user data off the
device* — full stop. It is **not** limited to servers the developer runs; it
covers transmission to any third-party server, and from a WebView the app
controls. "It only ever goes to the university, never to us" is therefore not by
itself an answer to the collection question.

So each flow has to be classified on its own terms:

| Flow | Off the device? | Notes for the form |
|---|---|---|
| Login on IS Mendelu's own page in a WebView | Yes, to `is.mendelu.cz` | reIS never sees the password; the student types it into the university's own page. The session token is stored in the Android Keystore (AES-256-GCM, key non-exportable, `SecureStorePlugin.java`) and sent only back to `is.mendelu.cz`. |
| Reading name, UIC, study details, grades, timetable, exams, files | Inbound, from `is.mendelu.cz` | Data arriving **at** the device is not collection. Stored in IndexedDB and nowhere else. |
| Exam sign-up / sign-off, submissions | Yes, to `is.mendelu.cz` | Outbound, and each one is an explicit tap by the student on their own university record. |
| **Location** | No | The campus map has no geolocation permission; it renders a static basemap and room data. `AndroidManifest.xml` requests no location permission, which a reviewer can verify. This row is genuinely *not collected*, no argument required. |

The outbound rows are the ones to think about. Two of Play's published
exceptions look applicable — the transfer is a **specific action initiated by
the user**, who plainly expects it (signing up for their own exam), and MENDELU
is not a *third party* receiving data from us but the service the student holds
the account with, for which reIS is only a client. On that reading these are
declared **not collected**.

That reading is defensible and it matches what the app does, but it is an
attestation a human signs, not a fact the code settles. The two Play pages it
rests on are [Data safety
definitions](https://support.google.com/googleplay/android-developer/answer/10787469)
and [the collection and sharing
exceptions](https://support.google.com/googleplay/answer/11416267). A wrong Data
safety answer is an enforcement matter, not a typo.

**Decided 2026-08-22: academic data is not declared as collected**, on the
reading above. The load-bearing part is that MENDELU is not a third party
receiving student data from reIS — it is the service the student already holds
the account with, and reIS is only a client of it. If reIS ever routes IS data
through a server of its own, that stops being true and this answer must change
before the build that does it ships.

**A review challenged this too (2026-08-23), and it is the more serious of the
two challenges.** The argument: exam sign-up, sign-off and submissions do
transmit academic data off the device, Play defines *collected* as exactly that,
and the user-initiated and service-provider exceptions are framed around
*sharing* rather than *collection*. That reading is not obviously wrong. The
decision stands because the alternative — declaring the student's own grades and
enrolment as data reIS collects — would materially misdescribe an app that never
receives a byte of it on any server it controls, and would read worse to a
student than the truth. **This is the answer most likely to need revisiting if
Google pushes back, and it should be conceded quickly rather than argued**, for
the same reason as above: the cost of declaring is a worse-looking listing, and
the cost of being wrong is an enforcement matter.

**Google Drive is deliberately absent from this section**: the backup is
browser-extension only and does not exist in the Android build, so it is out of
scope for this form. It does belong in the privacy policy, which covers both
surfaces.

### Security practices (the three checkboxes)

- Data is encrypted in transit: **Yes** (HTTPS throughout; no cleartext
  permitted, and the manifest sets no `usesCleartextTraffic`).
- Users can request data deletion: **Yes** — signing out clears the stored
  token and the WebView cookie jar; uninstalling removes all local data. For
  the hashed-ID usage rows, provide a contact address. **YOU** The procedure for
  actually honouring that is the runbook below.
- Committed to Google Play Families policy: **No** (not a children's app).

#### Fulfilling a deletion request (operator runbook)

`docs/privacy-policy-app.md` promises that server-side rows are deleted on
request, so the procedure has to exist before that policy is published. It is
manual by design — see the warning below.

**Four** tables hold student-supplied data, and they do not all key the same way
— which is the trap here. Three key on a derived digest of the student ID; the
fourth (`suggestions`) holds no student identifier at all and needs a different
approach entirely, described at the end. `daily_active_usage` and `feedback_responses` key on the
plain **SHA-256 hex of the student ID**, so the operator derives the key from
the ID the requester provides. In the Supabase SQL editor:

```sql
-- Replace 123456 with the student ID the requester gave you.
with key as (select encode(extensions.digest('123456', 'sha256'), 'hex') as h)
delete from daily_active_usage where student_id = (select h from key);

with key as (select encode(extensions.digest('123456', 'sha256'), 'hex') as h)
delete from feedback_responses where student_id = (select h from key);
```

`library_bookings_log` (the booking rate-limit log, extension only) is the third
and needs a **different** derivation. `bookings-create` writes
`sha256("<BOOKING_HASH_SALT>:<studentId>")` — **salted**, with the salt held in
that Edge Function's environment and nowhere in the database. The recipe above
produces the wrong digest and silently deletes nothing, so read the salt from
the function's config first:

```sql
-- BOOKING_HASH_SALT comes from the bookings-create function environment.
with key as (
  select encode(extensions.digest('<BOOKING_HASH_SALT>:123456', 'sha256'), 'hex') as h
)
delete from library_bookings_log where student_hash = (select h from key);
```

Run all three, then confirm each reported a non-zero row count or that the
student genuinely never used that feature — a silent zero on the booking table
usually means the salt was wrong, not that there was nothing to delete.

Two consequences of that salt worth knowing. It is what makes these rows
genuinely non-enumerable, unlike the unsalted usage hash, so they are the
better-protected records of the three. But it also means **rotating or losing
`BOOKING_HASH_SALT` makes the existing rows undeletable by derivation** — there
would be no way to work out which belong to a requester. If it is ever rotated,
purge the old rows at the same time; they are a rate-limit log with no value
past its window.

Verify the identity of the requester out of band (a mail from their
`@mendelu.cz` address is the obvious check) before running any of it.

> **Do not "fix" this by adding a delete RPC.** It looks like the tidier
> answer and it is strictly worse: the RPC would have to be callable by `anon`
> like the other reporting RPCs, it would take the hash — or the ID — as its
> only argument, and the ID space is 6–7 digits. That is an afternoon of
> enumeration away from letting anyone wipe every usage row in the table, and
> it hands an attacker a free oracle for which student IDs exist. A manual
> procedure behind an identity check is the correct design here, not a
> shortcoming.

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

##### `suggestions` — the one that cannot be keyed by student ID

Added after a review flagged that the runbook deleted three tables while the
Data safety form declared **Email address** and **Other in-app messages** as
collected. Both of those live here, so a deletion request answered with the
recipes above left them behind and the "we delete server-side rows" promise was
incomplete.

It needs its own treatment because **`suggestions` stores no student
identifier** — not a hash, not a UIC, nothing. That is deliberate (see §1.1),
and it is why the rows above cannot simply be extended with a fourth `delete`.
The only handle is the **optional** free-text `contact` box the student may have
filled in:

```sql
-- Only reaches rows where the student actually left a contact.
-- Case-insensitive and trimmed: it is free text, typed by hand.
delete from public.suggestions
where contact is not null
  and lower(btrim(contact)) = lower(btrim('student@example.com'));
```

Two honest limits an operator has to understand rather than work around:

- **A report submitted with the contact box empty cannot be attributed to the
  requester, and must not be guessed at.** That is not a gap in the procedure —
  such a row carries nothing linking it to a person, which is the whole point of
  collecting no identifier. Deleting an arbitrary row because it looks like
  theirs would destroy someone else's report.
- **`title` and `body` are free text**, so a student can always have typed
  identifying details into them. If the requester describes their report, search
  those columns too and delete on that basis — but confirm the match with them
  first, for the same reason as above.

`suggestions_rate_log` is deliberately NOT part of this. It holds a salted IP
hash with no link to a student ID, expires within the hour, and cannot be
matched to a requester at all — see the retention note in §2.
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
| Feature graphic | 1024×500 **PNG or JPEG, opaque — no alpha**, max 15 MB | **Ready.** `android/play-feature-graphic.png`, generated by `npm run android:feature-graphic` from the same `public/reIS_logo.svg` as the icons. The script asserts all three rules against the PNG's own bytes — 1024×500, colour type 2 (no alpha channel), under 15 MB — because each is only reported at upload time otherwise. Text sits inside the centre 820×400, since the graphic is cropped on some surfaces. |
| Phone screenshots | 2–8, min 320px, aspect ratio capped at 2:1 | **Missing.** Capture them with `scripts/store-shots.mjs` — see below. |
| Tablet screenshots | Optional | Skip — the app deliberately ships the phone UI on tablets. |

### Screenshots must come from a synthetic fixture, not a handset

A screenshot taken on a developer's phone shows a real student's name, real
enrolment and real grades, and a Play listing is public forever. `store-shots.mjs`
drives the same React phone tree in a headless browser against a committed
synthetic fixture, at 1080×1920 (a 360×640 viewport at scale 3 — 16:9, safely
inside Play's 2:1 cap, which is why the tempting 1080×2400 is not used):

`vite` runs in the foreground, so these are **two terminals** — pasted into one,
the capture would not start until you killed the server.

Terminal 1:

```bash
REIS_FIXTURE=teachingWeek npx vite --config vite.web.config.ts --port 4317
```

Terminal 2:

```bash
node scripts/store-shots.mjs --url http://localhost:4317
```

Only one fixture is served at a time, so re-shoot a screen that wants a
different one with `--only`. Restart the server in terminal 1 with the other
fixture first, e.g. an exam season for the exams tab:

```bash
REIS_FIXTURE=examSeason npx vite --config vite.web.config.ts --port 4317
```

```bash
node scripts/store-shots.mjs --url http://localhost:4317 --only 2-zkousky
```

Output lands in `.store-shots/` (gitignored). The script exits non-zero if a
requested screen was not captured — but note what a green `--only` run does and
does not prove: **only the requested image is current.** The rest of
`.store-shots/` still holds whatever the previous fixture produced, which is
correct (that is why `--only` does not wipe the directory) but means the set is
only coherent if you know which fixture each file came from. Before an upload,
do a full run first and then the `--only` re-shoots on top.

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

> **A policy is already published, and it is the wrong one.** The gist at
> `gist.github.com/ElijaahInverted/e3007a015e24c210a017d21743f83784` is publicly
> reachable, but it is the **extension-era** text: it opens "reIS … is a Chrome
> extension", and never mentions an Android app. A reviewer opening it from an
> Android submission finds a policy for a different product, which is a listing
> rejection rather than a nitpick — and it also omits the two things that
> actually leave an Android device (the Keystore-held session token and the
> hashed-ID daily counter). Replacing that gist's contents with
> `docs/privacy-policy-app.md` is enough; the URL can stay the same, so nothing
> already pointing at it breaks. Checked 2026-08-16.

The substantive changes it makes versus `PRIVACY.md`:

- Says "browser extension **and Android app**" throughout.
- Documents the Android Keystore token storage, which did not exist when the
  policy was last updated (May 2026).
- Drops WebISKAM from the app's scope — ISKAM is not in the Android build.
- Drops Google Drive backup from the app's scope — deliberately absent on
  mobile.
- Keeps the daily hashed-ID usage counter and the error reporting, which are
  the only two things that do leave an Android device automatically.
