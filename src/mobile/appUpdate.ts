import { getPlatform } from '@/platform';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';
import { useAppStore } from '../store/useAppStore';
import { trackFeatureSignal } from '../api/featureUsage';
import { appUpdateOffer, type StoreUpdateInfo } from '../utils/appUpdateOffer';
import { applyCriticalUpdate } from './criticalUpdate';

/**
 * "Nová verze reISu" on the phone and iPad: asks the store whether a newer
 * version exists (at boot and on resume) and, on a tap, gets the student to it.
 * The rule for WHEN is utils/appUpdateOffer; the row is
 * components/mobile/sheets/AppUpdateRow.
 *
 * - iOS has no in-app update. The check is Apple's public lookup
 *   (itunes.apple.com, the bundle id only), and a tap opens reIS's App Store
 *   page, where the student presses Update.
 * - Android asks the Play Store app on the phone, and a tap runs Play's own
 *   update screen, which downloads and installs without leaving reIS. Where
 *   Play does not allow that, the tap opens the Play Store page instead.
 *
 * The plugin is imported dynamically, so it never enters the extension's graph.
 */

/** reIS in the App Store (apps.apple.com/app/id6804832714). */
export const APP_STORE_ID = '6804832714';

function applies(): boolean {
  try {
    return getPlatform().kind === 'capacitor' && !isDemoMode();
  } catch {
    return false;
  }
}

async function nativeOs(): Promise<'ios' | 'android' | null> {
  const { Capacitor } = await import('@capacitor/core');
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
}

/** "18.1" from an iOS user agent, or null. */
function iosVersion(): string | null {
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)(?:_\d+)? like Mac OS X/);
  return m ? `${m[1]}.${m[2]}` : null;
}

export async function checkAppUpdate(): Promise<void> {
  if (!applies()) return;
  try {
    const os = await nativeOs();
    if (!os) return;
    const { AppUpdate } = await import('@capawesome/capacitor-app-update');
    // The lookup defaults to the US store; reIS is listed in the Czech one.
    const info = await AppUpdate.getAppUpdateInfo(os === 'ios' ? { country: 'cz' } : {});
    const offer = appUpdateOffer(info as StoreUpdateInfo, os, new Date(), iosVersion());
    useAppStore.getState().setAppUpdate(offer);
    // Not behind the 3-day grace: a build reIS marked broken is told at once.
    await applyCriticalUpdate(info as StoreUpdateInfo, os, iosVersion());
  } catch (e) {
    // Offline, or a build Play did not install (sideloaded): keep what we had.
    logError('Mobile.appUpdate.check', e);
  }
}

/** `signal` says which control was tapped: the Novinky row, or the
 *  critical-version pop-up and empty-screen hint. */
export async function openAppUpdate(
  signal: 'app_update_opened' | 'critical_update_opened' = 'app_update_opened'
): Promise<void> {
  if (!applies()) return;
  void trackFeatureSignal(signal);
  try {
    const os = await nativeOs();
    const { AppUpdate } = await import('@capawesome/capacitor-app-update');
    if (os === 'ios') {
      await AppUpdate.openAppStore({ appId: APP_STORE_ID });
      return;
    }
    try {
      const info = await AppUpdate.getAppUpdateInfo({});
      if (info.immediateUpdateAllowed) {
        await AppUpdate.performImmediateUpdate();
        return;
      }
    } catch (e) {
      logError('Mobile.appUpdate.immediate', e);
    }
    await AppUpdate.openAppStore({});
  } catch (e) {
    logError('Mobile.appUpdate.open', e);
  }
}
