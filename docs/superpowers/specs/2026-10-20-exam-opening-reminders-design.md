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
  terms they may register for (`cannotRegister` terms are skipped). It is
  **scheduled for 1 hour before** registration opens, in Prague time whatever the
  phone's zone. Delivery can run late: it is an inexact notification
  (`isExactNotification: false`), so Android 12+ never asks for "Alarms &
  reminders". No settings.
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
- **Sign-out.** Pending and delivered exam reminders are removed, and nothing more
  is scheduled, so the next person on the device sees none of them.
- **Permission.** Asked the first time the student opens Zkoušky while a reminder
  is due. It is never asked at launch.

## How
- `src/utils/examOpeningReminders.ts`: pure, takes `(exams, now, language,
  { includeDue })` and returns
  `{ id, key, subjectName, sectionName, opensAtClock, opensAt, fireAt }[]`.
  `opensAtClock` is IS's own "13:00" for the text; `opensAt`/`fireAt` are
  absolute instants (IS times are Prague wall-clock). The `id` is a stable hash
  of section and opening, kept below 10⁹ so it never meets the záznamník's ids
  (epoch seconds). By default only reminders whose `fireAt` is still ahead are
  returned; with `includeDue`, also those past `fireAt` whose opening is still
  ahead.
- `src/mobile/examReminders.ts`, phone only:
  - `reconcileExamReminders` reads pending notifications tagged
    `extra.kind = 'exam-opening'`. It keeps every one `includeDue` still lists, so
    a reminder delivered late is not cancelled before it shows, and cancels the
    rest (the student registered, the date moved, the opening passed). It
    schedules the missing ones on the Android channel `reis-exam-openings`, only
    when permission is granted. It does nothing while the exam list is empty and
    not yet loaded (`exams.status !== 'success'`): at boot that emptiness is
    IndexedDB still loading, not "no exams".
  - `installExamReminders` reconciles whenever `exams.data` changes or the exam
    load succeeds. It asks for permission (state `prompt`, a reminder due) when
    `mobileTab` becomes `exams`, or when the exams arrive while on it.
  - `clearExamReminders` is the sign-out cleanup, registered in
    `capacitor/main.capacitor.tsx`.
  - Taps: `src/mobile/notificationTaps.ts` owns the one tap listener for every
    kind (a cold-start tap reaches only the first listener) and calls
    `openExamsFromNotification`. Installed from `capacitor/startApp.ts` after
    the demo return.
- `retireSocietyFeatures` cancels and clears from the tray only notifications
  of no current kind (`exam-opening`, `zaznamnik-new-points`), so neither the
  one-time cleanup nor its retry can wipe today's notifications.
- `societyEventsStayReduced.test.ts` keeps banning `LocalNotifications.schedule`
  everywhere except `src/mobile/examReminders.ts` and the záznamník's
  `src/mobile/zaznamnikNotifications.ts`. Society reminders stay gone.

## Privacy
Nothing leaves the device. The reminders are built from exam data already on the
phone. `POST_NOTIFICATIONS` is already declared. Only the note in
`privacy/disclosures.ts` that said the plugin would be removed changes.

## Limits
The phone learns about new or moved dates only when it syncs. A term added while
the app stays closed gets no reminder. A section whose earliest opening is under
an hour away gets no reminder for its later terms until the next sync after that
opening. A pending reminder keeps the language it was scheduled in.