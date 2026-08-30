# Privacy Policy for reIS

**Last Updated: August 9, 2026**

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

The one exception is the library study-room booking, and only if you use it: the booking dialog pre-fills your name, university email and student ID from this local data, and when you confirm, those three fields are relayed through reIS's server to the library's booking system. They are passed through, never stored, and nothing is sent unless you press the button. See *Third-Party Access* below.

### 2. Anonymous Usage Analytics
We collect anonymous usage data to improve the extension:
- **Interaction Data**: Clicks on notifications and views of the notification feed.
- **Purpose**: To rank relevance of student association notifications.
- **Privacy**: This data is **not linked** to your identity, IS credentials, or personal content.

### 3. Daily Usage & NPS Feedback
To understand how actively reIS is used, we record:
- **Daily Usage**: Each day you open reIS, a **random identifier generated on your device** is sent to our Supabase backend to record one usage event. This identifier is a random UUID created the first time you use the app and stored locally. It is **not derived from your student ID, your name, or anything else about you**, and it cannot be linked back to you.
- **NPS Rating (Voluntary)**: Once per semester you may be shown a satisfaction prompt. If you choose to rate, the same random identifier and your rating are sent. You can dismiss the prompt without sending anything.

**What this means for our numbers**: because the identifier belongs to an installation rather than to a person, these figures count **installations, not people**. If you use reIS on a phone and a laptop, you are counted twice.

**Previously**: until August 2026 these events were keyed on a SHA-256 hash of your student ID. We described that as irreversible. That was wrong — MENDELU student IDs are six or seven digits, so the hash can be reversed by brute force in seconds, which made it a recoverable identifier. We have replaced it in the app, and we have irreversibly re-keyed every historical row: each old hash was passed through HMAC-SHA256 under a random key that was generated for that one operation and immediately discarded. The original hashes cannot be recovered by anyone, including us. We verified this by brute-forcing the entire six- and seven-digit student-ID space against the stored values: zero matches.

### 4. User Feedback (Voluntary)
If you use the built-in "Report Bug / Feedback" feature, the following data is sent to our support channel:
- **Content**: The subject/title, the category you select (bug, idea, or other), the message, and contact details you explicitly provide.
- **Technical Context**: Extension version, browser name and version, viewport size, and the current in-app screen (e.g. `calendar`, `exams`, `settings` — an app view name, not a URL or page address) to help debug issues.
- **Storage**: Suggestions are stored in reIS's own Supabase project. Read access is restricted by a database policy to signed-in accounts holding the `reis_admin` role — in practice the small maintainer team. No other account, and no anonymous visitor, can read them.
- **Abuse Prevention**: To limit abuse of the suggestion form, a salted SHA-256 hash of the sending IP address is kept only to rate-limit further submissions. It is used for at most one hour, and is deleted as soon as the next suggestion is submitted (submissions are infrequent, so in practice a hash can persist longer than an hour before that cleanup runs — it is simply never *used* past the one-hour window). The raw IP is never stored.

### 5. Automatic Error Reporting
When an unhandled error or warning occurs in the extension, a sanitized diagnostic report is automatically sent to our Supabase backend so we can detect and fix bugs.
- **What is sent**: Error type, error message string, file path and line number, extension version, browser name and version, a sanitized excerpt of the JavaScript stack trace (top frames, run through the same redaction regex as the message), a client-side timestamp of when the error fired, and an anonymous per-session identifier.
- **About the session identifier**: A random UUID generated when the extension iframe loads and held only in memory for that browser tab. It is **not persisted** to disk, **not synced** across devices, and **regenerated every page load**. Its sole purpose is to let us tell apart "one user retrying the same broken request 30 times" from "30 different users each hit a real bug once." It cannot be linked back to your account or browser across sessions.
- **What is never sent**: Your name, your UIC / student ID or any hash of it, session cookies, any data fetched from IS Mendelu (grades, schedules, exam dates, course materials), and any content stored in IndexedDB.
- **Identity**: Reports are **not linked** to any individual user identity.
- **Lawful Basis**: Legitimate interest under GDPR Art. 6(1)(f) — improving extension stability and fixing bugs.

## Data Storage & Security
- **Local Storage**: Your sensitive academic data and credentials remain on your device.
- **Encryption**: Data stored locally is encrypted where supported by the browser.
- **No Third-Party Sales**: We do not sell, trade, or transfer your personally identifiable information to outside parties.

## Third-Party Access

reIS contacts the following services. **IS Mendelu is the only one that receives your academic data as a matter of course**, and only because it is the university's own system. Three of the optional features below do send specific academic data when — and only when — you use them: Google Drive receives the course files you choose to back up, Anthropic receives the syllabus you upload plus the MENDELU course details, and Microsoft Bookings receives your name, university email and student ID. Each is described in full at its entry. jsDelivr receives no identifier, but the set of subjects requested does reveal which courses you are enrolled in.

**Always:**
1. **IS Mendelu** (`is.mendelu.cz`) — fetches your academic data, authenticated by you.
2. **Supabase** (`*.supabase.co`) — reIS's own backend: public notifications, society events and their attendance counts, anonymous usage events, sanitized error reports, and feedback you submit. Identified only by the random installation identifier described above.
3. **jsDelivr** (`cdn.jsdelivr.net`) — static subject-difficulty data. No identifier is sent, but the set of subjects requested does reveal to the CDN which courses you are enrolled in.
4. **OpenStreetMap** — campus map tiles.

**Only when you use the relevant feature:**
5. **Google** (`googleapis.com`, `google.com`) — if you enable Drive backup, your IS course files are copied to **your own** Google Drive. The permission requested is `drive.file`, which grants access only to files reIS itself creates.
6. **Microsoft Bookings** (`bookings.cloud.microsoft`, via reIS's server) — only if you book a library study room. The **name, university email address and student ID** you confirm in the booking dialog are passed on, because the library's system requires all three to hold a reservation in your name; the student ID is a required field on the library's own form. reIS keeps none of it and sends nothing at any other time — browsing live room availability transmits nothing about you.
7. **Anthropic** (`anthropic.com`, via reIS's server) — if you use Erasmus syllabus comparison, the **PDF you choose to upload** and the MENDELU course details are sent for analysis. The document this feature asks for is a foreign course **syllabus** — a public course description, not a personal record — and the app says so at the point you pick the file. Nothing is uploaded unless you choose a file.
8. **Erasmus HEI directory** (`hei.api.uni-foundation.eu`) — a public list of partner universities. Nothing about you is sent.
9. **Photon** (`photon.komoot.io`) — venue search, used only by student-society administrators when creating an event.

**Links you open yourself** (Teams, Outlook, geteduroam, society websites) are handed to your browser or the relevant app. reIS makes no background request to them.

## User Control
You have full control over your data:
- **Access**: You can view all data displayed by the extension within its interface.
- **Error Reporting Opt-Out**: You can disable automatic error reporting at any time via the extension's profile/settings panel.
- **Deletion**: You can remove all locally stored data by uninstalling the extension or clearing the extension's storage in your browser settings.

## Changes to This Policy
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## Contact Us
If you have any questions about this Privacy Policy, please contact us at:
`reis.mendelu@gmail.com`
