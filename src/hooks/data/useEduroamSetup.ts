import { useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { fetchEduroamCertMaterial } from '../../api/eduroam';
import { generateEduroamMobileconfig } from '../../services/eduroam/mobileconfig';
import { logError } from '../../utils/reportError';

export type EduroamStatus = 'idle' | 'working' | 'done' | 'error';

// Embed the .p12 password into the profile? Default false: the downloaded file
// is then NOT a standalone credential and macOS prompts for the password at
// install (we show it with a copy button). Flip to true for one-tap install.
const EMBED_PASSWORD = false;

// macOS deep link straight to the Profiles / Device Management pane.
const PROFILES_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preferences.configurationprofiles';

export function useEduroamSetup() {
  const [status, setStatus] = useState<EduroamStatus>('idle');
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setStatus('working');
    setError(null);
    setPassword(null);
    try {
      const { rootCaDer, clientP12, password: extractionPw } = await fetchEduroamCertMaterial();
      const xml = generateEduroamMobileconfig({
        rootCaDer,
        clientP12,
        p12Password: EMBED_PASSWORD ? (extractionPw ?? undefined) : undefined,
      });
      saveAs(
        new Blob([xml], { type: 'application/x-apple-aspen-config' }),
        'eduroam-reis.mobileconfig',
      );
      setPassword(extractionPw);
      setStatus('done');
    } catch (e) {
      logError('useEduroamSetup.run', e);
      setError((e as Error).message);
      setStatus('error');
    }
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
    password,
    error,
    run,
    openProfilesSettings,
    embedsPassword: EMBED_PASSWORD,
  };
}
