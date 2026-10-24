import { useState, useCallback, useRef } from 'react';
import type { DownloadTick } from './readBlobWithProgress';

/**
 * The subject drawer's per-row download state: which rows are fetching, their
 * byte ticks, and the lock that keeps a second click from starting a duplicate.
 * Every path that downloads a row's file goes through it, so a click on the
 * row's body looks the same as a click on its download icon.
 */
export function useRowDownloads() {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadTick>>({});
  // A ref, not `activeDownloads`: a second click landing before React commits
  // the first `setActiveDownloads` would read an empty map and fire a duplicate
  // request. Same reasoning as useDocumentDownload's `inFlight`.
  const inFlight = useRef<Set<string>>(new Set());

  /** Claims the row and starts its indicator; false when it is already downloading. */
  const claimRow = useCallback((link: string): boolean => {
    if (inFlight.current.has(link)) return false;
    inFlight.current.add(link);
    setActiveDownloads((d) => ({ ...d, [link]: { loaded: 0, total: null } }));
    return true;
  }, []);

  const tickRow = useCallback(
    (link: string) => (tick: DownloadTick) =>
      setActiveDownloads((d) => (link in d ? { ...d, [link]: tick } : d)),
    []
  );

  /** Ends the row's INDICATOR only. The lock is `releaseRow`'s. */
  const clearRowProgress = useCallback((link: string) => {
    setActiveDownloads((d) => {
      if (!(link in d)) return d;
      const next = { ...d };
      delete next[link];
      return next;
    });
  }, []);

  /** Ends the indicator AND releases the lock — only once delivery has settled. */
  const releaseRow = useCallback(
    (link: string) => {
      inFlight.current.delete(link);
      clearRowProgress(link);
    },
    [clearRowProgress]
  );

  return { activeDownloads, claimRow, tickRow, clearRowProgress, releaseRow };
}
