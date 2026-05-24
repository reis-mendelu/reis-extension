import { lazy, Suspense, type ReactNode } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';

const PdfViewer = lazy(() => import('./PdfViewer').then(m => ({ default: m.PdfViewer })));

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
 *    is unmounted and PdfViewer's own close button is the path back. A 35/65
 *    side-by-side split is unreadable at phone width, so there is no split here.
 *  - desktop → the existing resizable side-by-side split (file list | PDF).
 */
export function PdfDrawerLayout({ isPhone, activePdfUrl, onClosePdf, fileList }: PdfDrawerLayoutProps) {
    if (isPhone) {
        return (
            <Suspense fallback={pdfFallback}>
                <PdfViewer blobUrl={activePdfUrl} onClose={onClosePdf} />
            </Suspense>
        );
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-2xl">
            <ResizablePanel defaultSize={35} minSize={20} className="flex flex-col">
                {fileList}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={65} minSize={30}>
                <Suspense fallback={pdfFallback}>
                    <PdfViewer blobUrl={activePdfUrl} onClose={onClosePdf} />
                </Suspense>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
