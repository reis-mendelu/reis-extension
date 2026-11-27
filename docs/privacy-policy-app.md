# Privacy Policy for reIS

**Last Updated: 18 November 2026**

reIS is a student-built project that simplifies the Mendel University in Brno
Information System (IS Mendelu). It is a browser extension (Chrome, Edge,
Firefox) and a mobile app (Android, iPhone, iPad). It is not an official
application of Mendel University.

## Your academic data stays on your device

Your name, personal number, study details, timetable, grades, assessment, exam
dates, courses, materials and submission folders are fetched from MENDELU using
your own session — the way your browser would — and kept on your device.
**None of it reaches us, apart from group labels on the daily count below — your school, your
faculty and your study programme's base code. We run no server that holds it.** It moves only between
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
| Daily count | once a day | a random install identifier — a UUID that stays the same on this installation and is not derived from you; your name, student number or IS account are never sent with it. Counts **installs, not people**, plus school (e.g. MENDELU), faculty, study programme (e.g. B-OI), platform and app version (e.g. 5.4.1) as group labels. The feature counters below carry the same identifier, so in our database all of these records, on any day, can be matched to one another and to these labels per installation. Novinky questions do not. |
| Feedback | you press send | your message, any contact detail you type, the screen name, app version, browser, window size, platform and OS version (no device model), and the school whose IS you sent it from (e.g. MENDELU) |
| Report attachments | only what you add to a report, when you press send | a **screenshot you pick** yourself, re-encoded on your device so photo metadata and location are removed; and, **only if you choose it** (tick the box, or press *Send with technical details* on a bug report), the recent reIS errors and warnings from this session, with link parameters, email addresses, long numbers and coordinates already blanked out, plus platform, OS version, language and sync status. **Not linked to the install identifier.** |
| Society post view or click | you open one | a post id |
| Map event opened | you open an event on the campus map | that event's id and nothing else — a counter on the event, with no identifier of yours attached |
| Novinky question seen or answered | a question from reIS is on your screen in Novinky, or you tap one of its buttons | that question's id and which button you tapped — a counter on the question, with no identifier of yours attached. Your device remembers that it answered; we cannot tell who did |
| Map used for 3 seconds | at most once a day, after three seconds on the map | the random install identifier, the school and the fixed `map_dwell_3s` label |
| eduroam network configured | the app itself saves the eduroam network (phone) | the random install identifier, the school and the fixed `eduroam_wifi_configured` label |
| eduroam profile handed over | a profile is prepared for you to install (Mac, Windows) | the random install identifier, the school and the fixed `eduroam_profile_delivered` label. We cannot see whether you go on to install it |
| Week view used | when the calendar shows the week (phone, iPad), once per app session; stored as one row per install per day | the random install identifier, the school and the fixed `calendar_week_view` label |
| Screen opened | when the calendar, Zkoušky, Předměty, Studijní plán, Jídelníček, search, Vývěska, Novinky, Doklady, ISIC, the library card on the map or Stáže is shown, once per app session (again only if a send fails); stored as one row per install, per screen, per day | the random install identifier, the school and one fixed label naming the screen (`screen_calendar`, `screen_subjects`, `screen_menu`, `screen_search`, `screen_bulletin`, `screen_notifications`, `screen_internships`, `screen_exams`, `screen_study_plan`, `screen_documents`, `screen_isic`, `screen_library`) — nothing about what was on it, what you searched for or how long you stayed |
| Study room booked | you book a study room from the library card on the map (mobile app), once per app session; stored as one row per install per day | the random install identifier, the school and the fixed `library_booking_made` label. We never see which room, which hours or any booking detail, and the booking itself goes from your phone to the library, not through us |
| Partner programme opened | you tap the card of a partner programme in Stáže (today only "Cesta s EY"), once per app session; stored as one row per install per day | the random install identifier, the school and a fixed label naming the programme (`internship_click_ey`). We count how many installs tapped, which the partner is told as a number; we never tell the partner who, and we cannot see what you do on its website |
| New version opened | you tap "Nová verze reISu" in Novinky (mobile app), once per app session; stored as one row per install per day | the random install identifier, the school and the fixed `app_update_opened` label. We cannot see whether you go on to update |
| Study link opened | you tap one of the links under Předměty that are shown only to students of the faculties and programmes reIS has chosen (today the "Studijní opory" link to mendelu.app, and the Discord server of your programme for Otevřená informatika and Administrace IS/ICT), once per app session; stored as one row per install per day | the random install identifier, the school and a fixed label naming the link (`study_aids_click_mendelu_app`, `study_aids_click_discord_b_oi`, `study_aids_click_discord_b_aii`). We count how many installs tapped, which whoever runs the site may be told as a number; we never tell them who, and we cannot see what you do on the website or on Discord |
| reIS in Claude guide opened | you open the guide from the "reIS v Claude" row in Novinky (browser extension, shown only to students of the programmes it launches to), once per app session; stored as one row per install per day | the random install identifier, the school and the fixed `reis_for_claude_guide_opened` label. We cannot see whether you go on to install it, or anything you ask Claude |
| Fixed version explained | reIS marked your version as broken by a change in IS and the mobile app shows the window explaining it (at most twice), or you tap its Update button or the one on an empty Předměty or Zkoušky, once per app session; stored as one row per install per day | the random install identifier, the school and one fixed label (`critical_update_shown`, `critical_update_opened`). We cannot see whether you go on to update |
| Library study-room booking (mobile app only) | you book or cancel a study room | your name, MENDELU e-mail, student number and faculty code, sent from your device straight to the library's Microsoft Bookings (MENDELU's tenant), never through reIS |
| Checking for a newer version (mobile app only) | the app starts or you return to it | iPhone and iPad: reIS's app id, to Apple's public App Store lookup. Android: the Play Store app on your phone is asked. Nothing about you; the store sees your device's IP address, as it does for any app |
<!-- END generated:flows -->

