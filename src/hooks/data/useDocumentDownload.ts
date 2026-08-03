import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { downloadDocument } from '../../api/proxyClient';
import { logError } from '../../utils/reportError';
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
          logError('Documents.download', e);
          setStatus((s) => ({ ...s, [id]: 'error' }));
        });
    },
    [tr]
  );

  return { status, run };
}
