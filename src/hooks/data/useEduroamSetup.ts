import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchEduroamCertMaterial,
  fetchEduroamPassword,
  regenerateEduroamCert,
} from '../../api/eduroam';
import { configureEduroam, type EduroamConfigOutcome } from '../../mobile/configureEduroam';
import { canConfigureEduroamNatively, nativeEduroamDeps } from '../../mobile/eduroamNative';
import { deliverEduroamFile, openProfilesSettings } from './eduroamFileDelivery';
import { statusAfterNativeOutcome } from './eduroamOutcomeStatus';
import { certExpiry, NO_EXPIRY } from '../../services/eduroam/certValidity';
import {
  classifyNetworkFailure,
  isDeviceOffline,
  type NetworkFailure,
} from '../../services/eduroam/networkFailure';
import { logError } from '../../utils/reportError';
import { trackFeatureSignal } from '../../api/featureUsage';

/**
 * `expired`: IS's certificate is past its notAfter, so nothing was installed;
 * the surface offers `renew`. Its own status rather than `error`, because
 * nothing failed and the way forward is a different button.
 */
export type EduroamStatus = 'idle' | 'working' | 'done' | 'error' | 'expired';
/** Which device the student is setting up — not necessarily the desktop's OS. */
export type EduroamTarget = 'mac' | 'ios' | 'android' | 'windows';

export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

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
  const [error, setError] = useState<string | null>(null);
  /** Native-path only: what Android did with the network. Null on file paths. */
  const [outcome, setOutcome] = useState<EduroamConfigOutcome | null>(null);
  /** Where IS's certificate stands; see `CertExpiry`. Either half offers `renew`. */
  const [expiry, setExpiry] = useState(NO_EXPIRY);
  /** Set with status `error` when the network, not IS, is why it failed. */
  const [networkFailure, setNetworkFailure] = useState<NetworkFailure | null>(null);

  const clearResult = useCallback(() => {
    setError(null);
    setNetworkFailure(null);
    setExpiry(NO_EXPIRY);
    setPassword(null);
    setOutcome(null);
  }, []);

  const fail = useCallback((context: string, e: unknown) => {
    logError(context, e);
    setError((e as Error).message);
    setNetworkFailure(classifyNetworkFailure(e));
    setStatus('error');
  }, []);

  // The .p12 password is NEVER embedded: the macOS path prompts at install, and
  // the iOS transfer path must keep the profile from being a standalone credential.
  const run = useCallback(
    async (t: EduroamTarget) => {
      setStatus('working');
      clearResult();
      try {
        // Off Wi‑Fi is fine — mobile data reaches IS. No connection at all is
        // not, and asking anyway only waits for a raw OS error.
        if (isDeviceOffline()) throw new Error('eduroam: the device is offline');
        const material = await fetchEduroamCertMaterial();
        const { password: extractionPw } = material;

        // IS keeps offering an expired certificate and never replaces it by
        // itself. Installing it gives a network that cannot authenticate, so
        // stop here on every target and let the student ask for a new one.
        const nextExpiry = certExpiry(material.expiresAt, Date.now());
        setExpiry(nextExpiry);
        if (nextExpiry.expiredAt) {
          setStatus('expired');
          return;
        }

        // On the phone itself the OS configures eduroam directly — no profile
        // file and nothing to hand over. Everything below this branch runs on the
        // machine reIS is open on.
        if (canConfigureEduroamNatively(t)) {
          const result = await configureEduroam(material, nativeEduroamDeps);
          setOutcome(result);
          // Only `saved` is a setup that finished. `already-configured` applied
          // nothing — the network was there before reIS was asked — and counting
          // it would report students as newly set up who were already on
          // eduroam. `cancelled`, `failed` and `stale-association` installed
          // nothing at all. The file paths below get their own signal, because a
          // delivered profile still needs the student to install it.
          if (result === 'saved') void trackFeatureSignal('eduroam_wifi_configured');
          setPassword(extractionPw);
          setStatus(statusAfterNativeOutcome(result));
          return;
        }

        // A phone that reached here has no native path, and there is no longer a
        // desktop→phone transfer to fall back to. Fail loudly rather than hand it
        // a file meant for a laptop: before this guard, an Android phone whose
        // plugin was unavailable silently downloaded an Apple .mobileconfig.
        if (t === 'ios' || t === 'android') {
          throw new Error('eduroam on a phone is set up by the reIS app, not from a browser');
        }

        await deliverEduroamFile(t, material);
        setPassword(extractionPw);
        setStatus('done');
      } catch (e) {
        fail('useEduroamSetup.run', e);
      }
    },
    [clearResult, fail]
  );

  /**
   * The student's "generate a new certificate" tap — offered once the current
   * one has expired or is about to (`CertExpiry`). Generation stays
   * student-initiated; then sets up with the new certificate.
   */
  const renew = useCallback(
    async (t: EduroamTarget) => {
      setStatus('working');
      setError(null);
      setNetworkFailure(null);
      setExpiry(NO_EXPIRY);
      try {
        await regenerateEduroamCert();
      } catch (e) {
        fail('useEduroamSetup.renew', e);
        return;
      }
      await run(t);
    },
    [run, fail]
  );

  const selectTarget = useCallback(
    (t: EduroamTarget) => {
      setTarget(t);
      setStatus('idle');
      clearResult();
      // Prefetch the extraction password so the chip can show it before Download.
      // Only populates when a cert already exists; first-time users get it from
      // run(). Never overwrites a value run() may have already set.
      void fetchEduroamPassword()
        .then((pw) => {
          if (pw) setPassword((prev) => prev ?? pw);
        })
        .catch((e) => logError('useEduroamSetup.prefetchPassword', e));
    },
    [clearResult]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    clearResult();
  }, [clearResult]);

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

  return {
    status,
    target,
    selectTarget,
    password,
    error,
    networkFailure,
    outcome,
    ...expiry,
    run,
    renew,
    reset,
    openProfilesSettings,
  };
}
