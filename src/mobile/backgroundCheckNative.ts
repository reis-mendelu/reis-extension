import { Capacitor, registerPlugin } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';
import { openExamsFromNotification } from './examReminders';
import { openFromNotification, NEW_POINTS_KIND } from './zaznamnikNotifications';
import { EXAM_OPENING_KIND } from '../utils/examOpeningReminders';

/** Android-only: BackgroundCheckPlugin.java. */
interface BackgroundCheckPlugin {
  start(o: { channelNames: Record<string, string> }): Promise<{ enabled: boolean }>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
  clearNotifications(): Promise<void>;
  /** The tap that launched the app, once; `{}` when it was not launched by one. */
  getLaunchTap(): Promise<Partial<BackgroundTap>>;
  addListener(event: 'notificationTap', cb: (tap: BackgroundTap) => void): Promise<unknown>;
}

/** What BackgroundNotifier puts on the notification's intent. */
export interface BackgroundTap {
  kind: string;
  courseCode: string | null;
}
const BackgroundCheck = registerPlugin<BackgroundCheckPlugin>('BackgroundCheck');

const onAndroid = () => Capacitor.getPlatform() === 'android';

/**
 * A tap on a notification the background check posted. Boxes and points both
 * open that subject's Záznamník (a summary opens Novinky), which is what the
 * bell's rows do; new exam terms open Zkoušky. The words are the other
 * features' own, so they cannot drift apart.
 */
export function openFromBackgroundTap(tap: Partial<BackgroundTap> | null | undefined): void {
  if (tap?.kind === 'exams') {
    openExamsFromNotification({ kind: EXAM_OPENING_KIND });
  } else if (tap?.kind === 'boxes' || tap?.kind === 'points') {
    openFromNotification({ kind: NEW_POINTS_KIND, courseCode: tap.courseCode ?? null });
  }
}

/**
 * Once per launch after sign-in: names the notification channels in the
 * student's language, re-arms the job if it is on, and reads the switch into
 * the store. A failure leaves the switch hidden rather than claiming a state.
 */
export async function startBackgroundCheck(): Promise<void> {
  if (!onAndroid()) return;
  try {
    const { language } = useAppStore.getState();
    const { enabled } = await BackgroundCheck.start({
      channelNames: {
        exams: translate(language, 'backgroundCheck.channelExams'),
        boxes: translate(language, 'backgroundCheck.channelBoxes'),
        points: translate(language, 'backgroundCheck.channelPoints'),
      },
    });
    useAppStore.getState().setBackgroundCheck(enabled ? 'on' : 'off');
    // The mounted app is what a tap navigates, so this comes after it: first
    // the tap that launched us (the intent outlives the process start), then
    // any later one while the app is open.
    openFromBackgroundTap(await BackgroundCheck.getLaunchTap());
    void BackgroundCheck.addListener('notificationTap', openFromBackgroundTap);
  } catch (err) {
    logError('Mobile.startBackgroundCheck', err);
  }
}

/** Rejects when the phone could not apply it, so the switch does not lie. */
export async function setBackgroundCheckEnabled(enabled: boolean): Promise<void> {
  await BackgroundCheck.setEnabled({ enabled });
}

/** Sign-out: this student's notifications must not stay for the next person. */
export async function clearBackgroundNotifications(): Promise<void> {
  if (!onAndroid()) return;
  try {
    await BackgroundCheck.clearNotifications();
  } catch (err) {
    logError('Mobile.clearBackgroundNotifications', err);
  }
}
