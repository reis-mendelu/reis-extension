import { logError } from '../../utils/reportError';

/**
 * IS serves viewer pages, and Office files, under anchors that look the same
 * as a document download — and reports no usable type for many of them. The
 * bytes are the only reliable answer, so a copy that is not a PDF is null and
 * the caller downloads it instead. It also keeps non-PDF bytes out of the iPad
 * reader's cache, which stores what it is given under a `.pdf` name.
 */
async function looksLikePdf(blob: Blob): Promise<boolean> {
  return (await blob.slice(0, 1024).text()).includes('%PDF-');
}

/**
 * Every null from `fetchPdfBlob` goes to `logError`, not the logger: the logger
 * writes `console.log`, which the diagnostic log a report can attach never
 * sees. A null is what the iPad reader turns into "Soubor se nepodařilo
 * otevřít" for a stale copy or a sidebar file, and suggestion #32 (16 Oct)
 * reported exactly that with no way to tell which reason it was.
 */
export function noPdf(reason: string): null {
  logError('useFileActions.fetchPdfBlob', new Error(reason));
  return null;
}

export async function pdfOrNull(blob: Blob): Promise<Blob | null> {
  return (await looksLikePdf(blob)) ? blob : noPdf(`not a PDF (${blob.type || 'no type'})`);
}
