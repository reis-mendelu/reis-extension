import { useState, useCallback, useEffect, useRef } from 'react';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { fetchEduroamCertMaterial, fetchEduroamPassword } from '../../api/eduroam';
import { generateEduroamMobileconfig } from '../../services/eduroam/mobileconfig';
import { generateEapConfig } from '../../services/eduroam/eapConfig';
import { putTransfer, buildTransferUrl } from '../../api/eduroamTransfer';
import { configureEduroam, type EduroamConfigOutcome } from '../../mobile/configureEduroam';
import { canConfigureEduroamNatively, nativeEduroamDeps } from '../../mobile/eduroamNative';
import { logError } from '../../utils/reportError';

export type EduroamStatus = 'idle' | 'working' | 'done' | 'error';
/** Which device the student is setting up — not necessarily the desktop's OS. */
export type EduroamTarget = 'mac' | 'ios' | 'android' | 'windows';

export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

// macOS deep link straight to the Profiles / Device Management pane.
const PROFILES_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preferences.configurationprofiles';

/**
 * @param autoSelectTarget When provided (the eduroam sheet's platform, resolved
 * synchronously with no device picker), runs the same `selectTarget` flow the
 * desktop drawer only fires on user click — once, on mount — so the password
 * prefetch (`fetchEduroamPassword`) runs immediately and a returning student
 * sees their password chip instead of the placeholder.
 */
export function useEduroamSetup(autoSelectTarget?: EduroamTarget) {
  const [status, setStatus] = useState<EduroamStatus>('idle');
  const [target, setTarget] = useState<EduroamTarget>(autoSelectTarget ?? (isMac ? 'mac' : 'ios'));
  const [password, setPassword] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Native-path only: what Android did with the network. Null on file paths. */
  const [outcome, setOutcome] = useState<EduroamConfigOutcome | null>(null);

  // The .p12 password is NEVER embedded: the macOS path prompts at install, and
  // the iOS transfer path must keep the profile from being a standalone credential.
  const run = useCallback(async (t: EduroamTarget) => {
    setStatus('working');
    setError(null);
    setPassword(null);
    setQrDataUrl(null);
    setOutcome(null);
    try {
      const material = await fetchEduroamCertMaterial();
      const { rootCaDer, clientP12, password: extractionPw } = material;

      // On the phone itself, Android configures eduroam directly: no profile
      // file, no transfer, and no QR — a QR here would be pointing the device
      // at itself. Everything below this branch is desktop→phone delivery.
      if (canConfigureEduroamNatively(t)) {
        const result = await configureEduroam(material, nativeEduroamDeps);
        setOutcome(result);
        setPassword(extractionPw);
        // Dismissing Android's dialog is a choice, not a fault: go back to idle
        // so the button is simply offered again, with no error banner.
        setStatus(result === 'cancelled' ? 'idle' : result === 'failed' ? 'error' : 'done');
        return;
      }

      const xml = generateEduroamMobileconfig({ rootCaDer, clientP12 });

      if (t === 'ios') {
        // Upload the profile to a one-time row; the QR points at the endpoint that
        // serves it so iOS Safari shows the install prompt directly (no page).
        const id = await putTransfer(new TextEncoder().encode(xml));
        setQrDataUrl(
          await QRCode.toDataURL(buildTransferUrl(id, 'ios'), { margin: 2, width: 320 })
        );
      } else if (t === 'android') {
        // Android uses an .eap-config (geteduroam), delivered via the same transfer;
        // the receiver serves it as application/eap-config for fmt=android.
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        const id = await putTransfer(new TextEncoder().encode(eap));
        setQrDataUrl(
          await QRCode.toDataURL(buildTransferUrl(id, 'android'), { margin: 2, width: 320 })
        );
      } else if (t === 'windows') {
        // Windows: same .eap-config as Android, but reIS runs on this PC, so we
        // save it straight to disk. geteduroam (Windows) opens it on double-click.
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        saveAs(new Blob([eap], { type: 'application/eap-config' }), 'eduroam-reis.eap-config');
      } else {
        saveAs(
          new Blob([xml], { type: 'application/x-apple-aspen-config' }),
          'eduroam-reis.mobileconfig'
        );
      }

      setPassword(extractionPw);
      setStatus('done');
    } catch (e) {
      logError('useEduroamSetup.run', e);
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const selectTarget = useCallback((t: EduroamTarget) => {
    setTarget(t);
    setStatus('idle');
    setError(null);
    setPassword(null);
    setQrDataUrl(null);
    setOutcome(null);
    // Prefetch the extraction password so the chip can show it before Download.
    // Only populates when a cert already exists; first-time users get it from
    // run(). Never overwrites a value run() may have already set.
    void fetchEduroamPassword()
      .then((pw) => {
        if (pw) setPassword((prev) => prev ?? pw);
      })
      .catch((e) => logError('useEduroamSetup.prefetchPassword', e));
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setPassword(null);
    setQrDataUrl(null);
    setOutcome(null);
  }, []);

  // Fires selectTarget exactly once, only when a caller (the sheet) hands us a
  // pre-resolved target. The desktop drawer never passes autoSelectTarget, so
  // this is a no-op there — selection stays a user click.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (autoSelectTarget && !didAutoSelect.current) {
      didAutoSelect.current = true;
      selectTarget(autoSelectTarget);
    }
  }, [autoSelectTarget, selectTarget]);

  // Custom-scheme link: hand off to the OS without navigating the iframe.
  const openProfilesSettings = useCallback(() => {
    const a = document.createElement('a');
    a.href = PROFILES_SETTINGS_URL;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    status,
    target,
    selectTarget,
    password,
    qrDataUrl,
    error,
    outcome,
    run,
    reset,
    openProfilesSettings,
  };
}
