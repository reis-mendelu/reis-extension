import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// In a Chrome extension, `?url` resolves to a bare path like `/assets/pdf.worker.min-xxx.mjs`
// which the browser resolves against the IS page origin (not the extension origin) and 404s.
// chrome.runtime.getURL() gives the correct chrome-extension:// absolute URL.
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(workerUrl);

interface PdfViewerProps {
    blobUrl: string;
    onClose: () => void;
}

export function PdfViewer({ blobUrl, onClose }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1.0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('[PDF-DEBUG] PdfViewer mounted, blobUrl:', blobUrl);
        return () => console.log('[PDF-DEBUG] PdfViewer unmounted, blobUrl was:', blobUrl);
    }, [blobUrl]);

    const onDocumentLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
        console.log('[PDF-DEBUG] Document loaded successfully, pages:', pdf.numPages);
        setNumPages(pdf.numPages);
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        // Wait for the drawer's width transition (duration-300) to finish before measuring
        setTimeout(() => {
            const containerWidth = containerRef.current?.clientWidth;
            if (containerWidth) {
                const fitScale = containerWidth / viewport.width;
                console.log('[PDF-DEBUG] fit-to-width: container=', containerWidth, 'page=', viewport.width, 'scale=', fitScale);
                setScale(fitScale);
            }
        }, 350);
    }, []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200/50 shrink-0">
                <div className="flex items-center gap-1">
                    <button className="btn btn-ghost btn-xs btn-square" onClick={() => setScale(s => { const n = Math.max(0.5, s - 0.25); console.log('[PDF-DEBUG] scale:', n); return n; })}>
                        <ZoomOut size={14} />
                    </button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button className="btn btn-ghost btn-xs btn-square" onClick={() => setScale(s => { const n = Math.min(3, s + 0.25); console.log('[PDF-DEBUG] scale:', n); return n; })}>
                        <ZoomIn size={14} />
                    </button>
                </div>
                <span className="text-xs text-base-content/50">{numPages > 0 && `${numPages} pages`}</span>
                <button className="btn btn-ghost btn-xs btn-square" onClick={onClose}>
                    <X size={14} />
                </button>
            </div>
            <div ref={containerRef} className="flex-1 overflow-auto bg-base-300/30">
                <Document file={blobUrl} onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(err: Error) => console.error('[PDF-DEBUG] Document load error:', err)}
                    loading={<div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={24} /></div>}>
                    {Array.from({ length: numPages }, (_, i) => (
                        <Page key={i} pageNumber={i + 1} scale={scale}
                            className="mb-4 shadow-lg mx-auto"
                            renderTextLayer={false} renderAnnotationLayer={false} />
                    ))}
                </Document>
            </div>
        </div>
    );
}
