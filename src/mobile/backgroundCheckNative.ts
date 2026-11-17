import { Capacitor, registerPlugin } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';
import { openNovinkyFromNotification } from './novinkyTaps';
import { NOVINKY_KIND } from './novinkyPost';

/** Android-only: BackgroundCheckPlugin.java. */
interface BackgroundCheckPlugin {
  start(o: { channelNames: Record<string, string> }): Promise<{ enabled: boolean }>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
  clearNotifications(): Promise<void>;
  /** Stops the run in progress and drops a launch tap not yet consumed (sign-out). */
  stopRun(): Promise<void>;
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
 * A tap on a notification the background check posted opens what tapping the
 * same notification from the open app does (novinkyTaps): Zkoušky for new
 * terms, the subject's Záznamník for points or a box in one subject, Novinky
 * otherwise. The drawer itself takes the asked tab once the subjects load.
 */
export function openFromBackgroundTap(tap: Partial<BackgroundTap> | null | undefined): void {
  if (!tap?.kind) return;
  openNovinkyFromNotification({
    kind: NOVINKY_KIND,
    group: tap.kind === 'exams' ? 'terms' : tap.kind,
    courseCode: tap.courseCode ?? null,
  });
}

// The one language subscription: a second start must not add another.
let unsubscribeLanguage: (() => void) | null = null;

/**
 * Once per launch after sign-in: names the notification channels in the
 * student's language and arms the job.
 */
export async function startBackgroundCheck(): Promise<void> {
  if (!onAndroid()) return;
  try {
    // Named with the language the store has now. The stored one can land later
    // at boot, even during the awaits below; the rename below catches it. Not
    // a second loadLanguage(): it could overwrite a language chosen meanwhile.
    let named = useAppStore.getState().language;
    const { enabled } = await BackgroundCheck.start({ channelNames: channelNames(named) });
    // No switch of its own (folded 2026-11-17): it runs while reIS may notify,
    // and the phone's own notification setting turns both off. A job a tester
    // switched off in an earlier build is armed again.
    if (!enabled) await BackgroundCheck.setEnabled({ enabled: true });
    // The mounted app is what a tap navigates, so this comes after it: first
    // the tap that launched us (the intent outlives the process start), then
    // any later one while the app is open.
    openFromBackgroundTap(await BackgroundCheck.getLaunchTap());
    void BackgroundCheck.addListener('notificationTap', (tap) => openFromBackgroundTap(tap));
    // A language switch while the app is open renames the channels too, so the
    // phone's own notification settings do not keep the old words until relaunch.
    const rename = () => {
      const language = useAppStore.getState().language;
      if (language === named) return;
      named = language;
      BackgroundCheck.setChannelNames({ channelNames: channelNames(named) }).catch((err) =>
        logError('Mobile.nameBackgroundChannels', err)
      );
    };
    unsubscribeLanguage?.();
    unsubscribeLanguage = useAppStore.subscribe(rename);
    // A language that landed while start() or getLaunchTap() was pending.
    rename();
  } catch (err) {
    logError('Mobile.startBackgroundCheck', err);
  }
}

/** Sign-out: this student's notifications must not stay for the next person. */
export async function clearBackgroundNotifications(): Promise<void> {
  if (!onAndroid()) return;
  try {
    // First the run in progress: it must not write this student's data back
    // after the wipe, or post it for the next one.
    await BackgroundCheck.stopRun();
    await BackgroundCheck.clearNotifications();
  } catch (err) {
    logError('Mobile.clearBackgroundNotifications', err);
  }
}
