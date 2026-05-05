# Privacy Policy for reIS

**Last Updated: May 5, 2026**

## Introduction
reIS ("we", "our", or "us") is a Chrome extension designed to modernize and enhance the user experience of the Mendel University Information System (IS Mendelu). We are committed to protecting your privacy and ensuring the security of your data.

## Data Collection
We collect the following information:

### 1. Academic Data (Local Only)
We fetch and store the following information directly from the IS Mendelu website to your device:
- **Student Information**: Name, personal number (UIC), and study details.
- **Academic Data**: Schedules, grades, exam dates, success rates, and course materials.
- **Authentication Data**: Session cookies required to make authenticated requests to IS Mendelu on your behalf.

This data is stored **locally on your device** using highly efficient storage (IndexedDB) and is **never** transmitted to our servers.

### 2. Tutoring Matching (reučko)
If you opt in to the peer tutoring feature, the following data is sent to and stored on our Supabase backend:
- **Participation Data**: Your MENDELU student ID, course code, role (tutor or tutee), and academic semester.
- **Dismissals**: Records of tutoring suggestions you have declined, linked to your student ID and course code.
- **Matching**: If an administrator pairs you with another student, both student IDs and the course code are stored. Your matched partner's full name is then retrieved directly from IS Mendelu (not stored in the extension) and displayed to you.

This data is used solely to facilitate tutoring connections. Eligibility (based on your grades and semester) is determined locally on your device and is never sent externally. Participation is entirely voluntary.

### 3. Anonymous Usage Analytics
We collect anonymous usage data to improve the extension:
- **Interaction Data**: Clicks on notifications and views of the notification feed.
- **Purpose**: To rank relevance of student association notifications.
- **Privacy**: This data is **not linked** to your identity, IS credentials, or personal content.

### 4. Daily Usage & NPS Feedback
To understand how actively the extension is used and to improve user experience, we collect:
- **Daily Usage**: Each day you open the extension, a SHA-256 hash of your student ID is sent to our Supabase backend to record a daily active usage event. Your raw student ID is **never transmitted** — only an irreversible hash. No academic data, browsing history, or page content is sent.
- **NPS Rating (Voluntary)**: Once per semester, after a few sessions, you may be shown a satisfaction prompt. If you choose to rate, a hashed student ID and numeric rating are sent to Supabase. You can dismiss the prompt without submitting any data.

This data is used solely for aggregate usage statistics and product improvement. It is **not shared with third parties**.

### 5. User Feedback (Voluntary)
If you use the built-in "Report Bug / Feedback" feature, the following data is sent to our support channel:
- **Content**: The message and contact details you explicitly provide.
- **Technical Context**: Extension version, browser user agent, and screen resolution (to help debug issues).
- **Storage**: This data is processed securely via Discord webhooks for developer review.

### 6. Automatic Error Reporting
When an unhandled error or warning occurs in the extension, a sanitized diagnostic report is automatically sent to our Supabase backend so we can detect and fix bugs.
- **What is sent**: Error type, error message string, file path and line number, extension version, browser name and version.
- **What is never sent**: Your name, your UIC / student ID or any hash of it, session cookies, any data fetched from IS Mendelu (grades, schedules, exam dates, course materials), and any content stored in IndexedDB.
- **Identity**: Reports are **not linked** to any individual user identity.
- **Lawful Basis**: Legitimate interest under GDPR Art. 6(1)(f) — improving extension stability and fixing bugs.

## Data Storage & Security
- **Local Storage**: Your sensitive academic data and credentials remain on your device.
- **Encryption**: Data stored locally is encrypted where supported by the browser.
- **No Third-Party Sales**: We do not sell, trade, or transfer your personally identifiable information to outside parties.

## Third-Party Access
The extension communicates exclusively with:
1.  **IS Mendelu servers** (`*.mendelu.cz`): To fetch your academic data (Authenticated by you).
2.  **Supabase** (`*.supabase.co`): To fetch public notifications, store anonymous interaction stats, manage tutoring participation data if you opt in, and receive sanitized error diagnostic reports.
3.  **Discord** (`discord.com`): To deliver your feedback messages to the developers (only when you submit feedback).

## User Control
You have full control over your data:
- **Access**: You can view all data displayed by the extension within its interface.
- **Tutoring Opt-Out**: You can withdraw from the tutoring feature at any time, which removes your availability record from our servers.
- **Error Reporting Opt-Out**: You can disable automatic error reporting at any time via the extension's profile/settings panel.
- **Deletion**: You can remove all locally stored data by uninstalling the extension or clearing the extension's storage in your browser settings.

## Changes to This Policy
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## Contact Us
If you have any questions about this Privacy Policy, please contact us at:
`reis.mendelu@gmail.com`
