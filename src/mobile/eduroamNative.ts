import { Capacitor, registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import type { ConfigureEduroamDeps, NativeConfigureResult } from './configureEduroam';

interface EduroamNativePlugin {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeConfigureResult>;
}

/**
 * One JS name, two native halves: android/.../EduroamPlugin.java saves eduroam
 * via ACTION_WIFI_ADD_NETWORKS; native/capacitor-eduroam (Swift) via
 * NEHotspotConfigurationManager. Capacitor hands `registerPlugin` whichever
 * the OS provides, so nothing here branches on platform to pick one.
 */
const Eduroam = registerPlugin<EduroamNativePlugin>('Eduroam');

export const nativeEduroamDeps: ConfigureEduroamDeps = {
  configure: (o) => Eduroam.configure(o),
};

export type NativeEduroamTarget = 'ios' | 'android';

/**
 * The OS this app is running on, when it is the Capacitor app — or null in a
 * browser, where the eduroam target is the student's choice, not this device.
 *
 * Asked of Capacitor rather than guessed from the user agent: a WKWebView can
 * report itself as Macintosh, which the UA guess reads as a desktop Mac and
 * answers with a blob download the WebView does nothing useful with.
 */
export function nativeEduroamTarget(): NativeEduroamTarget | null {
  const forced = devForcedTarget();
  if (forced) return forced;
  if (getPlatform().kind !== 'capacitor') return null;
  const os = Capacitor.getPlatform();
  return os === 'ios' || os === 'android' ? os : null;
}

/**
 * `?eduroam=ios` / `?eduroam=android` on the dev webapp, and nothing anywhere
 * else — `import.meta.env.DEV` dead-code-strips the whole function out of every
 * shipped build, the way `devSociety` and `loadRealDataSnapshot` do.
 *
 * The welcome screen's eduroam card is the one part of the first-run flow a
 * browser can never reach: the gate below asks Capacitor, and Capacitor is not
 * there. Without this the card was only visible by patching this file by hand,
 * which is how the tablet layout came to be reviewed on a screen that did not
 * include it (#259). Only the *gate* is forced; tapping the button still runs
 * the real hook and fails at the plugin, which is the honest outcome here.
 */
function devForcedTarget(): NativeEduroamTarget | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('eduroam');
  return v === 'ios' || v === 'android' ? v : null;
}

/**
 * True when eduroam can be configured by the OS instead of by handing the
 * student a file.
 *
 * A phone target inside the Capacitor host is the whole test — reIS in a
 * desktop browser with the Android or iOS tab selected is a desktop→phone
 * transfer and must keep its QR.
 *
 * The Android API 30 floor is NOT checked here. minSdkVersion is 24, so Android
 * 7–10 devices reach this, and the plugin rejects them with an explicit message
 * rather than this returning a quiet false — a student on an old phone should
 * see why, not silently get a different flow. iOS 15.0/15.1 are handled the
 * same way inside the Swift plugin.
 */
export function canConfigureEduroamNatively(target: string): boolean {
  if (target !== 'android' && target !== 'ios') return false;
  return getPlatform().kind === 'capacitor' || devForcedTarget() !== null;
}
