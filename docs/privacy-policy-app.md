# Privacy Policy for reIS

**Last Updated: 4 September 2026**

reIS is a student-built project that simplifies the Mendel University in Brno
Information System (IS Mendelu). It is a browser extension (Chrome, Edge,
Firefox) and a mobile app (Android, iPhone, iPad). reIS is not an official
application of Mendel University.

## In short

**Your academic data never reaches us.** reIS fetches it from MENDELU using your
own session — the way your browser would — and keeps it on your device. We run
no server that holds it.

Two small things reach us: a **daily count**, and **feedback you type and
send**. Nothing else — **no crash or error information is ever transmitted**,
from any surface, on any platform.

## Signing in

You sign in on IS Mendelu's own login page. Your password goes straight to
`is.mendelu.cz` — **reIS never sees, reads or stores it.**

reIS keeps the session token so you need not log in every launch: encrypted in
the Android Keystore, in the iOS Keychain (**never synced to iCloud or restored
onto another device**), or as a normal browser cookie in the extension. Signing
out deletes it.

## What stays on your device

Your name, personal number (UIC) and study details; timetable, grades,
continuous assessment, exam dates, courses, study materials, submission folders,
progress checks.

**None of it is sent to reIS or held on any server we run.** It moves only
between your device and MENDELU — both ways, since signing up for an exam or
uploading a file sends it back. Uninstalling removes the local copy.

## What we collect

**1. Daily count.** Once a day we send a random identifier created when you
installed reIS — a 128-bit UUID, unrelated to you, not your student ID nor a
hash of it — so we can count active installations. It counts **installs, not
people**: a phone and a laptop are two.

**2. Feedback you send.** Your message and any contact details you type, plus
which reIS screen you were on (a name from a fixed list, never the page
address), app version, browser name and version, and window size. Read by the
developers, passed to nobody. **Your network address is not recorded.** Nothing
is sent unless you press send.

*Lawful basis for both: legitimate interest, GDPR Art. 6(1)(f) — knowing the
project is used, and fixing what you report.*

## Who else reIS talks to

| Service | Why |
|---|---|
| **IS Mendelu** (`is.mendelu.cz`) | Fetches your academic data, authenticated as you |
| **jsDelivr CDN** | Public course-difficulty statistics. No identifier is sent |
| **Supabase** (`*.supabase.co`) | Hosts reIS's own database |

Supabase is not a recipient in the way the others are — it is the infrastructure
reIS's database runs on, used for nothing else. We do **not** sell or trade your
personal information, and transfer it to no one beyond this table.

## Permissions

**Android:** internet; notifications (so a download can say it finished); Wi-Fi
state, only for optional one-tap eduroam, where Android's own dialog saves the
network. **iOS: none.** **Neither app requests location** — the campus map shows
the campus, not you.

## Your control

Sign out to delete the token and cookies. Uninstall to delete everything local. For feedback you sent, write to the
address below and we will delete it — the daily-count rows hold nothing that
identifies you, so there is nothing there to erase.

## Children

reIS is intended for university students and staff. It is not directed at
children.

## Changes

We may update this policy; changes appear here with a new date. Google Drive
backup, Outlook calendar sync, WebISKAM, library study-room booking, AI syllabus
comparison and automatic error reporting have all been removed from reIS, along
with everything they sent.

## Contact

`reis.mendelu@gmail.com`
