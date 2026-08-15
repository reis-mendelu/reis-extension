# Privacy Policy for reIS

**Last Updated: 14 August 2026**

## Introduction

reIS ("we", "our", or "us") is a student-built project that simplifies the
Mendel University in Brno Information System (IS Mendelu). reIS is available as
a **browser extension** (Chrome, Edge, Firefox) and as an **Android
application**. This policy covers both, and calls out anything that applies to
only one of them.

reIS is not an official application of Mendel University.

## How you sign in

You sign in on **IS Mendelu's own login page**, shown inside reIS. Your username
and password are submitted directly to `is.mendelu.cz`. **reIS never sees, reads
or stores your password.**

What reIS keeps afterwards is the session token IS issues, so you do not have to
log in on every launch:

- **Android app** — the token is encrypted with AES-256-GCM using a key
  generated inside the Android Keystore. The key cannot be exported from the
  device, and only the ciphertext is written to storage.
- **Browser extension** — the session cookie is held by your browser, as it
  would be for any website you log into.

Signing out deletes the stored token and clears the app's cookie store.

## Data reIS reads but does not collect

reIS fetches the following from MENDELU services and stores it **locally**, in
on-device storage (IndexedDB). Fetching it means your device asks
`is.mendelu.cz` for it, authenticated as you, exactly as your browser would —
that request goes to the university, not to us. **None of it is sent to reIS or
to anyone else**, and none of it is held on any server we run:

- **Your identity as IS holds it**: name, personal number (UIC), study details.
- **Academic data**: timetable, grades, continuous assessment, exam dates,
  courses, study materials, submission folders, study-progress checks.
- **Dining data** (browser extension only): your canteen profile and meal
  reservations from WebISKAM. *WebISKAM is not part of the Android app.*
- **Google Drive backup** (browser extension only): if you connect it, reIS
  mirrors your current-semester IS files into **your own** Drive, using the
  narrow `drive.file` scope, which grants access only to files reIS itself
  created. *Drive backup is not available in the Android app.*

Uninstalling reIS removes all of this.

## Data reIS collects

These three things are sent to servers **we** run or choose, rather than to the
university on your behalf. Two of the three are optional. (For where your data
goes when reIS acts on your behalf — IS Mendelu, WebISKAM, your own Google
Drive — see *Third parties reIS talks to* below.)

### 1. Pseudonymous daily usage count

Once per day, when you open reIS, a **SHA-256 hash** of your student ID is sent
to our Supabase backend so we can count how many people use reIS. Your raw
student ID is never transmitted, and the hash carries no academic data, no
browsing history and no page content.

**This hash is pseudonymous, not anonymous.** It is the same value every day for
the same person, which is what makes counting possible — and because student
IDs are only 6–7 digits, anyone holding the hash could hash every possible ID
and find which one it came from. We therefore treat these records as personal
data under GDPR: they are covered by the deletion request described under *Your
control*.

*Lawful basis: legitimate interest under GDPR Art. 6(1)(f) — understanding
whether the project is worth maintaining.*

### 2. Automatic error reporting

When an unexpected error occurs, a sanitised diagnostic report is sent to our
Supabase backend so we can find and fix bugs. **You can turn this off** in
reIS's settings.

**What is sent**: error type, error message, file path and line number, a
sanitised excerpt of the JavaScript stack, app or extension version, browser
name and version, a client-side timestamp, and an anonymous per-session
identifier.

**About that identifier**: a random UUID created when reIS starts and held only
in memory. It is never written to disk, never synced, and regenerated every
launch. It exists only so we can tell "one person hitting the same bug thirty
times" apart from "thirty people each hitting it once". It cannot be linked back
to you or followed across sessions.

**What is never sent**: your name, your student ID or any hash of it, session
tokens or cookies, any data fetched from IS Mendelu (grades, timetable, exams,
course materials), and anything stored in on-device storage. Before
transmission, error messages and file paths are automatically redacted of e-mail
addresses, authentication tokens, `*.mendelu.cz` URLs, and 6–7-digit
student/staff numbers.

*Lawful basis: legitimate interest under GDPR Art. 6(1)(f) — stability.*

### 3. Feedback you choose to send

If you open the feedback form and submit it, the message and any contact details
**you type**, plus the app version and basic technical context, are delivered to
the developers through a Discord channel. Nothing is sent unless you press send.

## Third parties reIS talks to

| Service | Why | Applies to |
|---|---|---|
| **IS Mendelu** (`is.mendelu.cz`) | Fetch your academic data, authenticated as you | Both |
| **Supabase** (`*.supabase.co`) | Public notifications, student society events, the daily usage count, sanitised error reports | Both |
| **jsDelivr CDN** | Public, anonymous course-difficulty statistics. No request carries anything about you | Both |
| **Discord** (`discord.com`) | Deliver feedback you submit | Both |
| **WebISKAM** (`webiskam.mendelu.cz`) | Canteen profile and meal reservations | Extension only |
| **Google Drive** (`googleapis.com`) | Back up your own IS files into your own Drive, if you connect it | Extension only |

We do **not** sell or trade your personal information, and we transfer it to no
one beyond the services in the table above — each of which is there because
reIS cannot do what you asked of it otherwise. The one transfer you initiate
yourself is feedback: if you submit the form, the message and any contact
details you typed go to Discord, as described above.

## Permissions the Android app requests

- **Internet** — to reach IS Mendelu.
- **Notifications** — so a file download can tell you it finished. The file
  saves either way if you decline.
- **Wi-Fi state / change Wi-Fi state** — only for the optional one-tap eduroam
  setup. The network itself is saved by Android's own confirmation dialog, not
  silently by reIS.

The app requests **no location permission**. The campus map shows the campus, not
you.

## Your control

- **See your data**: everything reIS holds about you is what it displays.
- **Turn off error reporting**: any time, in reIS's settings.
- **Sign out**: deletes the stored session token and clears cookies.
- **Delete everything**: uninstall the app or extension.
- **Ask us**: for anything held server-side, including the hashed usage records,
  write to the address below and we will delete it.

## Children

reIS is intended for university students and staff. It is not directed at
children.

## Changes to this policy

We may update this policy. Changes will be posted on this page with a new "last
updated" date.

## Contact

`reis.mendelu@gmail.com`
