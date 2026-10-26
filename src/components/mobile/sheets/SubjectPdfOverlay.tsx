import { lazy, Suspense } from 'react';
import type { usePdfPreview } from '../../../hooks/ui/usePdfPreview';

// pdf.js and its worker are the heaviest thing the app can load; a student who
// never opens a PDF should never pay for it.
const PdfViewer = lazy(() =>
  import('../../SubjectFileDrawer/PdfViewer').then((m) => ({ default: m.PdfViewer }))
);

/**
 * The subject sheet's PDF reader (pdf.js), over the whole sheet rather than
 * inside the tab body: a phone or tablet has no room for the desktop's
 * side-by-side drawer, and the reader needs every pixel. Back closes the reader
 * first, the drawer second; so does Escape (PdfViewer is an Escape layer).
 */
export function SubjectPdfOverlay({
  url,
  position,
  onClose,
}: {
  url: string;
  position: ReturnType<typeof usePdfPreview>['previewPosition'];
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-base-100 pb-[var(--safe-bottom,0px)] pt-[var(--safe-top,0px)]"
      data-testid="mobile-pdf-preview-overlay"
    >
      {/* min-h-0 so the viewer's own scroll container can shrink inside
          this flex column rather than overflowing past the screen. */}
      <div className="min-h-0 flex-1">
        <Suspense fallback={null}>
          <PdfViewer key={url} blobUrl={url} onClose={onClose} {...position} />
        </Suspense>
      </div>
    </div>
  );
}
