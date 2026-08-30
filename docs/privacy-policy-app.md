# Privacy Policy for reIS

**Last Updated: 24 August 2026**

## Introduction

reIS ("we", "our", or "us") is a student-built project that simplifies the
Mendel University in Brno Information System (IS Mendelu). reIS is available as
a **browser extension** (Chrome, Edge, Firefox) and as a **mobile app for
Android and iOS (iPhone and iPad)**. This policy covers all of them, and calls
out anything that applies to only one.

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
- **iOS app (iPhone and iPad)** — the token is stored in the iOS Keychain,
  which encrypts it at rest under a key held by the device's Secure Enclave.
  The item is written with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`:
  it is readable only after the device has been unlocked once since boot, and
  it is **never synchronised to iCloud or restored onto another device**.
- **Browser extension** — the session cookie is held by your browser, as it
  would be for any website you log into.

Signing out deletes the stored token and clears the app's cookie store.

## Data reIS reads but does not collect

reIS fetches the following from MENDELU services and stores it **locally**, in
on-device storage (IndexedDB). Fetching it means your device asks the university
for it, authenticated as you, exactly as your browser would — that request goes
to MENDELU, not to us. **None of it is sent to reIS**, and none of it is held on
any server we run:

- **Your identity as IS holds it**: name, personal number (UIC), study details.
- **Academic data**: timetable, grades, continuous assessment, exam dates,
  courses, study materials, submission folders, study-progress checks.

This data does move between your device and MENDELU in both directions —
signing up for an exam or uploading to a submission folder sends it back to
`is.mendelu.cz`, because that is what you asked reIS to do. It is your session,
your record, and your university at the other end.

Uninstalling reIS removes the local copy.

## Data reIS collects

These four things are sent to servers **we** run or choose, rather than to the
university on your behalf. Two of the three are optional. (For where your data
goes when reIS acts on your behalf — IS Mendelu — see
*Third parties reIS talks to* below.)

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
**you type** are stored in reIS's own database, where the developers read and
triage them. They are not passed to any third party.

Alongside your message we store which reIS screen you were on, the app version,
the browser name and version, and the window size. The screen is recorded as a
name from a fixed list — never the page address, which on IS Mendelu would
identify your specific studies, subject or exam.

So that nobody can flood the form, we also store a **salted** hash of the IP
address the submission came from, used only to count how many submissions have
arrived from that connection in the past hour. The salt stays on the server and
is never shipped to your device, so that record cannot be linked back to you by
anyone who does not already hold it.

An entry stops counting once it is an hour old, and is deleted the next time
anyone submits feedback. In normal use that is within the hour — but we would
rather be exact than flattering: if nobody uses the form for a while, an expired
entry can sit there until someone does. It is a salted hash, not an address, and
it is ignored from the hour onwards.

Nothing is sent unless you press send.

### 4. A library study-room booking you make (browser extension only)

If you book a study room from the campus map, the booking is made in MENDELU's
own Microsoft Bookings system, and your **student or employee number** goes with
it — that system requires it, exactly as it does when you book on the library's
own page. The request passes through a reIS server so we can rate-limit it, and
that server stores a **salted** hash of your number with a timestamp, purely to
count how many bookings you have attempted in the last hour. The salt stays on
the server and is never shipped to your device, so that record cannot be linked
back to you by anyone who does not already hold it.

Nothing is sent unless you make a booking. *This feature does not exist in the
mobile app.*

## Third parties reIS talks to

| Service | Why | Applies to |
|---|---|---|
| **IS Mendelu** (`is.mendelu.cz`) | Fetch your academic data, authenticated as you | Both |
| **Supabase** (`*.supabase.co`) | **reIS's own database and servers**, not an outside recipient — see the note below. Holds public notifications, student society events, the daily usage count, sanitised error reports, and any feedback you submit | Both |
| **jsDelivr CDN** | Public, anonymous course-difficulty statistics. No request carries anything about you | Both |
| **Microsoft Bookings** (`outlook.office.com`) | Make a library study-room booking, if you make one. Carries your student/employee number, as that system requires | Extension only |

**Supabase is not in the same category as the rest of that table.** The others
are organisations that receive your data and do something of their own with it.
Supabase is the company that hosts reIS's database and servers: the data there is
reIS's, held on reIS's behalf and used for nothing else. Where this policy says
something "reaches no third party", that is what it means — it stays on reIS's
own systems, which happen to run on Supabase's infrastructure. Feedback you
submit is in that category.

We do **not** sell or trade your personal information, and we transfer it to no
one beyond the services in the table above — each of which is there because
reIS cannot do what you asked of it otherwise.

## Permissions the mobile app requests

**Android:**

- **Internet** — to reach IS Mendelu.
- **Notifications** — so a file download can tell you it finished. The file
  saves either way if you decline.
- **Wi-Fi state / change Wi-Fi state** — only for the optional one-tap eduroam
  setup. The network itself is saved by Android's own confirmation dialog, not
  silently by reIS.

**iOS (iPhone and iPad): none.** The app declares no usage-description keys at
all, so iOS never shows you a permission prompt on its behalf. One-tap eduroam
setup is an Android-only feature; on iOS the Wi-Fi profile is installed by
iOS's own Settings flow, which you confirm yourself.

Neither app requests **any location permission**. The campus map shows the
campus, not you.

## Your control

- **See your data**: everything reIS holds about you is what it displays.
- **Turn off error reporting**: any time, in reIS's settings.
- **Sign out**: deletes the stored session token and clears cookies.
- **Delete everything**: uninstall the app or extension.
- **Ask us**: for anything held server-side — the hashed daily-usage record, the
  hashed library-booking rate-limit rows, and
  any feedback you submitted — write to the address below and we will delete it.
  We will ask you to confirm your identity first (a message from your MENDELU
  address is enough), because those rows are keyed by a hash of your student
  number and we have no other way to tell whose they are.

## Children

reIS is intended for university students and staff. It is not directed at
children.

## Changes to this policy

We may update this policy. Changes will be posted on this page with a new "last
updated" date.

## Contact

`reis.mendelu@gmail.com`
