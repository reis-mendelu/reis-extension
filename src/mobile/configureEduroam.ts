// JS side of the native eduroam Wi-Fi setup (Android and iOS).
//
// The student's cert material is fetched in the WebView, which holds the IS
// session (src/api/eduroam.ts), and crosses the bridge as base64. A .p12 is a
// few KB, so bridge size is a non-issue.
//
// Two native halves share the JS name `Eduroam`: android/.../EduroamPlugin.java
// resolves raw ACTION_WIFI_ADD_NETWORKS codes (decoded below), and
// native/capacitor-eduroam (Swift) resolves an already-mapped outcome. Both
// go through normalizeOutcome.
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

export type EduroamConfigOutcome =
  | 'saved'
  | 'already-configured'
  | 'failed'
  | 'cancelled'
  /**
   * iOS only (#261). The device is sitting on the eduroam SSID but nothing this
   * app installed backs it — `alreadyAssociated` reports the association, not a
   * configuration, and deleting the app removes the configuration while leaving
   * the association up. Not a success: iOS installs nothing on this path, so
   * the student must forget the network before setup can take.
   *
   * Android has no equivalent. Its ADD_WIFI_RESULT_ALREADY_EXISTS means a saved
   * network configuration exists, which is a real credential.
   */
  | 'stale-association';

/** Android: raw shape the Java plugin resolves with. `perNetwork` is comma-joined ints. */
export interface NativeAddResult {
  resultCode: number;
  perNetwork: string;
}

/**
 * iOS: the Swift plugin (native/capacitor-eduroam) has already mapped
 * NEHotspotConfigurationError onto an outcome. `detail` is a diagnostic, never
 * shown raw to a student.
 */
export interface NativeOutcomeResult {
  outcome: string;
  detail?: string;
}

export type NativeConfigureResult = NativeAddResult | NativeOutcomeResult;

export interface ConfigureEduroamDeps {
  configure(o: {
    p12Base64: string;
    caDerBase64: string;
    passphrase: string;
  }): Promise<NativeConfigureResult>;
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

const OUTCOMES: readonly string[] = [
  'saved',
  'already-configured',
  'failed',
  'cancelled',
  'stale-association',
];

/**
 * One normalizer for both native halves. Android resolves raw intent codes,
 * decoded by interpretAddResult above; iOS resolves an outcome string. A result
 * that is neither, or an outcome neither platform defines, fails CLOSED for the
 * same reason interpretAddResult does.
 */
export function normalizeOutcome(
  result: NativeConfigureResult | null | undefined
): EduroamConfigOutcome {
  if (!result || typeof result !== 'object') return 'failed';
  if ('outcome' in result) {
    return typeof result.outcome === 'string' && OUTCOMES.includes(result.outcome)
      ? (result.outcome as EduroamConfigOutcome)
      : 'failed';
  }
  if ('resultCode' in result) return interpretAddResult(result);
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
  return normalizeOutcome(result);
}
