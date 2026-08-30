import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import type { PlannedReminder } from './plan';
import type { PermissionState } from '@capacitor/core';

// Capacitor's own type, imported rather than restated so the four states cannot
// drift apart. `import type` is erased at compile time, so this module still
// loads on hosts with no Capacitor runtime. `prompt-with-rationale` is the
// Android state after a first refusal; an earlier hand-written union left it
// out and cast it away, so it fell through every branch — the student was never
// asked again and nothing was ever scheduled.
export type ReminderPermission = PermissionState;

/** Both prompt states mean "not answered yet" — ask. */
function shouldAsk(p: ReminderPermission): boolean {
  return p === 'prompt' || p === 'prompt-with-rationale';
}

export interface PendingReminder {
  id: number;
  at: number;
}

export interface ReminderDeps {
  /** False off Capacitor: neither the extension nor the dev webapp can post these. */
  isSupported(): boolean;
  checkPermission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  listPending(): Promise<PendingReminder[]>;
  schedule(reminders: PlannedReminder[]): Promise<void>;
  cancel(ids: number[]): Promise<void>;
}

/**
 * Reconciles the device's pending notifications against what should exist.
 *
 * Written as a diff rather than "cancel everything and reschedule" for two
 * reasons: rescheduling an unchanged notification re-posts it on some Android
 * builds, and a full teardown leaves a window in which a reminder due in the
 * next second is simply lost.
 *
 * Cancelling deliberately runs before (and independently of) the permission
 * check: a student who un-RSVPs, or who revoked notifications, must still stop
 * being pinged about events they backed out of.
 *
 * Never throws. A reminder is a courtesy; it must not be able to take down the
 * event load that triggered it.
 */
export function syncReminders(
  planned: PlannedReminder[],
  deps: ReminderDeps = capacitorReminderDeps()
): Promise<void> {
  // Callers fire this with `void` on every RSVP change, so two runs can overlap
  // and the slower one lands last — an older plan re-scheduling a reminder the
  // newer, emptier plan had just cancelled. Chaining makes the last plan handed
  // in the last one applied, which is the only ordering that is ever correct.
  queue = queue.then(() => reconcile(planned, deps));
  return queue;
}

/** Serialises `syncReminders`; never rejects, so one failure cannot wedge it. */
let queue: Promise<void> = Promise.resolve();

/** Test seam: drop the pending chain so one test cannot serialise into the next. */
export function resetReminderQueue(): void {
  queue = Promise.resolve();
}

async function reconcile(planned: PlannedReminder[], deps: ReminderDeps): Promise<void> {
  if (!deps.isSupported()) return;

  try {
    const pending = await deps.listPending();
    const wanted = new Map(planned.map((r) => [r.id, r]));

    const stale = pending.filter((p) => {
      const w = wanted.get(p.id);
      // Gone from the plan, or the event moved — either way the pending one is
      // wrong and has to go before the replacement is posted.
      return !w || w.at !== p.at;
    });
    if (stale.length > 0) await deps.cancel(stale.map((p) => p.id));

    const staleIds = new Set(stale.map((p) => p.id));
    const alreadyGood = new Set(pending.filter((p) => !staleIds.has(p.id)).map((p) => p.id));
    const toSchedule = planned.filter((r) => !alreadyGood.has(r.id));
    if (toSchedule.length === 0) return;

    // The prompt is earned rather than sprung: it appears the first time the
    // student has actually asked to be reminded of something, not on a cold
    // boot before they have interacted with a single event.
    let permission = await deps.checkPermission();
    if (shouldAsk(permission)) permission = await deps.requestPermission();
    if (permission !== 'granted') return;

    await deps.schedule(toSchedule);
  } catch (err) {
    logError('EventReminders.sync', err);
  }
}

/** The real Capacitor plugin, imported lazily so no other host pays for it. */
export function capacitorReminderDeps(): ReminderDeps {
  const load = () => import('@capacitor/local-notifications');
  return {
    isSupported: () => getPlatform().kind === 'capacitor',
    checkPermission: async () => {
      const { LocalNotifications } = await load();
      return (await LocalNotifications.checkPermissions()).display as ReminderPermission;
    },
    requestPermission: async () => {
      const { LocalNotifications } = await load();
      return (await LocalNotifications.requestPermissions()).display as ReminderPermission;
    },
    listPending: async () => {
      const { LocalNotifications } = await load();
      const { notifications } = await LocalNotifications.getPending();
      return notifications
        .map((n) => ({ id: n.id, at: n.schedule?.at ? new Date(n.schedule.at).getTime() : 0 }))
        .filter((n) => n.at > 0);
    },
    schedule: async (reminders) => {
      const { LocalNotifications } = await load();
      await LocalNotifications.schedule({
        notifications: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          // Inexact on purpose. Exact alarms need SCHEDULE_EXACT_ALARM, which
          // Android 12+ leaves off by default — the plugin then warns and
          // downgrades anyway, so depending on it buys nothing. Two hours of
          // notice does not need minute precision. allowWhileIdle still gets
          // it past Doze, which inexact alone would not.
          isExactNotification: false,
          schedule: { at: new Date(r.at), allowWhileIdle: true },
          // Round-trips the event id so a tapped notification can open the
          // right event rather than just the app.
          extra: { eventId: r.eventId },
        })),
      });
    },
    cancel: async (ids) => {
      const { LocalNotifications } = await load();
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    },
  };
}
