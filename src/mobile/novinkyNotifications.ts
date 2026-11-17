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
import { buildFeed, feedInputsOf, viewerOf } from '../utils/novinky/buildFeed';
import { pragueMinuteIso } from '../utils/isNoticeRows';
import { planPushes, type PushGroup, type PushRow } from '../utils/novinky/pushPlan';
import { pushRowsOf } from '../utils/novinky/pushText';

import { NOVINKY_KIND, postGroups } from './novinkyPost';

/** The 'meta' key holding the row ids already notified, per source (see run). */
export const NOVINKY_NOTIFIED_KEY = 'novinky_notified';

interface Notified {
  alerts?: string[];
  feed?: string[];
  notices?: string[];
}

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

/** Each source's rows are recorded from the moment it is ready (see run). */
function sources(s: AppState) {
  const feed = buildFeed(feedInputsOf(s));
  return {
    // Alert rows: once the first sync has settled.
    alerts: s.firstSyncSettled,
    // Society events: once their feed has loaded.
    feed: s.notifications.status === 'success',
    // IS notices load on their own, and a failed society feed must not hold
    // them back. Ready once a live load succeeded or a cached list is there:
    // an empty failed first try is no baseline, or every notice would post as
    // new after the retry.
    notices: s.isNoticesFetchedAt !== null || s.isNotices.cz.length + s.isNotices.en.length > 0,
    events: feed.filter((n) => n.source !== 'is'),
    isNotices: feed.filter((n) => n.source === 'is'),
  };
}

/**
 * Posts what Novinky gained since the last run. Three sources, each recorded
 * from the moment it is ready, so none arrives later as a backlog. Rows are
 * recorded even while notifications are off, or allowing them later would
 * post everything at once.
 */
async function run(gen: number): Promise<void> {
  const s = useAppStore.getState();
  if (!s.firstSyncSettled) return;
  const alerts = buildDeadlineAlerts(deadlineAlertInputsOf(s));
  const src = sources(s);
  const nameOf = societyName(s);
  const seen = new Set<string>([
    ...alerts.filter((a) => isAlertSeen(a, s.notifications.seenDeadlineAlertIds)).map((a) => a.id),
    ...s.notifications.readIds,
  ]);
  const before = ((await IndexedDBService.get('meta', NOVINKY_NOTIFIED_KEY)) ?? {}) as Notified;
  if (gen !== generation) return;
  const plan = (ready: boolean, rows: PushRow[], known: string[] | undefined) =>
    ready ? planPushes(rows, known, seen) : { post: [], notified: known };
  const news = plan(src.alerts, pushRowsOf(alerts, [], nameOf), before.alerts);
  const events = plan(src.feed, pushRowsOf([], src.events, nameOf), before.feed);
  const notices = plan(src.notices, pushRowsOf([], src.isNotices, nameOf), before.notices);
  await IndexedDBService.set('meta', NOVINKY_NOTIFIED_KEY, {
    alerts: news.notified,
    feed: events.notified,
    notices: notices.notified,
  } satisfies Notified);
  // Society events and IS notices are one kind, so one notification.
  const school = [...events.post, ...notices.post].flatMap((g) => g.rows);
  const post: PushGroup[] = [
    ...news.post,
    ...(s.notifySocieties && school.length > 0
      ? [{ kind: 'societies' as const, rows: school }]
      : []),
  ];
  if (post.length === 0 || gen !== generation) return;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  await postGroups(post, s.language, () => gen === generation);
}

/** The inputs of Novinky's news rows and of the decision to post them. */
const watchedOf = (s: AppState): unknown[] => [
  s.firstSyncSettled,
  s.exams.data,
  s.examTermsNew,
  s.odevzdavarny,
  s.odevzdavarnyNew,
  s.zaznamnikNewPoints,
  s.subjects,
  s.studyPlanDual,
  s.notifications.data,
  s.notifications.status,
  s.notifications.readIds,
  s.notifications.seenDeadlineAlertIds,
  s.isNotices,
  s.isNoticeMutes,
  s.societies,
  s.notifySocieties,
  s.language,
  s.isNoticesFetchedAt,
  // The feed's own clock and audience, never the one-second tick: an IS notice
  // opens at its minute, a restricted event once the faculty is known.
  pragueMinuteIso(s.now),
  ...Object.values(viewerOf(s)),
];

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
  // Only what the rows are built from. The store's clock ticks every second,
  // and a subscription to every change restarted the settle wait for ever.
  let watched = watchedOf(useAppStore.getState());
  unsubscribe = useAppStore.subscribe((s) => {
    const next = watchedOf(s);
    if (next.every((v, i) => v === watched[i])) return;
    watched = next;
    schedule();
  });
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
  // 5.7.x posted points under their own kind, and one may still be in the tray.
  const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications.filter(
    (n) => {
      const kind = (n.extra as { kind?: unknown } | undefined)?.kind;
      return kind === NOVINKY_KIND || kind === 'zaznamnik-new-points';
    }
  );
  if (delivered.length > 0) {
    await LocalNotifications.removeDeliveredNotifications({ notifications: delivered });
  }
  await IndexedDBService.delete('meta', NOVINKY_NOTIFIED_KEY);
}
