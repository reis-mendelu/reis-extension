# Plan: exam-opening reminders

Spec: `docs/superpowers/specs/2026-10-20-exam-opening-reminders-design.md`

1. **Pure list (test first).** `src/utils/__tests__/examOpeningReminders.test.ts`
   covers:
   - registered sections are skipped;
   - one reminder per section, for the earliest future opening;
   - `cannotRegister` terms are skipped;
   - fire time is 1 h before, and a reminder whose fire time has passed is dropped;
   - the id is stable across calls.

   Then implement `src/utils/examOpeningReminders.ts`.
2. **Scheduler (test first).** `src/mobile/__tests__/examReminders.test.ts` mocks
   `LocalNotifications` and covers:
   - schedules the missing reminders with Czech text on the channel;
   - cancels a stale tagged reminder, leaves untagged ones alone, and does not
     reschedule existing ones;
   - schedules nothing without permission;
   - asks for permission on the Zkoušky tab only when a reminder is due;
   - a tap opens the Zkoušky tab.

   Then implement `src/mobile/examReminders.ts` and install it in `startApp.ts`.
3. **Cleanup.** Test that `retireSocietyFeatures` keeps `exam-opening` reminders.
   Filter the cancel.
4. **Guards.**
   - Narrow `societyEventsStayReduced` to `src/mobile/examReminders.ts`.
   - Add `desktopHasNoExamSystemNotifications.test.ts`: the module is reached
     only from `capacitor/`, and there is no `chrome.notifications`.
5. **i18n and privacy.** Add `examReminders.*` keys (cs/en). Update the
   disclosures note.
6. **Verify.** Run the touched tests, `npm run typecheck`, and the guard and
   privacy tests.