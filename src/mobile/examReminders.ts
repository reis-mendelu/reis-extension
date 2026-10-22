import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';
import {
  EXAM_OPENING_KIND,
  examOpeningReminders,
  type ExamOpeningReminder,
} from '../utils/examOpeningReminders';
const CHANNEL_ID = 'reis-exam-openings';

function wanted(includeDue = false): ExamOpeningReminder[] {
  const { exams, language } = useAppStore.getState();
  return examOpeningReminders(exams.data, new Date(), language, { includeDue });
}

// Set at sign-out: nothing more is scheduled for a student who has left.
let signedOut = false;
let unsubscribe: (() => void) | null = null;

async function reconcile(): Promise<void> {
  if (signedOut) return;
  const reminders = wanted();
  const { notifications } = await LocalNotifications.getPending();
  const ours = notifications.filter((n) => n.extra?.kind === EXAM_OPENING_KIND);
  // Past its time but before the opening, a pending reminder may simply not be
  // shown yet (isExactNotification: false lets delivery run late): keep it.
  const keepIds = new Set(wanted(true).map((r) => r.id));
  const stale = ours.filter((n) => !keepIds.has(n.id));
  if (stale.length > 0) {
    await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
  }

  const held = new Set(ours.map((n) => n.id));
  const missing = reminders.filter((r) => !held.has(r.id));
  if (missing.length === 0) return;
  // Asked on the Zkoušky tab, never here: a reconcile runs at boot.
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;

  const { language } = useAppStore.getState();
  // iOS has no channels; the call rejects there.
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: translate(language, 'examReminders.channel'),
      importance: 4,
    });
  }
  await LocalNotifications.schedule({
    notifications: missing.map((r) => ({
      id: r.id,
      title: translate(language, 'examReminders.title'),
      body: translate(language, 'examReminders.body', {
        subject: r.subjectName,
        section: r.sectionName,
        time: r.opensAtClock,
      }),
      schedule: { at: r.fireAt, allowWhileIdle: true },
      // The plugin defaults this to true and, on Android 12+ without
      // SCHEDULE_EXACT_ALARM (stripped in AndroidManifest.xml), opens the
      // "Alarms & reminders" settings screen first. An hour ahead needs no
      // exact alarm.
      isExactNotification: false,
      channelId: CHANNEL_ID,
      extra: { kind: EXAM_OPENING_KIND, key: r.key },
    })),
  });
}

// One at a time: a sync and a tab change can land together, and two
// overlapping reconciles would both see a reminder as missing.
let queue: Promise<void> = Promise.resolve();

/**
 * Makes the phone hold exactly the reminders the exam list implies: schedules
 * the missing ones, cancels the ones that no longer apply (registered since,
 * the date moved), leaves the rest. Never throws.
 */
export function reconcileExamReminders(): Promise<void> {
  queue = queue.then(reconcile).catch((err) => logError('Mobile.reconcileExamReminders', err));
  return queue;
}

/** A tap on the reminder opens Zkoušky; other features' taps are ignored. */
export function openExamsFromNotification(extra: unknown): void {
  if ((extra as { kind?: unknown } | null | undefined)?.kind !== EXAM_OPENING_KIND) return;
  useAppStore.getState().setMobileTab('exams');
}

/** The system prompt, asked where it makes sense: on Zkoušky, with something to remind. */
async function askIfDue(): Promise<void> {
  try {
    if (wanted().length === 0) return;
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'prompt' && display !== 'prompt-with-rationale') return;
    if ((await LocalNotifications.requestPermissions()).display === 'granted') {
      await reconcileExamReminders();
    }
  } catch (err) {
    logError('Mobile.askExamReminderPermission', err);
  }
}

/**
 * "Za chvíli se otvírá zkouška" on iOS and Android — spec
 * docs/superpowers/specs/2026-10-20-exam-opening-reminders-design.md.
 *
 * Phone only, installed from capacitor/startApp. The extension has the bell
 * and no system notification (pinned in src/test/guards).
 */
export function installExamReminders(): () => void {
  signedOut = false;
  unsubscribe?.();
  let exams = useAppStore.getState().exams.data;
  let tab = useAppStore.getState().mobileTab;
  unsubscribe = useAppStore.subscribe((state) => {
    if (state.exams.data !== exams) {
      exams = state.exams.data;
      void reconcileExamReminders();
      // Zkoušky opened before the exams loaded found nothing to ask about.
      if (state.mobileTab === 'exams') void askIfDue();
    }
    if (state.mobileTab !== tab) {
      tab = state.mobileTab;
      if (tab === 'exams') void askIfDue();
    }
  });
  void reconcileExamReminders();
  return () => unsubscribe?.();
}

/**
 * Sign-out: the next person on this phone must not be told about this
 * student's exams. Stops scheduling, cancels what is pending and clears what
 * already sits in the tray — ours only. Registered in capacitor/main.capacitor.
 */
export async function clearExamReminders(): Promise<void> {
  signedOut = true;
  unsubscribe?.();
  unsubscribe = null;
  // Let a reconcile already in flight finish, so it cannot schedule after this.
  await queue;
  const { notifications } = await LocalNotifications.getPending();
  const pending = notifications.filter((n) => n.extra?.kind === EXAM_OPENING_KIND);
  if (pending.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  }
  const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications.filter(
    (n) => n.extra?.kind === EXAM_OPENING_KIND
  );
  if (delivered.length > 0) {
    await LocalNotifications.removeDeliveredNotifications({ notifications: delivered });
  }
}
