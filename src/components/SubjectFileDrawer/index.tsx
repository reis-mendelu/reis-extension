import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { DrawerHeader } from './DrawerHeader';
import { IndexedDBService } from '../../services/storage';
import { cleanFolderName } from '../../utils/fileUrl';
import { useSubjectFileDrawerState } from './useSubjectFileDrawerState';
import { SubjectFileDrawerContent } from './SubjectFileDrawerContent';
import { PdfViewer } from './PdfViewer';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import { useOsnovy } from '../../hooks/data';
import type { SelectedSubject } from '../../types/app';

export function SubjectFileDrawer({ lesson, isOpen, onClose }: { lesson: BlockLesson | SelectedSubject | null; isOpen: boolean; onClose: () => void }) {
    const state = useSubjectFileDrawerState(lesson, isOpen);
    const { isDownloading, downloadProgress, openFile, openPdfInline, downloadSingle, downloadZip } = useFileActions();
    const [showDragHint, setShowDragHint] = useState(false);
    const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const { t } = useTranslation();
    const { tests } = useOsnovy(lesson?.courseName);

    const tabCounts = useMemo(() => ({
        files: state.files?.reduce((acc, f) => acc + f.files.length, 0) || 0,
        osnovy: tests.length,
    }), [state.files, tests]);

    useEffect(() => {
        if (isOpen && state.files?.length) {
            IndexedDBService.get('meta', 'drag_hint_shown').then(seen => {
                if (!seen) {
                    IndexedDBService.set('meta', 'drag_hint_shown', true);
                    setTimeout(() => setShowDragHint(true), 800);
                    setTimeout(() => setShowDragHint(false), 4800);
                }
            });
        }
    }, [isOpen, state.files]);

    // Clean up blob URL when drawer closes
    useEffect(() => {
        if (!isOpen && activePdfUrl) {
            URL.revokeObjectURL(activePdfUrl);
            // Use queueMicrotask to avoid synchronous setState in effect
            queueMicrotask(() => setActivePdfUrl(null));
        }
    }, [isOpen, activePdfUrl]);

    const handleViewPdf = useCallback(async (link: string) => {
        if (isPdfLoading) return;
        setIsPdfLoading(true);
        const oldUrl = activePdfUrl;
        const blobUrl = await openPdfInline(link);
        if (blobUrl) {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            setActivePdfUrl(blobUrl);
        } else {
            openFile(link);
        }
        setIsPdfLoading(false);
    }, [activePdfUrl, openPdfInline, openFile, isPdfLoading]);

    const handleClosePdf = useCallback(() => {
        if (activePdfUrl) URL.revokeObjectURL(activePdfUrl);
        setActivePdfUrl(null);
    }, [activePdfUrl]);

    const handleClose = useCallback(() => {
        if (activePdfUrl) URL.revokeObjectURL(activePdfUrl);
        setActivePdfUrl(null);
        onClose();
    }, [activePdfUrl, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, handleClose]);

    const groupedFiles = useMemo(() => {
        if (!state.files) return [];
        const otherFolder = t('course.footer.other');
        const groups = new Map<string, ParsedFile[]>();
        state.files.forEach(f => {
            const sub = f.subfolder?.trim() || otherFolder;
            if (!groups.has(sub)) groups.set(sub, []);
            groups.get(sub)?.push(f);
        });
        return Array.from(groups.keys()).sort((a, b) => a === otherFolder ? 1 : b === otherFolder ? -1 : a.localeCompare(b, 'cs'))
            .map(key => ({
                name: key, displayName: key === otherFolder ? otherFolder : cleanFolderName(key, lesson?.courseCode),
                files: groups.get(key)!.sort((a, b) => (a.file_comment || a.file_name).localeCompare(b.file_comment || b.file_name, 'cs', { numeric: true }))
            }));
    }, [state.files, lesson, t]);

    const {
        activeTab, setActiveTab, files, isFilesLoading, isSyncing, isPriorityLoading, totalCount, resolvedCourseId, syllabusResult,
        containerRef, contentRef, fileRefs, selectedIds, isDragging, ignoreClickRef,
        handleMouseDown, toggleSelect, selectionBoxStyle
    } = state;

    const hasPdf = activePdfUrl !== null;

    if (!isOpen) return null;

    const fileListContent = (
        <>
            <DrawerHeader lesson={lesson} courseId={resolvedCourseId || syllabusResult.syllabus?.courseId || ''}
                courseInfo={syllabusResult.syllabus?.courseInfo} subjectInfo={state.subjectInfo} selectedCount={selectedIds.length}
                isDownloading={isDownloading} downloadProgress={downloadProgress} activeTab={activeTab} tabCounts={tabCounts} onTabChange={setActiveTab}
                onClose={handleClose} onDownload={() => selectedIds.length === 1 ? downloadSingle(selectedIds[0]) : downloadZip(selectedIds, `${lesson?.courseCode}_files.zip`)} />
            <div ref={containerRef} className="flex-1 overflow-y-auto relative select-none"
                onMouseDown={activeTab === 'files' ? handleMouseDown : undefined}
                style={{ cursor: activeTab === 'files' ? 'crosshair' : 'default' }}>
                <div ref={contentRef} className="min-h-full pb-20 relative">
                    <SubjectFileDrawerContent
                        activeTab={activeTab} lesson={lesson} files={files} isFilesLoading={isFilesLoading}
                        isSyncing={isSyncing} isPriorityLoading={isPriorityLoading} totalCount={totalCount}
                        isDragging={isDragging} selectionBoxStyle={selectionBoxStyle}
                        showDragHint={showDragHint} groupedFiles={groupedFiles} selectedIds={selectedIds}
                        fileRefs={fileRefs} ignoreClickRef={ignoreClickRef} toggleSelect={toggleSelect}
                        openFile={openFile} onViewPdf={handleViewPdf} resolvedCourseId={resolvedCourseId}
                        syllabusResult={syllabusResult} folderUrl={state.subjectInfo?.folderUrl}
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-0 sm:p-4 isolate"
             onTouchStart={(e) => e.stopPropagation()}
             onTouchMove={(e) => e.stopPropagation()}
             onTouchEnd={(e) => e.stopPropagation()}
        >
            <div className="absolute inset-0 bg-black/15 animate-in fade-in" onClick={handleClose} />
            <div className="w-full flex justify-end items-start h-full pt-0 pb-0 sm:pt-10 sm:pb-10 relative z-10 pointer-events-none">
                <div role="dialog" className={`bg-base-100 shadow-2xl rounded-2xl flex flex-col h-full animate-in slide-in-from-right pointer-events-auto border border-base-300 transition-[width] duration-300 relative ${hasPdf ? 'w-full sm:w-[90vw]' : 'w-full sm:w-[600px]'}`}>
                    {/* Loading overlay — shown during fetch regardless of hasPdf state */}
                    {isPdfLoading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-base-100/50 rounded-2xl">
                            <span className="loading loading-spinner loading-lg text-primary" />
                        </div>
                    )}
                    {hasPdf ? (
                        <ResizablePanelGroup direction="horizontal" className="h-full rounded-2xl">
                            <ResizablePanel defaultSize={35} minSize={20} className="flex flex-col">
                                {fileListContent}
                            </ResizablePanel>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize={65} minSize={30}>
                                <PdfViewer blobUrl={activePdfUrl} onClose={handleClosePdf} />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    ) : (
                        fileListContent
                    )}
                </div>
            </div>
        </div>
    );
}
