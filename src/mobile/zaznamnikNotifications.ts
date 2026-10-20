import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';
import { setNewPointsNotifier } from '../services/newPointsNotifier';
import { newPointsNotification } from '../utils/zaznamnik/newPointsText';
import type { NewPointsBySubject } from '../services/sync/zaznamnikNewPoints';

/** Tags ours, so a tap handler or a cleanup never touches another feature's. */
export const NEW_POINTS_KIND = 'zaznamnik-new-points';
const CHANNEL_ID = 'reis-zaznamnik-points';

function subjectName(courseCode: string): string {
  const { subjects, language } = useAppStore.getState();
  const s = subjects?.data?.[courseCode];
  return (language === 'en' ? s?.nameEn : s?.nameCs) || s?.displayName || courseCode;
}

/** Asked the first time there is something to say: the moment it makes sense. */
async function permitted(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return true;
  if (display !== 'prompt' && display !== 'prompt-with-rationale') return false;
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

// Bumped at sign-out: a call that started for the previous student checks it
// after every await and stops, so it can never post their points to the next.
let generation = 0;
const inFlight = new Set<Promise<void>>();

async function show(found: NewPointsBySubject, gen: number): Promise<void> {
  // Denied is fine: the "Nové body" row in Novinky does not depend on it.
  if (!(await permitted()) || gen !== generation) return;
  const { language } = useAppStore.getState();
  // iOS has no channels; the call rejects there.
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: translate(language, 'zaznamnik.notifyChannel'),
      importance: 4,
    });
  }
  if (gen !== generation) return;
  const codes = Object.keys(found);
  const { title, body } = newPointsNotification(found, subjectName, language);
  await LocalNotifications.schedule({
    // No `schedule.at`: shown now, so no exact alarm is involved. Seconds since
    // the epoch fit the plugin's int32 id and differ between syncs.
    notifications: [
      {
        id: Math.floor(Date.now() / 1000),
        title,
        body,
        channelId: CHANNEL_ID,
        extra: { kind: NEW_POINTS_KIND, courseCode: codes.length === 1 ? codes[0] : null },
      },
    ],
  });
}

/** A tap opens that subject's záznamník, or Novinky (one row per subject) for a summary. */
export function openFromNotification(extra: unknown): void {
  const e = extra as { kind?: unknown; courseCode?: unknown } | null | undefined;
  if (e?.kind !== NEW_POINTS_KIND) return;
  const store = useAppStore.getState();
  store.setMobileTab('subjects');
  if (typeof e.courseCode !== 'string') {
    store.pushSheet({ kind: 'notifications' });
    return;
  }
  store.pushSheet({
    kind: 'subjectDrawer',
    courseCode: e.courseCode,
    courseName: subjectName(e.courseCode),
    courseId: store.subjects?.data?.[e.courseCode]?.subjectId,
    initialTab: 'zaznamnik',
  });
}

/**
 * "Nové body" as a system notification, on iOS and Android only. Installed
 * from capacitor/startApp; the extension keeps the in-app highlight alone
 * (src/test/guards/desktopHasNoNewPointsNotification.test.ts) and Novinky.
 */
export function installZaznamnikNotifications(): void {
  void LocalNotifications.addListener('localNotificationActionPerformed', (event) =>
    openFromNotification(event.notification.extra)
  );
  setNewPointsNotifier((found) => {
    const run = show(found, generation).catch((err) =>
      logError('Mobile.zaznamnikNotifications', err)
    );
    inFlight.add(run);
    void run.finally(() => inFlight.delete(run));
  });
}

/** Sign-out: the next person on this phone must not see this student's points. */
export async function clearZaznamnikNotifications(): Promise<void> {
  setNewPointsNotifier(null);
  generation++;
  // One already handed to the plugin lands in the tray; wait for it, then clear.
  await Promise.all(inFlight);
  const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications.filter(
    (n) => (n.extra as { kind?: unknown } | undefined)?.kind === NEW_POINTS_KIND
  );
  if (delivered.length > 0) {
    await LocalNotifications.removeDeliveredNotifications({ notifications: delivered });
  }
}
