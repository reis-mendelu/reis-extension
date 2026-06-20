import { useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { fetchEduroamCertMaterial, fetchEduroamPassword } from '../../api/eduroam';
import { generateEduroamMobileconfig } from '../../services/eduroam/mobileconfig';
import { generateEapConfig } from '../../services/eduroam/eapConfig';
import { putTransfer, buildTransferUrl } from '../../api/eduroamTransfer';
import { logError } from '../../utils/reportError';

export type EduroamStatus = 'idle' | 'working' | 'done' | 'error';
/** Which device the student is setting up — not necessarily the desktop's OS. */
export type EduroamTarget = 'mac' | 'ios' | 'android' | 'windows';

export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

// macOS deep link straight to the Profiles / Device Management pane.
const PROFILES_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preferences.configurationprofiles';

export function useEduroamSetup() {
  const [status, setStatus] = useState<EduroamStatus>('idle');
  const [target, setTarget] = useState<EduroamTarget>(isMac ? 'mac' : 'ios');
  const [password, setPassword] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The .p12 password is NEVER embedded: the macOS path prompts at install, and
  // the iOS transfer path must keep the profile from being a standalone credential.
  const run = useCallback(async (t: EduroamTarget) => {
    setStatus('working');
    setError(null);
    setPassword(null);
    setQrDataUrl(null);
    try {
      const { rootCaDer, clientP12, password: extractionPw } = await fetchEduroamCertMaterial();
      const xml = generateEduroamMobileconfig({ rootCaDer, clientP12 });

      if (t === 'ios') {
        // Upload the profile to a one-time row; the QR points at the endpoint that
        // serves it so iOS Safari shows the install prompt directly (no page).
        const id = await putTransfer(new TextEncoder().encode(xml));
        setQrDataUrl(await QRCode.toDataURL(buildTransferUrl(id, 'ios'), { margin: 2, width: 320 }));
      } else if (t === 'android') {
        // Android uses an .eap-config (geteduroam), delivered via the same transfer;
        // the receiver serves it as application/eap-config for fmt=android.
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        const id = await putTransfer(new TextEncoder().encode(eap));
        setQrDataUrl(await QRCode.toDataURL(buildTransferUrl(id, 'android'), { margin: 2, width: 320 }));
      } else if (t === 'windows') {
        // Windows: same .eap-config as Android, but reIS runs on this PC, so we
        // save it straight to disk. geteduroam (Windows) opens it on double-click.
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        saveAs(new Blob([eap], { type: 'application/eap-config' }), 'eduroam-reis.eap-config');
      } else {
        saveAs(new Blob([xml], { type: 'application/x-apple-aspen-config' }), 'eduroam-reis.mobileconfig');
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
    // Prefetch the extraction password so the chip can show it before Download.
    // Only populates when a cert already exists; first-time users get it from
    // run(). Never overwrites a value run() may have already set.
    void fetchEduroamPassword()
      .then((pw) => { if (pw) setPassword((prev) => prev ?? pw); })
      .catch((e) => logError('useEduroamSetup.prefetchPassword', e));
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setPassword(null);
    setQrDataUrl(null);
  }, []);

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
    run,
    reset,
    openProfilesSettings,
  };
}
