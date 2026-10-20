/**
 * useFileActions - Hook for file operations (open, download, download ZIP).
 */

import { useState, useCallback } from 'react';
import { normalizeFileUrl } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';
import { isNativeHost } from '../../mobile/openIsFile';
import { openNativeFile } from './openNativeFile';
import { useTranslation } from '../useTranslation';
import { DemoModeError, isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';
import { assertNotDemo } from './assertNotDemo';
import { downloadZipFiles } from './downloadZipFiles';
import type { DownloadTick } from './readBlobWithProgress';
import { fetchIsFile } from './fetchIsFile';
import { opensInTab, saveIsFile } from './saveBlob';
import { useRowDownloads } from './useRowDownloads';
import { noPdf, pdfOrNull } from './pdfOrNull';
import type { FileRowHint } from '../../utils/contentDisposition';

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
  /** `row` names the file when IS sends no Content-Disposition. */
  openFile: (link: string, row?: FileRowHint) => Promise<void>;
  /** The bytes of an IS PDF, or null when IS served a viewer page instead. */
  fetchPdfBlob: (link: string) => Promise<Blob | null>;
  openPdfInline: (link: string) => Promise<string | null>;
  downloadSingle: (link: string, row?: FileRowHint) => Promise<void>;
  downloadZip: (fileLinks: string[], zipFileName: string) => Promise<void>;
}

export function useFileActions(): UseFileActionsResult {
  const [isZipping, setIsZipping] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const { activeDownloads, claimRow, tickRow, clearRowProgress, releaseRow } = useRowDownloads();
  const { t } = useTranslation();

  const openFile = useCallback(
    async (link: string, row?: FileRowHint) => {
      // A row click downloads too, so it gets the row's indicator and lock just
      // as the download icon does — a .pptx row clicked on its body used to
      // fetch with nothing on screen saying so.
      if (!claimRow(link)) return;
      const fullUrl = normalizeFileUrl(link);

      try {
        // Capacitor: IS denies CORS to every origin, so the browser fetch below
        // always fails here — and its window.open fallback hands the URL to the
        // SYSTEM BROWSER, which has no IS session. Fetch natively instead.
        if (isNativeHost()) {
          await openNativeFile(
            fullUrl,
            'useFileActions.openFile',
            t,
            () => clearRowProgress(link),
            row
          );
          return;
        }

        assertNotDemo();
        const file = await fetchIsFile(fullUrl, tickRow(link));
        // A tab only for what a tab can show: a .pptx opened this way was saved
        // by the browser under the blob URL's GUID instead of its name.
        if (!opensInTab(file.blob)) {
          saveIsFile(file, row);
          return;
        }
        const blobUrl = URL.createObjectURL(file.blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
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
        // A failed fetch — a 403, IS down — still gets the student their file:
        // a top-level tab is first-party, so it carries the session.
        log.error('Failed to fetch file as blob, falling back to direct link', e);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      } finally {
        releaseRow(link);
      }
    },
    [t, claimRow, tickRow, clearRowProgress, releaseRow]
  );

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
        if (result.kind !== 'binary') return noPdf(`IS served a ${result.kind}, not a file`);
        return pdfOrNull(result.blob);
      }
      assertNotDemo();
      const { blob } = await fetchIsFile(fullUrl);
      return pdfOrNull(blob);
    } catch (e) {
      // Demo mode is not a failure: the download it falls back to says so.
      if (e instanceof DemoModeError) {
        log.error('Failed to fetch PDF inline', e);
        return null;
      }
      logError('useFileActions.fetchPdfBlob', e);
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

  /**
   * The row's own download. Every exit clears the row: a spinner that never
   * stops is worse than the missing spinner this replaced.
   *
   * Keyed by the link the ROW was rendered with, not by `normalizeFileUrl`'s
   * output — the row is what the student is looking at, and the two differ.
   */
  const downloadSingle = useCallback(
    async (link: string, row?: FileRowHint) => {
      if (!claimRow(link)) return;
      const fullUrl = normalizeFileUrl(link);
      try {
        // See openFile: the browser fetch and its window.open fallback are both
        // dead ends on Capacitor. `onHandoff` ends the row's busy state as the
        // share sheet opens (iOS) or the save finishes (Android) — NOT when the
        // bytes land: the base64 round trip and the write after that are the
        // slow part on a phone, and a row that went idle there while the lock
        // below still refused taps looked like a dead button. Nor on this
        // promise: on iOS it settles only once the student picks a folder, and a
        // row spinning through their own dialog says the app is still working.
        //
        // The indicator only. The lock is held until `finally`, so a tap under
        // a dismissing share sheet cannot start a duplicate download.
        if (isNativeHost()) {
          await openNativeFile(
            fullUrl,
            'useFileActions.downloadSingle',
            t,
            () => clearRowProgress(link),
            row
          );
          return;
        }
        assertNotDemo();
        const file = await fetchIsFile(fullUrl, tickRow(link));
        saveIsFile(file, row);
      } catch (e) {
        // See openFile: the direct-link fallback would bypass the demo guard.
        if (e instanceof DemoModeError) {
          logError('useFileActions.downloadSingle', e);
          return;
        }
        log.error('Failed to download file', e);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      } finally {
        releaseRow(link);
      }
    },
    [t, claimRow, tickRow, clearRowProgress, releaseRow]
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
