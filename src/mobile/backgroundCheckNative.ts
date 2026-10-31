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
  /** Renames the channels, e.g. after a language switch; never touches the job. */
  setChannelNames(o: { channelNames: Record<string, string> }): Promise<void>;
  addListener(event: 'notificationTap', cb: (tap: BackgroundTap) => void): Promise<unknown>;
}

/** What BackgroundNotifier puts on the notification's intent. */
export interface BackgroundTap {
  kind: string;
  courseCode: string | null;
}
const BackgroundCheck = registerPlugin<BackgroundCheckPlugin>('BackgroundCheck');

const onAndroid = () => Capacitor.getPlatform() === 'android';

const channelNames = (language: string) => ({
  exams: translate(language, 'backgroundCheck.channelExams'),
  boxes: translate(language, 'backgroundCheck.channelBoxes'),
  points: translate(language, 'backgroundCheck.channelPoints'),
});

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

const SUBJECTS_WAIT_MS = 8000;

/**
 * A cold start's tap arrives before the subjects have loaded from the cache,
 * and a drawer built without the subject's IS id opens on Statistics instead
 * of Záznamník. So a tap for a subject waits (briefly) until the store knows
 * it, then opens it; a subject that never appears opens as it is.
 */
function whenSubjectKnown(courseCode: string | null | undefined): Promise<void> {
  const known = () =>
    !courseCode || !!useAppStore.getState().subjects?.data?.[courseCode]?.subjectId;
  if (known()) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = () => {
      unsubscribe();
      clearTimeout(timer);
      resolve();
    };
    const unsubscribe = useAppStore.subscribe(() => known() && stop());
    const timer = setTimeout(stop, SUBJECTS_WAIT_MS);
  });
}

async function handleTap(tap: Partial<BackgroundTap> | null | undefined): Promise<void> {
  if (tap?.kind === 'boxes' || tap?.kind === 'points') await whenSubjectKnown(tap.courseCode);
  openFromBackgroundTap(tap);
}

/**
 * Once per launch after sign-in: names the notification channels in the
 * student's language, re-arms the job if it is on, and reads the switch into
 * the store. A failure leaves the switch hidden rather than claiming a state.
 */
export async function startBackgroundCheck(): Promise<void> {
  if (!onAndroid()) return;
  try {
    // The stored language lands asynchronously at boot; reading the store
    // before it would name an English student's channels in Czech.
    await useAppStore.getState().loadLanguage();
    const { enabled } = await BackgroundCheck.start({
      channelNames: channelNames(useAppStore.getState().language),
    });
    useAppStore.getState().setBackgroundCheck(enabled ? 'on' : 'off');
    // The mounted app is what a tap navigates, so this comes after it: first
    // the tap that launched us (the intent outlives the process start), then
    // any later one while the app is open.
    void handleTap(await BackgroundCheck.getLaunchTap());
    void BackgroundCheck.addListener('notificationTap', (tap) => void handleTap(tap));
    // A language switch while the app is open renames the channels too, so the
    // phone's own notification settings do not keep the old words until relaunch.
    let named = useAppStore.getState().language;
    useAppStore.subscribe((state) => {
      if (state.language === named) return;
      named = state.language;
      BackgroundCheck.setChannelNames({ channelNames: channelNames(named) }).catch((err) =>
        logError('Mobile.nameBackgroundChannels', err)
      );
    });
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
