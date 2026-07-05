import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadDocument } from '../../api/proxyClient';
import { logError } from '../../utils/reportError';

export type DownloadStatus = 'idle' | 'loading' | 'done' | 'error';

/** Per-row download state for the documents drawer. Not in the store — this is
 *  transient UI state scoped to the open drawer. */
export function useDocumentDownload() {
  const [status, setStatus] = useState<Record<string, DownloadStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cancel any pending done→idle resets if the drawer unmounts.
  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
  }, []);

  const run = useCallback((id: string, url: string, filename: string) => {
    clearTimeout(timers.current[id]);
    setStatus(s => ({ ...s, [id]: 'loading' }));
    downloadDocument(url, filename)
      .then(() => {
        setStatus(s => ({ ...s, [id]: 'done' }));
        timers.current[id] = setTimeout(() => setStatus(s => ({ ...s, [id]: 'idle' })), 2000);
      })
      .catch((e) => {
        logError('Documents.download', e);
        setStatus(s => ({ ...s, [id]: 'error' }));
      });
  }, []);

  return { status, run };
}
