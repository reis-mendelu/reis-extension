import { useCallback, useEffect, useState } from 'react';
import { collectDiagnostics, type DiagnosticsPayload } from '../../utils/diagnostics/collectDiagnostics';
import { encodeScreenshot } from '../../utils/diagnostics/encodeScreenshot';
import type { SuggestionAttachmentsDraft } from '../../types/suggestions';

export interface Screenshot {
  base64: string;
  bytes: number;
  previewUrl: string;
}

/**
 * The report form's two optional attachments. Nothing is gathered until the
 * student acts: diagnostics are collected when they tick the box, not when the
 * form opens, so an untouched form holds nothing and sends nothing. What is
 * sent is exactly the list they were shown, minus the lines they removed.
 */
export function useReportAttachments() {
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [encoding, setEncoding] = useState(false);
  const [encodeFailed, setEncodeFailed] = useState(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null);

  // Object URLs are not garbage-collected; release the preview when it changes
  // or the form unmounts.
  useEffect(() => {
    const url = screenshot?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [screenshot]);

  const attachFile = useCallback(async (file: Blob | undefined | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setEncoding(true);
    setEncodeFailed(false);
    const out = await encodeScreenshot(file);
    setEncoding(false);
    if (!out) {
      setScreenshot(null);
      setEncodeFailed(true);
      return;
    }
    setScreenshot({ base64: out.base64, bytes: out.bytes, previewUrl: URL.createObjectURL(out.blob) });
  }, []);

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void attachFile(file);
    },
    [attachFile]
  );

  const toggleDiagnostics = useCallback(async (on: boolean) => {
    setIncludeDiagnostics(on);
    if (on && !diagnostics) setDiagnostics(await collectDiagnostics());
  }, [diagnostics]);

  const removeEntry = useCallback((index: number) => {
    setDiagnostics((d) => (d ? { ...d, entries: d.entries.filter((_, i) => i !== index) } : d));
  }, []);

  const draft = (): SuggestionAttachmentsDraft => ({
    diagnostics: includeDiagnostics ? diagnostics : null,
    screenshotBase64: screenshot?.base64 ?? null,
  });

  return {
    screenshot,
    encoding,
    encodeFailed,
    attachFile,
    removeScreenshot: () => setScreenshot(null),
    onPaste,
    includeDiagnostics,
    diagnostics,
    toggleDiagnostics,
    removeEntry,
    draft,
  };
}

export type ReportAttachmentsState = ReturnType<typeof useReportAttachments>;
