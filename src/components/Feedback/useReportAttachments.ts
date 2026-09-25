import { useCallback, useEffect, useRef, useState } from 'react';
import { collectDiagnostics } from '../../utils/diagnostics/collectDiagnostics';
import { encodeScreenshot } from '../../utils/diagnostics/encodeScreenshot';
import type { SuggestionAttachmentsDraft } from '../../types/suggestions';

export interface Screenshot {
  base64: string;
  bytes: number;
  previewUrl: string;
}

/**
 * The report form's two optional attachments. Nothing is gathered until the
 * student acts: the diagnostic log is collected at Send, and only if the box is
 * ticked — so an untouched form holds nothing and sends nothing. The log itself
 * is not listed in the form (Dominik, 25 Sep 2026: "nobody cares about it");
 * the hint beside the box says what it contains, and the cleaning in
 * utils/diagnostics/diagnosticLog is what keeps it safe to send unread.
 */
export function useReportAttachments() {
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [encoding, setEncoding] = useState(false);
  const [encodeFailed, setEncodeFailed] = useState(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);

  // Object URLs are not garbage-collected; release the preview when it changes
  // or the form unmounts.
  useEffect(() => {
    const url = screenshot?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [screenshot]);

  // Every pick, paste and removal takes a new number; an encode that finishes
  // under an old number is stale. The picker stays enabled while encoding, so
  // without this a slow first image could replace a newer one, or bring back a
  // screenshot the student had just removed.
  const latest = useRef(0);

  const attachFile = useCallback(async (file: Blob | undefined | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const mine = ++latest.current;
    setEncoding(true);
    setEncodeFailed(false);
    const out = await encodeScreenshot(file);
    if (mine !== latest.current) return;
    setEncoding(false);
    if (!out) {
      setScreenshot(null);
      setEncodeFailed(true);
      return;
    }
    setScreenshot({
      base64: out.base64,
      bytes: out.bytes,
      previewUrl: URL.createObjectURL(out.blob),
    });
  }, []);

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith('image/')
      );
      if (!file) return;
      e.preventDefault();
      void attachFile(file);
    },
    [attachFile]
  );

  // Collected at Send rather than on tick: the newest entries are the ones
  // closest to what went wrong, and nothing is held while the box sits ticked.
  const draft = async (): Promise<SuggestionAttachmentsDraft> => ({
    diagnostics: includeDiagnostics ? await collectDiagnostics() : null,
    screenshotBase64: screenshot?.base64 ?? null,
  });

  return {
    screenshot,
    encoding,
    encodeFailed,
    attachFile,
    removeScreenshot: () => {
      latest.current++;
      setEncoding(false);
      setScreenshot(null);
    },
    onPaste,
    includeDiagnostics,
    setIncludeDiagnostics,
    draft,
  };
}

export type ReportAttachmentsState = ReturnType<typeof useReportAttachments>;
