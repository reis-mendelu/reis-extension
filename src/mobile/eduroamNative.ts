import { registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import type { ConfigureEduroamDeps, NativeAddResult } from './configureEduroam';

interface EduroamNativePlugin {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeAddResult>;
}

/** Android-only native plugin: saves eduroam via ACTION_WIFI_ADD_NETWORKS. */
const Eduroam = registerPlugin<EduroamNativePlugin>('Eduroam');

export const nativeEduroamDeps: ConfigureEduroamDeps = {
  configure: (o) => Eduroam.configure(o),
};

/**
 * True when eduroam can be configured by the OS instead of by handing the
 * student a file.
 *
 * `target` already resolves to 'android' only on an Android device, so pairing
 * it with the Capacitor host is the whole test — reIS in a desktop browser with
 * the Android tab selected is a desktop→phone transfer and must keep its QR.
 *
 * The API 30 floor is NOT checked here. minSdkVersion is 24, so Android 7–10
 * devices reach this, and the plugin rejects them with an explicit message
 * rather than this returning a quiet false — a student on an old phone should
 * see why, not silently get a different flow.
 */
export function canConfigureEduroamNatively(target: string): boolean {
  return target === 'android' && getPlatform().kind === 'capacitor';
}
