# Privacy Policy for reIS

**Last Updated: 4 September 2026**

reIS is a student-built project that simplifies the Mendel University in Brno
Information System (IS Mendelu). It is a **browser extension** (Chrome, Edge,
Firefox) and a **mobile app** (Android, iPhone, iPad). This policy covers all of
them and flags anything that applies to only one.

reIS is not an official application of Mendel University.

## The short version

Your academic data stays on your device. reIS fetches it from MENDELU using your
own session, the way your browser would, and keeps it in on-device storage. We
run no server that holds it.

Three small things do reach us, and only those: a **daily count**, an **error
report** (which you can switch off), and **feedback you type and send**. Each is
described below.

## Signing in

You sign in on **IS Mendelu's own login page**, shown inside reIS. Your password
goes straight to `is.mendelu.cz`. **reIS never sees, reads or stores it.**

reIS keeps the session token IS issues so you need not log in every launch:

- **Android** — encrypted (AES-256-GCM) with a key generated inside the Android
  Keystore, which cannot be exported from the device.
- **iOS** — in the iOS Keychain, encrypted under a Secure Enclave key, marked
  `…AfterFirstUnlockThisDeviceOnly`: **never synced to iCloud, never restored
  onto another device**.
- **Extension** — the session cookie stays in your browser, as for any website.

Signing out deletes the token and clears the cookie store.

## What stays on your device

Your name, personal number (UIC) and study details; your timetable, grades,
continuous assessment, exam dates, courses, study materials, submission folders
and progress checks.

**None of it is sent to reIS or held on any server we run.** It moves only
between your device and MENDELU — in both directions, since signing up for an
exam or uploading to a folder sends it back to `is.mendelu.cz`. That is your
session, your record, your university. Uninstalling removes the local copy.

## What we collect

### 1. Daily usage count

Once a day, a **random identifier created when you installed reIS** is sent to
our database so we can count how many installations are active. It is a 128-bit
UUID with no relationship to you: not your student ID, not a hash of it, not
derived from anything about you.

Earlier versions sent `SHA-256(student ID)`. That was not anonymisation —
student IDs are 6–7 digits, so the whole range can be hashed in seconds and the
digest reversed — and it was replaced with the random identifier.

The honest consequence: this counts **installs, not people**. One student with a
phone and a laptop is two; a reinstall is a third. We would rather undercount
people than hold something that points back at one.

*Lawful basis: legitimate interest, GDPR Art. 6(1)(f) — knowing whether the
project is worth maintaining.*

### 2. Error reports — **you can turn this off**

**Sent:** error type and message, file path and line, a sanitised stack excerpt,
app version, browser name and version, a timestamp, and a per-session ID — a
random UUID held in memory only, regenerated every launch, so we can tell one
person hitting a bug thirty times from thirty people hitting it once. It cannot
be linked to you or followed across sessions.

**Never sent:** your name, your student ID or any hash of it, session tokens or
cookies, anything fetched from IS Mendelu, anything in on-device storage.
Messages and paths are automatically redacted of e-mail addresses, tokens,
`*.mendelu.cz` URLs and 6–7-digit student numbers before they leave.

*Lawful basis: legitimate interest, GDPR Art. 6(1)(f) — stability.*

### 3. Feedback you send

Your message and any contact details **you type**, plus which reIS screen you
were on (a name from a fixed list, never the page address), the app version,
browser name and version, and the window size. Stored in reIS's own database and
read by the developers. Passed to nobody.

To stop the form being flooded we count recent submissions per app and browser
version — the values already listed above, nothing more. **Your network address
is not recorded, hashed or otherwise**; the server component that once hashed it
was removed in September 2026, and the form now writes straight to the database.
That counter is a rough guard, not a strong one, and we would rather say so.

Nothing is sent unless you press send.

## Who else reIS talks to

| Service | Why |
|---|---|
| **IS Mendelu** (`is.mendelu.cz`) | Fetches your academic data, authenticated as you |
| **jsDelivr CDN** | Public course-difficulty statistics. No request carries anything about you |
| **Supabase** (`*.supabase.co`) | Hosts reIS's own database — see below |

**Supabase is not a recipient of your data in the way the others are.** It is the
company whose infrastructure reIS's database runs on. Data there is reIS's, held
on reIS's behalf, used for nothing else. Where this policy says something reaches
no third party, that is what it means.

We do **not** sell or trade your personal information, and transfer it to no one
beyond this table.

## Permissions

**Android:** internet; notifications (so a download can say it finished — it
saves either way); Wi-Fi state, only for optional one-tap eduroam setup, where
Android's own dialog saves the network, not reIS.

**iOS: none.** The app declares no usage-description keys, so iOS never shows a
prompt on its behalf.

**Neither app requests location.** The campus map shows the campus, not you.

## Your control

- **Turn off error reporting** — any time, in settings.
- **Sign out** — deletes the token, clears cookies.
- **Delete everything** — uninstall.
- **Ask us** — for feedback you sent, write to the address below and we will
  delete it. The daily-usage rows are keyed by the random install identifier and
  hold nothing about you, so there is nothing there to identify, return or
  erase; uninstalling ends them.

## Children

reIS is intended for university students and staff. It is not directed at
children.

## Changes

We may update this policy. Changes appear here with a new "last updated" date.

## Contact

`reis.mendelu@gmail.com`
