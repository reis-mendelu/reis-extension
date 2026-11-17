import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import type { AppState } from '../store/types';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import {
  buildDeadlineAlerts,
  deadlineAlertInputsOf,
  isAlertSeen,
} from '../utils/novinky/buildDeadlineAlerts';
import { buildFeed, feedInputsOf } from '../utils/novinky/buildFeed';
import { planPushes, type PushGroup, type PushKind } from '../utils/novinky/pushPlan';
import { pushRowsOf, pushText } from '../utils/novinky/pushText';

/** Tags ours, so a tap handler or a cleanup never touches another feature's. */
export const NOVINKY_KIND = 'novinky';

/** The 'meta' key holding the row ids already notified, per source (see run). */
export const NOVINKY_NOTIFIED_KEY = 'novinky_notified';

interface Notified {
  alerts?: string[];
  feed?: string[];
}

/**
 * One channel per kind, so a student can mute "Od spolků" alone. Importance 2
 * (low: no sound, no heads-up): these are posted while reIS is open, and the
 * agreed rule is that such a notification goes quietly into the shade. A
 * channel's importance cannot change once created, hence new ids rather than
 * reusing `reis-zaznamnik-points` (importance 4), which install deletes.
 */
const CHANNEL: Record<PushKind, { id: string; name: string }> = {
  terms: { id: 'reis-novinky-terms', name: 'novinkyPush.channelTerms' },
  points: { id: 'reis-novinky-points', name: 'novinkyPush.channelPoints' },
  boxes: { id: 'reis-novinky-boxes', name: 'novinkyPush.channelBoxes' },
  societies: { id: 'reis-novinky-societies', name: 'novinkyPush.channelSocieties' },
};

/** Waits for a sync's pushes to settle, so one sync is one notification per kind. */
const SETTLE_MS = 1500;

// Bumped at sign-out: a run that started for the previous student checks it
// after every await and stops, so it can never post their rows to the next.
let generation = 0;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<void> = Promise.resolve();

const societyName = (s: AppState) => (n: { associationId?: string }) =>
  s.societies[n.associationId || 'admin']?.name ?? translate(s.language, 'notifications.fromReis');

/**
 * Posts what Novinky gained since the last run. Two sources, each recorded
 * from the moment it is ready, so neither arrives later as a backlog: the
 * alert rows once the first sync has settled, the society rows once their feed
 * has loaded. Rows are recorded even while notifications are off, or allowing
 * them later would post everything at once.
 */
async function run(gen: number): Promise<void> {
  const s = useAppStore.getState();
  if (!s.firstSyncSettled) return;
  const alerts = buildDeadlineAlerts(deadlineAlertInputsOf(s));
  const feedReady = s.notifications.status === 'success';
  const rows = pushRowsOf(alerts, feedReady ? buildFeed(feedInputsOf(s)) : [], societyName(s));
  const seen = new Set<string>([
    ...alerts.filter((a) => isAlertSeen(a, s.notifications.seenDeadlineAlertIds)).map((a) => a.id),
    ...s.notifications.readIds,
  ]);
  const before = ((await IndexedDBService.get('meta', NOVINKY_NOTIFIED_KEY)) ?? {}) as Notified;
  if (gen !== generation) return;
  const news = planPushes(
    rows.filter((r) => r.kind !== 'societies'),
    before.alerts,
    seen
  );
  const events = feedReady
    ? planPushes(
        rows.filter((r) => r.kind === 'societies'),
        before.feed,
        seen
      )
    : { post: [], notified: before.feed };
  await IndexedDBService.set('meta', NOVINKY_NOTIFIED_KEY, {
    alerts: news.notified,
    feed: events.notified,
  } satisfies Notified);
  const post = [...news.post, ...(s.notifySocieties ? events.post : [])];
  if (post.length === 0 || gen !== generation) return;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  await show(post, s.language, gen);
}

