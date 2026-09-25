# Privacy Policy for reIS

**Last Updated: September 25, 2026**

## Introduction
reIS ("we", "our", or "us") is a Chrome extension designed to modernize and enhance the user experience of the Mendel University Information System (IS Mendelu). We are committed to protecting your privacy and ensuring the security of your data.

## Data Collection
We collect the following information:

### 1. Academic Data (Local Only)
We fetch and store the following information directly from MENDELU services to your device:
- **Student Information**: Name, personal number (UIC), and study details.
- **Academic Data**: Schedules, grades, exam dates, success rates, and course materials.
- **Authentication Data**: Session cookies required to make authenticated requests to IS Mendelu on your behalf.

This data is stored **locally on your device** using highly efficient storage (IndexedDB) and is **never** transmitted to our servers.

There is no longer any exception to that. Library study-room booking — the one feature that ever relayed your name, university email and student ID onwards — was removed in September 2026, together with the server route that carried it.

### 2. Anonymous Usage Analytics
We collect anonymous usage data to improve the extension:
- **Interaction Data**: Clicks on notifications and views of the notification feed.
- **Map Event Views**: When you open a society event on the campus map, a counter on that event is incremented. The request carries **the event's id and nothing else** — no identifier of yours, not even the random install identifier described in section 3.
- **Feature Counters**: Two things are counted, each as one labelled event per installation per day carrying the random install identifier from section 3 and nothing else: that you spent **at least three seconds** on the campus map, and that you **completed the eduroam Wi-Fi setup** (recorded separately for "the app configured the network itself" and "the profile was handed over for you to install"). No event ids, no room or building names, no timings beyond the three-second threshold, and nothing about what you were looking at.
- **Purpose**: To rank relevance of student association notifications, and to know whether the map and the eduroam setup are actually used.
- **Privacy**: This data is **not linked** to your identity, IS credentials, or personal content.

### 3. Daily Usage & NPS Feedback
To understand how actively reIS is used, we record:
- **Daily Usage**: Each day you open reIS, a **random identifier generated on your device** is sent to our Supabase backend to record one usage event. This identifier is a random UUID created the first time you use the app and stored locally. It is **not derived from your student ID, your name, or anything else about you**, and it cannot be linked back to you. Since September 2026 the event also carries two group labels: your faculty and the platform (extension, iOS, Android or web). These describe a group of thousands of installs, not you; nothing else about the event changed.
- **NPS Rating (Voluntary)**: Once per semester you may be shown a satisfaction prompt. If you choose to rate, the same random identifier and your rating are sent. You can dismiss the prompt without sending anything.

**What this means for our numbers**: because the identifier belongs to an installation rather than to a person, these figures count **installations, not people**. If you use reIS on a phone and a laptop, you are counted twice.

**Previously**: until August 2026 these events were keyed on a SHA-256 hash of your student ID. We described that as irreversible. That was wrong — MENDELU student IDs are six or seven digits, so the hash can be reversed by brute force in seconds, which made it a recoverable identifier. We have replaced it in the app, and we have irreversibly re-keyed every historical row: each old hash was passed through HMAC-SHA256 under a random key that was generated for that one operation and immediately discarded. The original hashes cannot be recovered by anyone, including us. We verified this by brute-forcing the entire six- and seven-digit student-ID space against the stored values: zero matches.

### 4. User Feedback (Voluntary)
If you use the built-in "Report Bug / Feedback" feature, the following data is sent to our support channel:
- **Content**: The subject/title, the category you select (bug, idea, or other), the message, and contact details you explicitly provide.
- **Technical Context**: Extension version, browser name and version, viewport size, and the current in-app screen (e.g. `calendar`, `exams`, `settings` — an app view name, not a URL or page address) to help debug issues.
- **Attachments (Optional, only what you add)**: You may attach a **screenshot you pick yourself**. It is re-encoded on your device before sending, which removes photo metadata including location. You may also tick **"Attach technical details"** — it is unticked by default — to include the recent reIS errors and warnings from this session, which the form shows you first and lets you remove line by line. They are cleaned before they are even kept in memory: link parameters, email addresses, runs of five or more digits and coordinates are blanked out, only the first line of each message is kept, and no stack trace is included. The details also carry the platform, operating system version, app language, whether you were online, and the sync status of your timetable and exams as flags and counts — never their content. Attachments are **not linked** to the random install identifier from section 3. Nothing about an error is ever sent unless you add it to a report and press send.
- **Attachment retention**: Attachments are deleted **90 days** after the report, or as soon as we mark the report resolved, whichever comes first. The lawful basis for them is your consent (GDPR Art. 6(1)(a)), which you give by adding them and can withdraw by writing to us.
- **Storage**: Suggestions are stored in reIS's own Supabase project. Read access is restricted by a database policy to signed-in accounts holding the `reis_admin` role — in practice the small maintainer team. No other account, and no anonymous visitor, can read them.
- **Abuse Prevention**: Current versions write straight to the database, which cannot see your network address, so none is recorded; the form is rate-limited by browser name and version instead. Versions released before September 2026 keep a salted SHA-256 hash of the sending IP address for up to an hour to rate-limit the form — never the raw address, and never beside your message. That path goes when those versions do.

## Data Storage & Security
- **Local Storage**: Your sensitive academic data and credentials remain on your device.
- **Encryption**: Data stored locally is encrypted where supported by the browser.
- **No Third-Party Sales**: We do not sell, trade, or transfer your personally identifiable information to outside parties.

## Third-Party Access

reIS contacts the following services. **IS Mendelu is the only one that receives your academic data**, and only because it is the university's own system. No other service on this list receives it, under any feature. The two that once did — Anthropic, for the Erasmus syllabus comparison, and Microsoft Bookings, for library study-room booking — were removed in September 2026 along with both features. jsDelivr receives no identifier, but the set of subjects requested does reveal which courses you are enrolled in.

**Always:**
1. **IS Mendelu** (`is.mendelu.cz`) — fetches your academic data, authenticated by you.
2. **Supabase** (`*.supabase.co`) — reIS's own backend: public notifications, society events and their attendance counts, anonymous usage events, and feedback you submit, with any attachment you added to it. Different records carry different keys. The daily usage count, the in-app survey and event RSVPs use the random installation identifier described above; society view/click counters carry only a post row id. A submitted suggestion carries no identifier we generate — but if you fill in the optional contact field, it carries whatever you typed there, because asking us to reply is what that field is for.
3. **jsDelivr** (`cdn.jsdelivr.net`) — static subject-difficulty data. No identifier is sent, but the set of subjects requested does reveal to the CDN which courses you are enrolled in.
4. **OpenStreetMap** — campus map tiles. The request identifies reIS by name, which their tile usage policy requires; it carries nothing about you.

**Only when you use the relevant feature:**
5. **Erasmus HEI directory** (`hei.api.uni-foundation.eu`) — a public list of partner universities. Nothing about you is sent.
6. **Photon** (`photon.komoot.io`) — venue search, used only by student-society administrators when creating an event.

**Links you open yourself** (Teams, Outlook, geteduroam, society websites) are handed to your browser or the relevant app. reIS makes no background request to them.

## User Control
You have full control over your data:
- **Access**: You can view all data displayed by the extension within its interface.
- **Deletion**: You can remove all locally stored data by uninstalling the extension or clearing the extension's storage in your browser settings.

## Changes to This Policy
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## Contact Us
If you have any questions about this Privacy Policy, please contact us at:
`reis.mendelu@gmail.com`
