import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Dynamic import() of ES modules fails under chrome-extension:// protocol.
// Fetch the worker script as text and serve it via a blob URL instead.
import workerPath from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { computeRenderWindow } from './pdfWindow';

let workerReadyPromise: Promise<void> | null = null;

function getWorkerReady(): Promise<void> {
    if (!workerReadyPromise) {
        try {
            workerReadyPromise = fetch(chrome.runtime.getURL(workerPath))
                .then(r => r.text())
                .then(text => {
                    const url = URL.createObjectURL(new Blob([text], { type: 'application/javascript' }));
                    pdfjs.GlobalWorkerOptions.workerSrc = url;
                });
        } catch {
            return Promise.reject(new Error('Extension context invalidated'));
        }
    }
    return workerReadyPromise;
}

interface PdfViewerProps {
    blobUrl: string;
    onClose: () => void;
}

// pdf.js advises against mounting more than ~25 page canvases at once; mobile
// browsers crash the canvas well before that. Mount only the visible pages plus
// a small buffer (see computeRenderWindow); off-screen pages keep a sized
// placeholder so the scroll height stays stable.
const PAGE_BUFFER = 2;

export function PdfViewer({ blobUrl, onClose }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1.0);
    const [ready, setReady] = useState(false);
    const [visible, setVisible] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    // Page height at scale 1, used to size placeholders for unmounted pages.
    const [baseHeight, setBaseHeight] = useState(0);

    useEffect(() => {
        getWorkerReady().then(() => setReady(true)).catch(() => {});
    }, []);

    // Single observer for the scroll container; page wrappers register on mount.
    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;
        const io = new IntersectionObserver(
            (entries) => {
                setVisible((prev) => {
                    const next = new Set(prev);
                    for (const e of entries) {
                        const idx = Number((e.target as HTMLElement).dataset.pageIndex);
                        if (e.isIntersecting) next.add(idx);
                        else next.delete(idx);
                    }
                    return next;
                });
            },
            { root, rootMargin: '300px 0px' },
        );
        observerRef.current = io;
        return () => { io.disconnect(); observerRef.current = null; };
    }, []);

    const registerPage = useCallback((el: HTMLDivElement | null, idx: number) => {
        if (!el) return;
        el.dataset.pageIndex = String(idx);
        observerRef.current?.observe(el);
    }, []);

    const onDocumentLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        setBaseHeight(viewport.height);
        // Wait for the drawer's width transition (duration-300) to finish before measuring
        setTimeout(() => {
            const containerWidth = containerRef.current?.clientWidth;
            if (containerWidth) {
                const fitScale = containerWidth / viewport.width;
                setScale(fitScale);
            }
        }, 350);
    }, []);

    const renderSet = computeRenderWindow(visible, numPages, PAGE_BUFFER);
    const placeholderHeight = baseHeight ? baseHeight * scale : 800;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200/50 shrink-0">
                <div className="flex items-center gap-1">
                    <button className="btn btn-ghost btn-xs btn-square" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>
                        <ZoomOut size={14} />
                    </button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button className="btn btn-ghost btn-xs btn-square" onClick={() => setScale(s => Math.min(3, s + 0.25))}>
                        <ZoomIn size={14} />
                    </button>
                    {numPages > 0 && (
                        <>
                            <span className="text-base-content/30 mx-1">·</span>
                            <span className="text-xs text-base-content/70 font-mono">{numPages} pages</span>
                        </>
                    )}
                </div>
                <div />
                <button className="btn btn-ghost btn-xs btn-square" onClick={onClose}>
                    <X size={14} />
                </button>
            </div>
            <div ref={containerRef} className="flex-1 overflow-auto bg-base-300/30">
                {!ready ? (
                    <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={24} /></div>
                ) : <Document file={blobUrl} onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={() => {}}
                    loading={<div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={24} /></div>}>
                    {Array.from({ length: numPages }, (_, i) => (
                        <div key={i} ref={(el) => registerPage(el, i)}
                            className="mb-4 flex justify-center"
                            style={renderSet.has(i) ? undefined : { minHeight: placeholderHeight }}>
                            {renderSet.has(i) && (
                                <Page pageNumber={i + 1} scale={scale}
                                    className="shadow-lg mx-auto"
                                    renderTextLayer={false} renderAnnotationLayer={false} />
                            )}
                        </div>
                    ))}
                </Document>}
            </div>
        </div>
    );
}
