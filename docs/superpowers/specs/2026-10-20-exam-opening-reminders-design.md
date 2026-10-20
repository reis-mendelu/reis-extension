# Exam-opening reminders on the phone

Date: 2026-10-20 · Status: approved

## Why
Students miss the moment exam registration opens, and the good dates are gone
within minutes. Tonda asked for a reminder ("ať mi aplikace pípne, abych
nezapomněla na přihlášení"). The in-app bell already lists openings within 24 h,
but only when the app is open.

## Decisions
- **Who gets one.** For a section the student is **not registered in** (no term,
  no alternative), one reminder for its **earliest future opening** among the
  terms they may register for (`cannotRegister` terms are skipped). It fires
  **exactly 1 hour before** registration opens. No settings.
- **One per section.** Terms that open together share one notification.
- **Where.** iOS + Android system notifications (`@capacitor/local-notifications`,
  already installed). The bell keeps its existing 24 h alert on every platform.
  The **extension gets no system notification**: that would need the new
  `notifications` permission (it already has `alarms`) and store review, and it
  would fire only while the browser runs. This is pinned in `src/test/guards/`.
- **Text.** Title "Za chvíli se otvírá zkouška"; body
  "Ekonometrie 1 – Zkouška · přihlašování v 13:00". Built in the app language
  when scheduled.
- **Tap.** Opens the Zkoušky tab.
- **Permission.** Asked the first time the student opens Zkoušky while a reminder
  is due. It is never asked at launch.

## How
- `src/utils/examOpeningReminders.ts`: pure, takes `(exams, now)` and returns
  `{ id, key, subjectName, sectionName, opensAt, fireAt }[]`. The `id` is a stable
  32-bit hash of section and opening, so a reconcile can tell which reminders
  already exist. Only reminders whose `fireAt` is still ahead are returned.
- `src/mobile/examReminders.ts`, phone only:
  - `reconcileExamReminders` reads pending notifications tagged
    `extra.kind = 'exam-opening'`, cancels the ones no longer wanted (the student
    registered, the date moved), and schedules the missing ones on the Android
    channel `reis-exam-openings`. It schedules only when permission is granted.
  - `installExamReminders` runs a reconcile whenever `exams.data` changes. When
    `mobileTab` becomes `exams` with permission in `prompt` and a reminder due, it
    asks for permission, then reconciles. It also registers the tap listener.
  - Installed from `capacitor/startApp.ts` after the demo return.
- `retireSocietyFeatures` cancels only notifications that are **not** tagged
  `exam-opening`, so the one-time cleanup cannot wipe a new reminder.
- `societyEventsStayReduced.test.ts` keeps banning `LocalNotifications.schedule`
  everywhere except `src/mobile/examReminders.ts`. Society reminders stay gone.

## Privacy
Nothing leaves the device. The reminders are built from exam data already on the
phone. `POST_NOTIFICATIONS` is already declared. Only the note in
`privacy/disclosures.ts` that said the plugin would be removed changes.

## Limits
The phone learns about new or moved dates only when it syncs. A term added while
the app stays closed gets no reminder.