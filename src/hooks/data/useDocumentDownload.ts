import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { downloadDocument } from '../../api/proxyClient';
import { logError } from '../../utils/reportError';
import { DemoModeError } from '../../errors/demoMode';
import { isShareCancellation } from '../../errors/shareCanceled';
import { useTranslation } from '../useTranslation';

export type DownloadStatus = 'idle' | 'loading' | 'done' | 'error';

/** Per-row download state for the documents drawer. Not in the store — this is
 *  transient UI state scoped to the open drawer. */
export function useDocumentDownload() {
  const { t: tr } = useTranslation();
  const [status, setStatus] = useState<Record<string, DownloadStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Tracks ids with an in-flight download. A ref (not `status`, which can be
  // stale in this closure across rapid re-renders) so a ghost double-click
  // firing before the first `setStatus('loading')` commit can't slip through.
  const inFlight = useRef<Set<string>>(new Set());

  // Cancel any pending done→idle resets if the drawer unmounts.
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    []
  );

  /**
   * `fallbackUrl` is the unsealed variant of the same document. When the sealed
   * endpoint fails, the downloader saves that instead and reports back — and
   * the student is TOLD, because an unsealed copy can be refused by the office
   * they take it to. A silent downgrade is the one way this fallback can harm.
   */
  const run = useCallback(
    (id: string, url: string, filename: string, fallbackUrl?: string | null) => {
      if (inFlight.current.has(id)) return;
      inFlight.current.add(id);
      clearTimeout(timers.current[id]);
      setStatus((s) => ({ ...s, [id]: 'loading' }));
      downloadDocument(url, filename, fallbackUrl)
        .then((res) => {
          inFlight.current.delete(id);
          if (res?.usedFallback)
            toast.warning(tr('documents.unsealedFallback'), { duration: 6000 });
          setStatus((s) => ({ ...s, [id]: 'done' }));
          timers.current[id] = setTimeout(() => setStatus((s) => ({ ...s, [id]: 'idle' })), 2000);
        })
        .catch((e) => {
          inFlight.current.delete(id);
          // Two kinds of "not an error" reach here, and both go back to idle
          // rather than 'error' for the same reason: nothing is broken, so a
          // warning triangle would say the app is.
          //
          //  - DemoModeError: the download was refused on purpose.
          //  - A dismissed iOS share sheet: on iOS the file is written to
          //    Documents BEFORE the sheet opens, so the download had already
          //    succeeded and the student only declined a destination —
          //    "I cancel the dialog (where to save it), it just shows a
          //    warning icon. That makes little sense."
          const declined = e instanceof DemoModeError || isShareCancellation(e);
          if (!declined) {
            // Said out loud, once, at the moment it happens. The row's icon
            // alone could not be read or tapped: "I can't click the warning or
            // anything to see what it's about."
            toast.error(tr('documents.downloadFailed'), { duration: 6000 });
          }
          // Not reported when declined either: neither is a fault, and
          // telemetry for "the student pressed Cancel" is noise.
          if (!declined) logError('Documents.download', e);
          setStatus((s) => ({ ...s, [id]: declined ? 'idle' : 'error' }));
        });
    },
    [tr]
  );

  return { status, run };
}
