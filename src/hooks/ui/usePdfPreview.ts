import { useCallback, useEffect, useState } from 'react';
import { useFileActions } from './useFileActions';

export interface PdfPreviewFile {
  link: string;
  name: string;
}

/**
 * "Tap to look, press to save" for a file row.
 *
 * The phone/tablet drawer used to hand every tap straight to `openFile`, which
 * on Capacitor means fetch → write → the iOS share sheet: the student had to
 * export a document out of the app before they could read a single page of it.
 * The inline path already existed for desktop, so this packages the state it
 * needs — the blob URL, which file it belongs to, and the revoke — for reuse.
 *
 * A file that turns out not to be a real PDF (IS serves viewer pages under the
 * same anchors) falls back to the download rather than opening an empty viewer.
 */
export function usePdfPreview() {
  const { openFile, openPdfInline, downloadSingle, isDownloading, downloadProgress } =
    useFileActions();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PdfPreviewFile | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Blob URLs are held by the document until revoked; a drawer opened and
  // closed a dozen times would otherwise pin every PDF it ever showed in memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const viewPdf = useCallback(
    async (link: string, name?: string) => {
      if (isPreviewLoading) return;
      setIsPreviewLoading(true);
      try {
        const blobUrl = await openPdfInline(link);
        if (blobUrl) {
          setPreviewUrl(blobUrl);
          setPreviewFile({ link, name: name ?? 'PDF' });
        } else {
          await openFile(link);
        }
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [openPdfInline, openFile, isPreviewLoading]
  );

  const closePreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewFile(null);
  }, []);

  return {
    previewUrl,
    previewFile,
    isPreviewLoading,
    viewPdf,
    closePreview,
    openFile,
    downloadSingle,
    isDownloading,
    downloadProgress,
  };
}
