/**
 * useFileActions - Hook for file operations (open, download, download ZIP).
 */

import { useState, useCallback, useRef } from 'react';
import { normalizeFileUrl } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';
import { isNativeHost } from '../../mobile/openIsFile';
import { openNativeFile } from './openNativeFile';
import { useTranslation } from '../useTranslation';
import { DemoModeError, isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';
import { assertNotDemo } from './assertNotDemo';
import { downloadZipFiles } from './downloadZipFiles';
import { readBlobWithProgress, type DownloadTick } from './readBlobWithProgress';

const log = createLogger('useFileActions');

interface DownloadProgress {
  completed: number;
  total: number;
}

interface UseFileActionsResult {
  /** True while ANY download is running — single or zip. The header's bulk
   *  button reads this; a row reads `activeDownloads` instead. */
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  /** In-flight single downloads, keyed by the row's link. */
  activeDownloads: Record<string, DownloadTick>;
  openFile: (link: string) => Promise<void>;
  /** The bytes of an IS PDF, or null when IS served a viewer page instead. */
  fetchPdfBlob: (link: string) => Promise<Blob | null>;
  openPdfInline: (link: string) => Promise<string | null>;
  downloadSingle: (link: string) => Promise<void>;
  downloadZip: (fileLinks: string[], zipFileName: string) => Promise<void>;
}

export function useFileActions(): UseFileActionsResult {
  const [isZipping, setIsZipping] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadTick>>({});
  // A ref, not `activeDownloads`: a second click landing before React commits
  // the first `setActiveDownloads` would read an empty map and fire a duplicate
  // request. Same reasoning as useDocumentDownload's `inFlight`.
  const inFlight = useRef<Set<string>>(new Set());
  const { t } = useTranslation();

  const openFile = useCallback(
    async (link: string) => {
      const fullUrl = normalizeFileUrl(link);

      // Capacitor: IS denies CORS to every origin, so the browser fetch below
      // always fails here — and its window.open fallback hands the URL to the
      // SYSTEM BROWSER, which has no IS session. Fetch natively instead.
      if (isNativeHost()) {
        await openNativeFile(fullUrl, 'useFileActions.openFile', t);
        return;
      }

      try {
        assertNotDemo();
        const response = await fetch(fullUrl, { credentials: 'include' });

        if (!response.ok) {
          log.warn('Fetch failed, falling back to direct link');
          window.open(fullUrl, '_blank', 'noopener,noreferrer');
          return;
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        window.open(blobUrl, '_blank', 'noopener,noreferrer');

        // Clean up after 5 minutes
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
      } catch (e) {
        // A demo block must not fall through to the direct link: window.open
        // would hand the real IS URL to the browser and step straight over the
        // boundary assertNotDemo exists to hold. logError shows the demo toast
        // and reports nothing, so the student gets told instead.
        if (e instanceof DemoModeError) {
          logError('useFileActions.openFile', e);
          return;
        }
        log.error('Failed to fetch file as blob, falling back to direct link', e);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [t]
  );

  /**
   * IS serves viewer pages, and Office files, under anchors that look the same
   * as a document download — and reports no usable type for many of them. The
   * bytes are the only reliable answer, so a copy that is not a PDF is null and
   * the caller downloads it instead. It also keeps non-PDF bytes out of the iPad
   * reader's cache, which stores what it is given under a `.pdf` name.
   */
  const looksLikePdf = async (blob: Blob): Promise<boolean> =>
    (await blob.slice(0, 1024).text()).includes('%PDF-');

  const fetchPdfBlob = useCallback(async (link: string): Promise<Blob | null> => {
    const fullUrl = normalizeFileUrl(link);
    try {
      // Capacitor: fetch natively — no window.open, so no escape to Chrome.
      if (isNativeHost()) {
        const { fetchIsBinary } = await import('../../api/capacitorBinary');
        const { loadStoredToken } = await import('../../platform/tokenStore');
        const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
        const result = await fetchIsBinary(fullUrl, await loadStoredToken(), {
          platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
          setCookie: (o) => CapacitorCookies.setCookie(o),
          httpGet: (o) => CapacitorHttp.get(o),
        });
        // A viewer page is not a PDF — null lets the caller fall back to its
        // normal "can't preview" path. Neither are the Office files IS serves
        // through the same anchors, hence the byte check.
        if (result.kind !== 'binary') return null;
        return (await looksLikePdf(result.blob)) ? result.blob : null;
      }
      assertNotDemo();
      const response = await fetch(fullUrl, { credentials: 'include' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return (await looksLikePdf(blob)) ? blob : null;
    } catch (e) {
      log.error('Failed to fetch PDF inline', e);
      return null;
    }
  }, []);

  // The web viewer's input. The iPad reader (usePdfPreview → openPdfWithInk)
  // takes fetchPdfBlob directly, so both consume ONE fetch and a fallback from
  // one to the other never refetches.
  const openPdfInline = useCallback(
    async (link: string): Promise<string | null> => {
      const blob = await fetchPdfBlob(link);
      return blob ? URL.createObjectURL(blob) : null;
    },
    [fetchPdfBlob]
  );

  const clearRow = useCallback((link: string) => {
    inFlight.current.delete(link);
    setActiveDownloads((d) => {
      if (!(link in d)) return d;
      const next = { ...d };
      delete next[link];
      return next;
    });
  }, []);

  /**
   * The row's own download. Every exit clears the row: a spinner that never
   * stops is worse than the missing spinner this replaced.
   *
   * Keyed by the link the ROW was rendered with, not by `normalizeFileUrl`'s
   * output — the row is what the student is looking at, and the two differ.
   */
  const downloadSingle = useCallback(
    async (link: string) => {
      if (inFlight.current.has(link)) return;
      inFlight.current.add(link);
      setActiveDownloads((d) => ({ ...d, [link]: { loaded: 0, total: null } }));

      const fullUrl = normalizeFileUrl(link);
      try {
        // See openFile: the browser fetch and its window.open fallback are both
        // dead ends on Capacitor. `onFetched` ends the row's busy state as soon
        // as the bytes are in hand, because what follows is DELIVERY, not
        // download: on iOS that is the share sheet, which only settles once the
        // student picks a folder — the file is already saved by then, and a row
        // spinning through their own dialog says the app is still working when
        // it is waiting for them.
        if (isNativeHost()) {
          await openNativeFile(fullUrl, 'useFileActions.downloadSingle', t, () => clearRow(link));
          return;
        }
        assertNotDemo();
        const response = await fetch(fullUrl, { credentials: 'include' });
        if (!response.ok) {
          window.open(fullUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        const blob = await readBlobWithProgress(response, (tick) =>
          setActiveDownloads((d) => (link in d ? { ...d, [link]: tick } : d))
        );
        const cd = response.headers.get('content-disposition');
        const match = cd?.match(/filename="?([^"]+)"?/);
        const filename = match?.[1] || link.split('/').pop() || 'download';
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (e) {
        // See openFile: the direct-link fallback would bypass the demo guard.
        if (e instanceof DemoModeError) {
          logError('useFileActions.downloadSingle', e);
          return;
        }
        log.error('Failed to download file', e);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      } finally {
        clearRow(link);
      }
    },
    [t, clearRow]
  );

  const downloadZip = useCallback(async (fileLinks: string[], zipFileName: string) => {
    if (fileLinks.length < 2) return;

    // Checked once, before the workers spawn, rather than relying on the
    // per-worker assertNotDemo in downloadZipFiles: that one throws inside each
    // queued task, whose catch only logs and ticks progress, so a demo user
    // watched a progress bar run to completion and produce an empty zip with no
    // explanation. One toast for the action, not one per file — and the
    // per-worker guard stays as the actual network boundary.
    if (isDemoMode()) {
      logError('useFileActions.downloadZip', new DemoModeError());
      return;
    }

    setIsZipping(true);
    setDownloadProgress({ completed: 0, total: fileLinks.length });
    try {
      await downloadZipFiles(fileLinks, zipFileName, () =>
        setDownloadProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : null))
      );
    } catch (e) {
      log.error('Failed to generate/save ZIP', e);
    } finally {
      setIsZipping(false);
      setDownloadProgress(null);
    }
  }, []);

  return {
    isDownloading: isZipping || Object.keys(activeDownloads).length > 0,
    downloadProgress,
    activeDownloads,
    openFile,
    fetchPdfBlob,
    openPdfInline,
    downloadSingle,
    downloadZip,
  };
}
