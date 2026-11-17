import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import type { AppState } from '../store/types';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';
import {
  DEADLINE_REMINDER_KIND,
  deadlineReminders,
  type DeadlineReminderInputs,
} from '../utils/deadlineReminders';

/**
 * Importance 4: these fire with reIS closed, an evening or a day ahead, and are
 * the ones a student must not miss. While reIS is open, iOS still lists them
 * quietly (capacitor.config.ts presentationOptions).
 */
const CHANNEL_ID = 'reis-deadlines';

const inputsOf = (s: AppState): DeadlineReminderInputs => ({
  exams: s.exams.data,
  odevzdavarny: s.odevzdavarny,
  subjects: s.subjects?.data,
  nicknames: s.courseNicknames,
  studyPlan: s.studyPlanDual,
  language: s.language,
});

// Set at sign-out: nothing more is scheduled for a student who has left.
let signedOut = false;
let unsubscribe: (() => void) | null = null;

async function reconcile(): Promise<void> {
  if (signedOut) return;
  const s = useAppStore.getState();
  // At boot the exams are still coming from IndexedDB: an empty list then is
  // not "no exams" (the same guard as the opening reminders).
  if (s.exams.data.length === 0 && s.exams.status !== 'success') return;
  // Nor the boxes, which load on their own: until they have, a pending box
  // reminder is unknown, not stale, and one cancelled after its time could not
  // come back.
  if (s.odevzdavarnyStatus !== 'success') return;
  const now = new Date();
  const wanted = deadlineReminders(inputsOf(s), now);
  // Past its time but before the event, a pending one may just be late (inexact delivery): kept.
  const keep = new Set(deadlineReminders(inputsOf(s), now, { includeDue: true }).map((r) => r.id));
  const ours = (await LocalNotifications.getPending()).notifications.filter(
    (n) => (n.extra as { kind?: unknown } | undefined)?.kind === DEADLINE_REMINDER_KIND
  );
  // Same id, new words (a room changed, a nickname): replaced, not kept.
  const text = new Map(wanted.map((r) => [r.id, `${r.title}\n${r.body}`]));
  const changed = (n: { id: number; title?: string; body?: string }) =>
    text.has(n.id) && text.get(n.id) !== `${n.title}\n${n.body}`;
  const stale = ours.filter((n) => !keep.has(n.id) || changed(n));
  if (stale.length > 0) {
    await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
  }
  const held = new Set(ours.filter((n) => !changed(n)).map((n) => n.id));
  const missing = wanted.filter((r) => !held.has(r.id));
  if (missing.length === 0 || signedOut) return;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  // iOS has no channels; the call rejects there.
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: translate(s.language, 'deadlineReminders.channel'),
      importance: 4,
    });
  }
  await LocalNotifications.schedule({
    notifications: missing.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { at: r.fireAt, allowWhileIdle: true },
      // The plugin defaults this to true and, on Android 12+ without
      // SCHEDULE_EXACT_ALARM, opens "Alarms & reminders" first. A reminder a
      // day ahead needs no exact alarm.
      isExactNotification: false,
      channelId: CHANNEL_ID,
      extra: { kind: DEADLINE_REMINDER_KIND, group: r.group, courseCode: r.courseCode ?? null },
    })),
  });
}

// One at a time: two overlapping reconciles would both see a reminder as missing.
let queue: Promise<void> = Promise.resolve();

/** Makes the phone hold exactly the reminders the data implies. Never throws. */
export function reconcileDeadlineReminders(): Promise<void> {
  queue = queue.then(reconcile).catch((err) => logError('Mobile.reconcileDeadlineReminders', err));
  return queue;
}

/** What the reminders are built from, and whether they may be scheduled. */
const watchedOf = (s: AppState): unknown[] => [
  s.exams.data,
  s.exams.status,
  s.odevzdavarny,
  s.odevzdavarnyStatus,
  s.subjects,
  s.studyPlanDual,
  s.courseNicknames,
  s.language,
  s.systemNotifications,
];

/**
 * "Zítra: zkouška", "přihlašování končí", "odevzdání do zítra" on iOS and
 * Android, scheduled ahead so they arrive with reIS closed. Installed from
 * capacitor/startApp; the extension has the bell only
 * (src/test/guards/desktopHasNoDeadlineReminders.test.ts).
 */
export function installDeadlineReminders(): () => void {
  signedOut = false;
  unsubscribe?.();
  let watched = watchedOf(useAppStore.getState());
  unsubscribe = useAppStore.subscribe((s) => {
    const next = watchedOf(s);
    if (next.every((v, i) => v === watched[i])) return;
    watched = next;
    void reconcileDeadlineReminders();
  });
  void reconcileDeadlineReminders();
  return () => unsubscribe?.();
}

/** Sign-out: the next person on this phone must not be reminded of this student's exams. */
export async function clearDeadlineReminders(): Promise<void> {
  signedOut = true;
  unsubscribe?.();
  unsubscribe = null;
  await queue;
  const isOurs = (n: { extra?: unknown }) =>
    (n.extra as { kind?: unknown } | undefined)?.kind === DEADLINE_REMINDER_KIND;
  const pending = (await LocalNotifications.getPending()).notifications.filter(isOurs);
  if (pending.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  }
  const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications.filter(
    isOurs
  );
  if (delivered.length > 0) {
    await LocalNotifications.removeDeliveredNotifications({ notifications: delivered });
  }
}
