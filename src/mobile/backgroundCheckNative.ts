import { Capacitor, registerPlugin } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import { translate } from '../i18n/translate';
import { logError } from '../utils/reportError';

/** Android-only: BackgroundCheckPlugin.java. */
interface BackgroundCheckPlugin {
  start(o: { channelNames: Record<string, string> }): Promise<{ enabled: boolean }>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
  clearNotifications(): Promise<void>;
}
const BackgroundCheck = registerPlugin<BackgroundCheckPlugin>('BackgroundCheck');

const onAndroid = () => Capacitor.getPlatform() === 'android';

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