async function show(groups: PushGroup[], language: string, gen: number): Promise<void> {
  const t = (key: string, params?: Record<string, string>) => translate(language, key, params);
  // iOS has no channels; the call rejects there.
  if (Capacitor.getPlatform() === 'android') {
    for (const g of groups) {
      await LocalNotifications.createChannel({
        id: CHANNEL[g.kind].id,
        name: t(CHANNEL[g.kind].name),
        importance: 2,
      });
    }
  }
  if (gen !== generation) return;
  const base = Math.floor(Date.now() / 1000);
  await LocalNotifications.schedule({
    notifications: groups.map((g, i) => {
      const codes = [...new Set(g.rows.map((r) => r.courseCode).filter(Boolean))];
      return {
        // Seconds since the epoch fit the plugin's int32 id and differ between runs.
        id: base + i,
        ...pushText(g, t),
        channelId: CHANNEL[g.kind].id,
        // The plugin defaults this to true and, on Android 12+ without
        // SCHEDULE_EXACT_ALARM, opens "Alarms & reminders" first.
        isExactNotification: false,
        extra: {
          kind: NOVINKY_KIND,
          group: g.kind,
          courseCode: codes.length === 1 ? codes[0] : null,
        },
      };
    }),
  });
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  const gen = generation;
  timer = setTimeout(() => {
    queue = queue.then(() => run(gen)).catch((err) => logError('Mobile.novinkyNotifications', err));
  }, SETTLE_MS);
}

/**
 * Novinky's rows as system notifications, 1:1, on iOS and Android. Installed
 * from capacitor/startApp; the extension has the bell only
 * (src/test/guards/desktopHasNoNovinkyNotifications.test.ts).
 */
export function installNovinkyNotifications(): () => void {
  unsubscribe?.();
  if (Capacitor.getPlatform() === 'android') {
    // Its importance was 4 and cannot change; the new channels replace it.
    void LocalNotifications.deleteChannel({ id: 'reis-zaznamnik-points' }).catch(() => undefined);
  }
  unsubscribe = useAppStore.subscribe(schedule);
  schedule();
  return () => unsubscribe?.();
}

/** Sign-out: the next person on this phone must not see this student's rows. */
export async function clearNovinkyNotifications(): Promise<void> {
  generation++;
  unsubscribe?.();
  unsubscribe = null;
  if (timer) clearTimeout(timer);
  // A run already handed to the plugin lands in the tray; wait for it, then clear.
  await queue;
  const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications.filter(
    (n) => (n.extra as { kind?: unknown } | undefined)?.kind === NOVINKY_KIND
  );
  if (delivered.length > 0) {
    await LocalNotifications.removeDeliveredNotifications({ notifications: delivered });
  }
  await IndexedDBService.delete('meta', NOVINKY_NOTIFIED_KEY);
}

/**
 * A tap opens what tapping the row in Novinky opens: Zkoušky for new terms, the
 * subject's Záznamník for points or a box in one subject, Novinky otherwise.
 * Other features' taps are ignored.
 */
export function openNovinkyFromNotification(extra: unknown): void {
  const e = extra as { kind?: unknown; group?: unknown; courseCode?: unknown } | null | undefined;
  if (e?.kind !== NOVINKY_KIND) return;
  const store = useAppStore.getState();
  if (e.group === 'terms') {
    store.setMobileTab('exams');
    return;
  }
  if ((e.group === 'points' || e.group === 'boxes') && typeof e.courseCode === 'string') {
    const s = store.subjects?.data?.[e.courseCode];
    store.setMobileTab('subjects');
    store.pushSheet({
      kind: 'subjectDrawer',
      courseCode: e.courseCode,
      courseName:
        (store.language === 'en' ? s?.nameEn : s?.nameCs) || s?.displayName || e.courseCode,
      courseId: s?.subjectId,
      initialTab: 'zaznamnik',
    });
    return;
  }
  store.pushSheet({ kind: 'notifications' });
}
