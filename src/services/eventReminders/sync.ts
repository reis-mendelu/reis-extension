import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import { translate } from '../../i18n/translate';
import { devNotifyOverride } from '../../mobile/devNotifyOverride';
import {
  CHANNEL_RSVP,
  CHANNEL_DIGEST,
  type PlannedReminder,
  type PlannedNotification,
} from './plan';
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
  /** Read back so a digest whose content changed under the same id and time
   *  is caught — `''` when the plugin reports none. */
  title: string;
  body: string;
  /** From the `extra.kind` the schedule wrote; none (an older build) is a ping. */
  kind: 'rsvp' | 'digest';
}

export interface SyncOptions {
  /** Leave pending digests as they are: the caller's plan has none to offer
   *  (an unresolved follow list), which is not the same as "cancel them". */
  keepDigests?: boolean;
}

export interface ReminderDeps {
  /** False off Capacitor: neither the extension nor the dev webapp can post these. */
  isSupported(): boolean;
  checkPermission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  /** Android notification channels, created once before the first schedule.
   *  A no-op off Android — iOS has no such concept and the plugin call would
   *  reject. */
  createChannels(): Promise<void>;
  listPending(): Promise<PendingReminder[]>;
  schedule(reminders: PlannedReminder[] | PlannedNotification[]): Promise<void>;
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
  planned: PlannedReminder[] | PlannedNotification[],
  deps: ReminderDeps = capacitorReminderDeps(),
  options: SyncOptions = {}
): Promise<void> {
  // Callers fire this with `void` on every RSVP change, so two runs can overlap
  // and the slower one lands last — an older plan re-scheduling a reminder the
  // newer, emptier plan had just cancelled. Chaining makes the last plan handed
  // in the last one applied, which is the only ordering that is ever correct.
  queue = queue.then(() => reconcile(planned, deps, options));
  return queue;
}

/** Serialises `syncReminders`; never rejects, so one failure cannot wedge it. */
let queue: Promise<void> = Promise.resolve();

/** Test seam: drop the pending chain so one test cannot serialise into the next. */
export function resetReminderQueue(): void {
  queue = Promise.resolve();
}

async function reconcile(
  planned: PlannedReminder[] | PlannedNotification[],
  deps: ReminderDeps,
  options: SyncOptions
): Promise<void> {
  if (!deps.isSupported()) return;

  try {
    const pending = await deps.listPending();
    const wanted = new Map(planned.map((r) => [r.id, r]));

    const stale = pending.filter((p) => {
      if (options.keepDigests && p.kind === 'digest') return false;
      const w = wanted.get(p.id);
      // Gone from the plan, the event moved, or the text changed — any of them
      // makes the pending one wrong, and it has to go before the replacement
      // is posted. The text matters because a digest keeps its id and time
      // when a new event lands or a society is muted; an RSVP ping's text is
      // unchanged by an upgrade, so those are still left alone.
      return !w || w.at !== p.at || w.title !== p.title || w.body !== p.body;
    });
    if (stale.length > 0) await deps.cancel(stale.map((p) => p.id));

    const staleIds = new Set(stale.map((p) => p.id));
    const alreadyGood = new Set(pending.filter((p) => !staleIds.has(p.id)).map((p) => p.id));
    const toSchedule = planned.filter((r) => !alreadyGood.has(r.id));
    if (toSchedule.length === 0) return;

    // Asking is no longer this function's job. Plugin 8.3 prompts from inside
    // schedule() itself, so a sync that ran requestPermission would spring the
    // system dialog on a background reconciliation the student never touched
    // (an app resume, a background fetch). The prompt now belongs only to
    // explicit user actions — the soft-ask, a Profile switch, a first RSVP —
    // via askNotificationPermission. Here we only check: if it isn't granted
    // yet, there's nothing to schedule this pass, and the asking flow will
    // bring reconcile back once it is.
    const permission = await deps.checkPermission();
    if (permission !== 'granted') return;
    await deps.createChannels();
    await deps.schedule(toSchedule);
  } catch (err) {
    logError('EventReminders.sync', err);
  }
}

/**
 * Reads the current permission without ever prompting. For UI that only wants
 * to know what to show (e.g. whether the soft-ask card is still relevant).
 */
