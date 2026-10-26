import type { EduroamCertMaterial } from '../../api/eduroam';
import { generateEduroamMobileconfig } from '../../services/eduroam/mobileconfig';
import { generateEapConfig } from '../../services/eduroam/eapConfig';
import { deliverEduroamProfile, buildProfileDelivery } from '../../mobile/eduroamProfile';
import { trackFeatureSignal } from '../../api/featureUsage';

/**
 * The file half of `useEduroamSetup`: build the Mac `.mobileconfig` or the
 * Windows `.eap-config` from the certificate and hand it over. Split out of the
 * hook to keep it under the 200-line convention; behaviour is unchanged.
 */
export async function deliverEduroamFile(
  t: 'mac' | 'windows',
  { rootCaDer, clientP12 }: Pick<EduroamCertMaterial, 'rootCaDer' | 'clientP12'>
): Promise<void> {
  const xml = generateEduroamMobileconfig({ rootCaDer, clientP12 });

  // Not `saveAs`. In a browser it is the same anchor download it always
  // was, but the Mac target is now also reached from INSIDE the app — reIS
  // on a Mac is the iOS app, where NEHotspotConfiguration is unavailable
  // and a blob download is a silent no-op. deliverEduroamProfile writes the
  // file natively and hands it to the share sheet there.
  const delivery = buildProfileDelivery();
  if (t === 'windows') {
    // Windows: same .eap-config as Android, but reIS runs on this PC, so we
    // save it straight to disk. Windows has no association for the
    // extension, so double-clicking does NOT open it — geteduroam loads it
    // from its own ··· menu, which is what the manual's steps walk through.
    const eap = generateEapConfig({ rootCaDer, clientP12 });
    await deliverEduroamProfile(
      new Blob([eap], { type: 'application/eap-config' }),
      'eduroam-reis.eap-config',
      delivery
    );
  } else {
    await deliverEduroamProfile(
      new Blob([xml], { type: 'application/x-apple-aspen-config' }),
      'eduroam-reis.mobileconfig',
      delivery
    );
  }

  // Deliberately a different signal from the native one: this is a
  // profile handed over, not a configured network. The student still has
  // to open it and approve the install (or load it from geteduroam's
  // menu on Windows), and reIS cannot see whether they did.
  void trackFeatureSignal('eduroam_profile_delivered');
}

// macOS deep link straight to the Profiles / Device Management pane.
const PROFILES_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preferences.configurationprofiles';

/** Custom-scheme link: hand off to the OS without navigating the iframe. */
export function openProfilesSettings(): void {
  const a = document.createElement('a');
  a.href = PROFILES_SETTINGS_URL;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
