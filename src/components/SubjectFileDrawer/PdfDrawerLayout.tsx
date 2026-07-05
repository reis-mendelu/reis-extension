import { lazy, Suspense, type ReactNode } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useTranslation } from '../../hooks/useTranslation';

const PdfViewer = lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })));

const pdfFallback = (
  <div className="flex justify-center items-center h-full bg-base-300/30">
    <span className="loading loading-spinner loading-lg text-primary" />
  </div>
);

interface PdfDrawerLayoutProps {
  isPhone: boolean;
  activePdfUrl: string;
  onClosePdf: () => void;
  /** The file-list column, rendered beside the PDF on desktop only. */
  fileList: ReactNode;
}

/**
 * Presentation for the drawer once a PDF is open inline.
 *  - phone (vaul bottom sheet) → PDF takes over the whole sheet; the file list
 *    is unmounted, so PdfViewer's close button (and the error fallback's "back"
 *    button on a failed load) are the path back. A 35/65 side-by-side split is
 *    unreadable at phone width, so there is no split here.
 *  - desktop → the existing resizable side-by-side split (file list | PDF).
 */
export function PdfDrawerLayout({
  isPhone,
  activePdfUrl,
  onClosePdf,
  fileList,
}: PdfDrawerLayoutProps) {
  const { t } = useTranslation();

  // ErrorBoundary catches a failed lazy import (chunk load failure) so the
  // phone user — whose file list is unmounted — isn't left with a blank tree
  // or an endless spinner and no way back.
  const pdfErrorFallback = (
    <div className="flex flex-col gap-3 justify-center items-center h-full bg-base-300/30 p-6 text-center">
      <p className="text-sm text-base-content/70">{t('course.pdf.loadFailed')}</p>
      <button className="btn btn-sm btn-primary" onClick={onClosePdf}>
        {t('course.pdf.back')}
      </button>
    </div>
  );

  const pdfView = (
    <ErrorBoundary resetKey={activePdfUrl} fallback={pdfErrorFallback}>
      <Suspense fallback={pdfFallback}>
        <PdfViewer key={activePdfUrl} blobUrl={activePdfUrl} onClose={onClosePdf} />
      </Suspense>
    </ErrorBoundary>
  );

  if (isPhone) {
    return pdfView;
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full rounded-2xl">
      <ResizablePanel defaultSize={35} minSize={20} className="flex flex-col">
        {fileList}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65} minSize={30}>
        {pdfView}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