export async function readNotificationPermission(
  deps: ReminderDeps = capacitorReminderDeps()
): Promise<ReminderPermission | 'unsupported'> {
  // `?notify=` on the dev webapp: no Capacitor plugin exists there to answer
  // `deps.isSupported()`, so without this the soft-ask card could only ever
  // see 'unsupported' outside a device build. Dead-code-stripped from every
  // shipped build by `devNotifyOverride`'s own `import.meta.env.DEV` gate.
  const forced = devNotifyOverride();
  if (forced) return forced;
  if (!deps.isSupported()) return 'unsupported' as const;
  try {
    return await deps.checkPermission();
  } catch (err) {
    logError('EventReminders.readPermission', err);
    return 'unsupported' as const;
  }
}

/**
 * The only place that may raise the system prompt. Called from explicit user
 * actions — the soft-ask **Zapnout**, a Profile notification switch, a first
 * RSVP — never from `syncReminders`, which plugin 8.3 would otherwise turn
 * into a prompt sprung from a background reconciliation.
 */
export async function askNotificationPermission(
  deps: ReminderDeps = capacitorReminderDeps()
): Promise<ReminderPermission | 'unsupported'> {
  if (!deps.isSupported()) return 'unsupported' as const;
  try {
    const p = await deps.checkPermission();
    return shouldAsk(p) ? await deps.requestPermission() : p;
  } catch (err) {
    logError('EventReminders.askPermission', err);
    return 'unsupported' as const;
  }
}

/** Guards `createChannels` to run its plugin call at most once per process. */
let channelsReady: Promise<void> | null = null;

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
    createChannels: () => {
      // Cached as a promise, not a boolean: two reconciliations racing at
      // boot must not both hit the plugin, and a caller that awaits the
      // second call still waits for the very creation the first kicked off.
      if (!channelsReady) {
        channelsReady = (async () => {
          // iOS has no channel concept; the plugin call would reject there.
          const { Capacitor } = await import('@capacitor/core');
          if (Capacitor.getPlatform() !== 'android') return;
          const { LocalNotifications } = await load();
          // Lazy so this module never statically imports the store — that
          // would be a require cycle (useAppStore -> createRsvpSlice -> this
          // file) that breaks zustand's eager create().
          const { useAppStore } = await import('../../store/useAppStore');
          const lang = useAppStore.getState().language;
          await LocalNotifications.createChannel({
            id: CHANNEL_RSVP,
            name: translate(lang, 'notify.channelRsvp'),
            importance: 4,
          });
          await LocalNotifications.createChannel({
            id: CHANNEL_DIGEST,
            name: translate(lang, 'notify.channelDigest'),
            importance: 3,
          });
        })().catch((err: unknown) => {
          // A transient failure (bridge not ready, plugin hiccup) must not be
          // cached forever — that would leave every later reconcile re-
          // throwing the same rejection and never reaching schedule() again
          // for the rest of the process. Clearing the guard lets the next
          // reconcile retry; rethrowing lets THIS one's own try/catch log it
          // and return without scheduling, same as any other failed step.
          channelsReady = null;
          throw err;
        });
      }
      return channelsReady;
    },
    listPending: async () => {
      const { LocalNotifications } = await load();
      const { notifications } = await LocalNotifications.getPending();
      return notifications
        .map((n): PendingReminder => ({
          id: n.id,
          at: n.schedule?.at ? new Date(n.schedule.at).getTime() : 0,
          // Normalised: a digest with nothing new has body '', and a bridge
          // that drops an empty string must not make it mismatch forever.
          title: n.title ?? '',
          body: n.body ?? '',
          kind: (n.extra as { kind?: unknown } | undefined)?.kind === 'digest' ? 'digest' : 'rsvp',
        }))
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
          // RSVP pings and the digest ring on separate Android channels so a
          // student can mute one without the other.
          channelId: (r as PlannedNotification).channelId ?? CHANNEL_RSVP,
          // Round-trips the event id so a tapped notification can open the
          // right event rather than just the app, plus which kind of
          // notification this was (a digest has no single event to open).
          extra: { eventId: r.eventId, kind: (r as PlannedNotification).kind ?? 'rsvp' },
        })),
      });
    },
    cancel: async (ids) => {
      const { LocalNotifications } = await load();
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    },
  };
}
