import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { DrawerHeader } from './DrawerHeader';
import { IndexedDBService } from '../../services/storage';
import { cleanFolderName } from '../../utils/fileUrl';
import { useSubjectFileDrawerState } from './useSubjectFileDrawerState';
import { SubjectFileDrawerContent } from './SubjectFileDrawerContent';
import { PdfDrawerLayout } from './PdfDrawerLayout';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import type { SelectedSubject } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';

export function SubjectFileDrawer({ lesson, isOpen, onClose }: { lesson: BlockLesson | SelectedSubject | null; isOpen: boolean; onClose: () => void }) {
    const state = useSubjectFileDrawerState(lesson, isOpen);
    const { isDownloading, downloadProgress, openFile, openPdfInline, downloadSingle, downloadZip } = useFileActions();
    const [showDragHint, setShowDragHint] = useState(false);
    const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
    const [lastVisitedAt, setLastVisitedAt] = useState<number | null | undefined>(undefined);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const { t } = useTranslation();
    const classmatesCount = useAppStore(s => lesson?.courseCode ? s.classmates[lesson.courseCode]?.length : undefined);
    const zaznamnikData = useAppStore(s => lesson?.courseCode ? s.zaznamnik?.[lesson.courseCode] : undefined);
    const isPhone = useAppStore(s => s.isTouch && s.isNarrow);

    const phSections = zaznamnikData?.ph.sections;
    const vtTests = zaznamnikData?.vt.tests;
    const maxZaznamnikCols = useMemo(() => {
        if (!phSections) return 0;
        return phSections.reduce((max, s) => Math.max(max, ...s.arches.map(a => a.columns.length)), 0);
    }, [phSections]);

    const tabCounts = useMemo(() => {
        const phCount = phSections?.reduce((n, s) => n + s.arches.filter(a => !a.empty).length, 0) ?? 0;
        const vtCount = vtTests?.length ?? 0;
        return {
            files: state.files?.reduce((acc, f) => acc + f.files.length, 0) || 0,
            classmates: classmatesCount || 0,
            // undefined = not yet loaded; 0 = loaded but empty; >0 = has data
            zaznamnik: zaznamnikData !== undefined ? phCount + vtCount : undefined,
        };
    }, [state.files, classmatesCount, zaznamnikData, phSections, vtTests]);

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

    useEffect(() => {
        const courseCode = lesson?.courseCode;
        if (!isOpen || !courseCode) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLastVisitedAt(undefined);
        const key = `file_last_visit_${courseCode}`;
        IndexedDBService.get('meta', key).then(prev => {
            setLastVisitedAt(prev ?? null);
            IndexedDBService.set('meta', key, Date.now());
        });
    }, [isOpen, lesson?.courseCode]);

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


    const groupedFiles = useMemo(() => {
        if (!state.files) return [];
        const otherFolder = t('course.footer.other');
        const knownFolderKeys: Record<string, string> = {
            'informace k výuce': 'fileCategories.informace_k_vyuce',
            'studijní texty': 'fileCategories.studijni_texty',
            'materiály z přednášek': 'fileCategories.materialy_z_prednasek',
            'průvodce studiem předmětu': 'fileCategories.pruvodce_studiem',
        };
        const translateFolder = (name: string) => {
            const i18nKey = knownFolderKeys[name.toLowerCase()];
            return i18nKey ? (t(i18nKey) || name) : name;
        };
        const groups = new Map<string, ParsedFile[]>();
        state.files.forEach(f => {
            const sub = f.subfolder?.trim() || otherFolder;
            if (!groups.has(sub)) groups.set(sub, []);
            groups.get(sub)?.push(f);
        });
        return Array.from(groups.keys())
            .map(key => ({
                name: key,
                displayName: key === otherFolder ? otherFolder : translateFolder(cleanFolderName(key, lesson?.courseCode)),
                files: groups.get(key)!.sort((a, b) => {
                    const parseDate = (d: string) => { const [day, mon, yr] = d.split('.').map(s => parseInt(s.trim(), 10)); return isNaN(yr) ? 0 : new Date(yr, mon - 1, day).getTime(); };
                    return parseDate(b.date) - parseDate(a.date) || (a.file_comment || a.file_name).localeCompare(b.file_comment || b.file_name, 'cs', { numeric: true });
                })
            }))
            .sort((a, b) => a.name === otherFolder ? 1 : b.name === otherFolder ? -1 : a.displayName.localeCompare(b.displayName));
    }, [state.files, lesson, t]);

    const {
        activeTab, setActiveTab, files, isFilesLoading, isSyncing, resolvedCourseId, syllabusResult,
        containerRef, contentRef, fileRefs, selectedIds, isDragging, ignoreClickRef,
        handleMouseDown, toggleSelect, selectionBoxStyle
    } = state;

    const hasPdf = activePdfUrl !== null;
    const needsWideDrawer = activeTab === 'zaznamnik' && maxZaznamnikCols >= 5;
    const drawerWidth = hasPdf
        ? 'sm:w-[90vw]'
        : needsWideDrawer
            ? 'sm:w-[800px]'
            : 'sm:w-[600px]';

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
                        isSyncing={isSyncing}
                        isDragging={isDragging} selectionBoxStyle={selectionBoxStyle}
                        showDragHint={showDragHint} groupedFiles={groupedFiles} selectedIds={selectedIds}
                        fileRefs={fileRefs} ignoreClickRef={ignoreClickRef} toggleSelect={toggleSelect}
                        openFile={openFile} onViewPdf={handleViewPdf} resolvedCourseId={resolvedCourseId}
                        syllabusResult={syllabusResult} folderUrl={state.subjectInfo?.folderUrl}
                        lastVisitedAt={lastVisitedAt}
                    />
                </div>
            </div>
        </>
    );

    return (
        <AdaptiveDrawer open={isOpen} onClose={handleClose} width={drawerWidth}>
            {/* Loading overlay — shown during fetch regardless of hasPdf state */}
            {isPdfLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-base-100/50 rounded-2xl">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            )}
            {hasPdf ? (
                <PdfDrawerLayout isPhone={isPhone} activePdfUrl={activePdfUrl} onClosePdf={handleClosePdf} fileList={fileListContent} />
            ) : (
                fileListContent
            )}
        </AdaptiveDrawer>
    );
}
