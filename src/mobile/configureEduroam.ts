// JS side of the native eduroam Wi-Fi setup (Android).
//
// The student's cert material is fetched in the WebView, which holds the IS
// session (src/api/eduroam.ts), and crosses the bridge as base64. A .p12 is a
// few KB, so bridge size is a non-issue.
//
// This replaces the geteduroam route on Android, which is structurally broken
// for MENDELU: geteduroam re-resolves the signing institution against eduroam
// discovery, MENDELU is not in that catalogue, and the lookup failure disables
// a config that was already working. The intent path has no discovery step.

import { bytesToBase64 } from '../services/eduroam/base64';

/** Android `Activity.RESULT_OK`. */
export const RESULT_OK = -1;
/** Android `Activity.RESULT_CANCELED` — the student dismissed the system dialog. */
export const RESULT_CANCELED = 0;

// Settings.ADD_WIFI_RESULT_* — the per-network codes inside EXTRA_WIFI_NETWORK_RESULT_LIST.
const ADD_WIFI_RESULT_SUCCESS = 0;
const ADD_WIFI_RESULT_ADD_OR_UPDATE_FAILED = 1;
const ADD_WIFI_RESULT_ALREADY_EXISTS = 2;

export type EduroamConfigOutcome = 'saved' | 'already-configured' | 'failed' | 'cancelled';

/** Raw shape the native plugin resolves with. `perNetwork` is comma-joined ints. */
export interface NativeAddResult {
  resultCode: number;
  perNetwork: string;
}

export interface ConfigureEduroamDeps {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeAddResult>;
}

/** What the caller passes in — the subset of `EduroamCertMaterial` this needs. */
export interface EduroamNativeInput {
  clientP12: Uint8Array;
  rootCaDer: Uint8Array;
  password: string | null;
}

/**
 * Turn Android's two-level result into something the UI can act on.
 *
 * Unknown and missing codes deliberately fail CLOSED. Claiming success when the
 * network was not saved sends a student to campus with wi-fi that never
 * connects and no reason to suspect setup; the opposite mistake self-corrects,
 * because a retry over a network that did save returns ALREADY_EXISTS, which
 * reads as success.
 */
export function interpretAddResult(result: NativeAddResult): EduroamConfigOutcome {
  if (result.resultCode !== RESULT_OK) return 'cancelled';

  // Exactly one network is ever requested, so only the first code is meaningful.
  const first = Number.parseInt(result.perNetwork.split(',')[0] ?? '', 10);
  if (first === ADD_WIFI_RESULT_SUCCESS) return 'saved';
  if (first === ADD_WIFI_RESULT_ALREADY_EXISTS) return 'already-configured';
  if (first === ADD_WIFI_RESULT_ADD_OR_UPDATE_FAILED) return 'failed';
  return 'failed';
}

/**
 * Hand the cert material to the native plugin and report what Android did.
 *
 * The EAP identity is NOT passed from here: the plugin already opens the
 * PKCS#12 to get the private key, so it reads the subject CN off the client
 * certificate it is holding — which for the MENDELU cert is exactly
 * `<login>@mendelu.cz`. Deriving it there costs nothing and avoids both an
 * extra IS request for the DER and a second ASN.1 parser in TypeScript.
 */
export async function configureEduroam(
  material: EduroamNativeInput,
  deps: ConfigureEduroamDeps
): Promise<EduroamConfigOutcome> {
  if (!material.password) {
    // Checked here, where the cause is still legible. Inside the plugin this
    // surfaces as `FAILED at stage=keystore`, which says nothing about IS not
    // having shown a password on the certificate page.
    throw new Error('eduroam: IS did not provide the certificate extraction password');
  }

  const result = await deps.configure({
    p12Base64: bytesToBase64(material.clientP12),
    caDerBase64: bytesToBase64(material.rootCaDer),
    passphrase: material.password,
  });
  return interpretAddResult(result);
}
