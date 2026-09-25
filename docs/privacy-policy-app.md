# Privacy Policy for reIS

**Last Updated: 25 September 2026**

reIS is a student-built project that simplifies the Mendel University in Brno
Information System (IS Mendelu). It is a browser extension (Chrome, Edge,
Firefox) and a mobile app (Android, iPhone, iPad). It is not an official
application of Mendel University.

## Your academic data stays on your device

Your name, personal number, study details, timetable, grades, assessment, exam
dates, courses, materials and submission folders are fetched from MENDELU using
your own session — the way your browser would — and kept on your device.
**None of it reaches us. We run no server that holds it.** It moves only between
your device and MENDELU, both ways, since signing up for an exam sends it back.
Uninstalling removes the local copy.

You sign in on IS Mendelu's own page; your password goes straight to
`is.mendelu.cz` and **reIS never sees it**. The session token is kept encrypted
(Android Keystore; iOS Keychain, **never synced to iCloud or another device**;
a normal cookie in the extension). Signing out deletes it.

**Nothing about an error is ever sent on its own**, from any surface, on any
platform. When you report a problem you may choose to attach technical details
yourself — see *Report attachments* below.

## What we do send

<!-- BEGIN generated:flows (npm run privacy:generate) -->
| what | when | what it carries |
|---|---|---|
| Daily count | once a day | a random install identifier — a UUID unrelated to you. Counts **installs, not people**, plus faculty and platform as group labels. |
| Feedback | you press send | your message, any contact detail you type, the screen name, app version, browser, window size |
| Report attachments | only what you add to a report, when you press send | a **screenshot you pick** yourself, re-encoded on your device so photo metadata and location are removed; and, **only if you tick the box**, the recent reIS errors and warnings from this session, with link parameters, email addresses, long numbers and coordinates already blanked out, plus platform, OS version, language and sync status. **Not linked to the install identifier.** |
| In-app survey, event RSVP | you answer / RSVP | the same random install identifier |
| Society post view or click | you open one | a post id |
| Map event opened | you open an event on the campus map | that event's id and nothing else — a counter on the event, with no identifier of yours attached |
| Map used for 3 seconds | at most once a day, after three seconds on the map | the random install identifier and the fixed `map_dwell_3s` label |
| eduroam network configured | the app itself saves the eduroam network (phone) | the random install identifier and the fixed `eduroam_wifi_configured` label |
| eduroam profile handed over | a profile is prepared for you to install (Mac, Windows) | the random install identifier and the fixed `eduroam_profile_delivered` label. We cannot see whether you go on to install it |
<!-- END generated:flows -->

In the Firefox extension each of these is optional and Firefox asks you for it:
the usage count and counters follow the technical-data switch in `about:addons`,
and a report asks for consent when you press send.

Nothing else. Feedback is read by the developers and passed to nobody. Report
attachments are deleted **90 days** after the report, or as soon as it is
resolved, whichever comes first.

**Your network address is not recorded** — this version writes straight to the
database, which cannot see your connection. Versions released before September
2026 store a salted hash of it for up to an hour to limit the form; never the
address, never beside your message. That component goes when those versions do.

*Lawful basis: legitimate interest, GDPR Art. 6(1)(f) — knowing the project is
used, and fixing what you report. Report attachments: your consent, Art. 6(1)(a),
given by adding them; withdraw it by writing to us and we delete them.*

## Who else reIS talks to

**IS Mendelu** receives your academic data, authenticated as you — it is the
university's own system and the only recipient of it. **jsDelivr** serves public
course-difficulty statistics; no identifier is sent, though the set of subjects
requested does reveal which courses you take. **Supabase** hosts reIS's own
database — infrastructure, not a recipient doing anything of its own.

We do **not** sell or trade your personal information, and transfer it to no one
else.

## Permissions

**Android:** internet; notifications (so a download can say it finished); Wi-Fi
state, only for optional one-tap eduroam, where Android's own dialog saves the
network. **iOS:** the camera, only if you choose to take a photo to attach to a
problem report — iOS asks you first, and the photo goes into the report form
like any other picture. **Neither app requests location** — the campus map shows
the campus, not you.

## Your control

Sign out to delete the token and cookies. Uninstall to delete everything local.
For feedback you sent, and anything attached to it, write to the address below
and we will delete it; the daily-count rows hold nothing that identifies you.

## Changes

We may update this policy; changes appear here with a new date. Google Drive
backup, Outlook calendar sync, WebISKAM, library study-room booking, AI syllabus
comparison and automatic error reporting have all been removed from reIS, along
with everything they sent.

## Contact

`reis.mendelu@gmail.com`