Which partner company you are shown, if any, is decided on your device from your
faculty and study programme. Partners never receive anything about you; they see
only aggregate counts of views, clicks and map views for their own events, and,
for a programme shown under Stáže, how many installs opened it. The study-aids
link under Předměty is shown to the faculties and programmes reIS chooses, again
decided on your device; its author is told only how many installs tapped it.

In the Firefox extension each of these is optional and Firefox asks you for it:
the usage count and counters follow the technical-data switch in `about:addons`,
and a report asks for consent when you press send.

Nothing else. Feedback is read by the developers and passed to nobody. Report
attachments are kept for **2 years** after the report, also once it is
resolved, and then deleted automatically; we delete them sooner when you ask.

**Your network address is not recorded** — this version writes straight to the
database, which cannot see your connection. Versions released before September
2026 store a salted hash of it for up to an hour to limit the form; never the
address, never beside your message. That component goes when those versions do.

Extension versions up to 5.4.1 also show a satisfaction rating once a semester.
If you rate, your rating is sent with the same random install identifier as the
daily count. Current versions ask in Novinky instead, without the identifier, and
the rating goes when those versions do.

*Lawful basis: legitimate interest, GDPR Art. 6(1)(f) — knowing the project is
used, and fixing what you report. Report attachments: your consent, Art. 6(1)(a),
given by adding them; withdraw it by writing to us and we delete them.*

## Who else reIS talks to

**IS Mendelu** receives your academic data, authenticated as you — it is the
university's own system and the only recipient of it. **jsDelivr** serves public
course-difficulty statistics; no identifier is sent, though the set of subjects
requested does reveal which courses you take. **Supabase** hosts reIS's own
database — infrastructure, not a recipient doing anything of its own.

**WebISKAM** (the university's accommodation and canteen system) receives, only
in the mobile app (Android, iPhone, iPad) and only when you ask for your ISIC
balance, a top-up or a dorm payment, the MENDELU sign-in you make on MENDELU's own page — your
password goes to MENDELU, never to reIS. reIS keeps the sign-in encrypted on your
device; while you are signed in the device's own web-cookie store holds it too,
like any browser, and signing out deletes both. The balance and your open dorm
payments (pohledávky) are shown, never stored. To pay one, reIS opens WebISKAM's
own page with its pay dialog up; you confirm it there, and reIS sends no payment. A top-up sends WebISKAM the amount you typed and whether you chose card or
Google Pay, so it can create the payment; it then opens **GoPay**'s payment page
in your device's browser view, and your card or Google Pay details go to GoPay
and never to reIS.

**S-klub Pixie** (`sklubpixie.cz`), the café in budova Z, serves its public
daily menu page, which reIS reads at startup (and again when you return to the
app, if the menu is over ten minutes old) to show the café's lunch in the
Jídelníček and on its map card. The request carries no reIS identifier, sign-in
or academic data; like any web request, it shows S-klub's server your IP address
and app version.

**Microsoft Bookings** (the library's booking system, in MENDELU's Microsoft
tenant) receives, only in the mobile app (Android, iPhone, iPad) and only when you
reserve or cancel a library study room, your name, MENDELU e-mail, student number
and faculty code, which is what the library asks for, plus a short marker ("reIS")
so the librarians can tell the booking came from the app. The request goes from
your device straight to the library's booking page, never through reIS, and
Microsoft e-mails you the confirmation or the cancellation. The app keeps the
booking's cancellation key and a calendar entry on your device only. Looking at
which rooms are free sends the room and the dates, nothing about you.

We do **not** sell or trade your personal information, and transfer it to no one
else.

## Permissions

**Android:** internet; notifications (what is new in Novinky — a new exam
date, new points, a new submission box, society events and school notices,
which you can switch off in Nastavení — reminders of your exams and deadlines,
and a finished download); network state, so the background check below runs
only while the phone is online; running at startup and keeping the device awake
briefly, which come with the same notifications library; Wi-Fi state, only for
optional one-tap eduroam, where Android's own dialog saves the network.

**Android background check:** at most every 15 minutes (less often when the
phone saves battery), while reIS is closed and the phone is online, the app asks IS Mendelu — with the sign-in you already gave
it, exactly as when you open it — for new exam terms, submission boxes and
points, and shows what is new as a notification. Nothing it reads is sent
anywhere else. Switching reIS notifications off in the phone's settings, or
signing out, stops it.

**iOS:** the camera, only if you choose to take a photo — to attach to a problem
report, where the photo goes into the report form like any other picture, or, on
an iPad, to put on a page of your notes, where it stays on the device with your
ink. iOS asks you first. Notifications, for the same Novinky news and exam
reminders as on Android, asked once you are registered for an exam.

Notifications are made on the phone from what reIS already has there; nothing
is sent anywhere to show them.

**Neither app requests location** — the campus map shows the campus, not you.

## Your control

Sign out to delete the token and cookies. Uninstall to delete everything local.
For feedback you sent, and anything attached to it, write to the address below
and we will delete it; the daily-count rows hold nothing that identifies you.

## Changes

We may update this policy; changes appear here with a new date. Google Drive
backup, Outlook calendar sync, the earlier WebISKAM integration (dorm, meals and
the rest), AI syllabus comparison and automatic error reporting have all been
removed from reIS, along with everything they sent. In October 2026 WebISKAM came
back for one thing only — the ISIC balance and its top-up, described above; since
November 2026 that row also shows open dorm payments and opens WebISKAM's page to
pay one. Library study-room booking, removed in September 2026, returned in the
mobile app, described above.

## Contact

`reis.mendelu@gmail.com`
