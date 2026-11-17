import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { translate } from '../i18n/translate';
import type { PushGroup, PushKind } from '../utils/novinky/pushPlan';
import { pushText } from '../utils/novinky/pushText';

/** Tags ours, so a tap handler or a cleanup never touches another feature's. */
export const NOVINKY_KIND = 'novinky';

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

/**
 * Posts one notification per kind, now (never scheduled for later). Stops when
 * `current` turns false: a sign-out between the awaits.
 */
export async function postGroups(
  groups: PushGroup[],
  language: string,
  current: () => boolean
): Promise<void> {
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
  if (!current()) return;
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
