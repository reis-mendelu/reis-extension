import { useState, useEffect, useMemo } from 'react';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { DrawerHeader } from './DrawerHeader';
import { IndexedDBService } from '../../services/storage';
import { cleanFolderName } from '../../utils/fileUrl';
import { useSubjectFileDrawerState } from './useSubjectFileDrawerState';
import { SubjectFileDrawerContent } from './SubjectFileDrawerContent';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';

export function SubjectFileDrawer({ lesson, isOpen, onClose }: { lesson: BlockLesson | null; isOpen: boolean; onClose: () => void }) {
    const state = useSubjectFileDrawerState(lesson, isOpen);
    const { isDownloading, downloadProgress, openFile, downloadZip } = useFileActions();
    const [showDragHint, setShowDragHint] = useState(false);
    const { t } = useTranslation();

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

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
            <div className="absolute inset-0 bg-black/15 animate-in fade-in" onClick={onClose} />
            <div className="w-full flex justify-end items-start h-full pt-10 pb-10 relative z-10 pointer-events-none">
                <div role="dialog" className="w-[600px] bg-base-100 shadow-2xl rounded-2xl flex flex-col h-full animate-in slide-in-from-right pointer-events-auto border border-base-300">
                    <DrawerHeader lesson={lesson} courseId={state.resolvedCourseId || state.syllabusResult.syllabus?.courseId || ''}
                        courseInfo={state.syllabusResult.syllabus?.courseInfo} selectedCount={state.selectedIds.length}
                        isDownloading={isDownloading} downloadProgress={downloadProgress} activeTab={state.activeTab} onTabChange={state.setActiveTab}
                        onClose={onClose} onDownload={() => downloadZip(state.selectedIds, `${lesson?.courseCode}_files.zip`)} />
                    <div ref={state.containerRef} className="flex-1 overflow-y-auto relative select-none"
                        onMouseDown={state.activeTab === 'files' ? state.handleMouseDown : undefined}
                        style={{ cursor: state.activeTab === 'files' ? 'crosshair' : 'default' }}>
                        <div ref={state.contentRef} className="min-h-full pb-20 relative">
                            <SubjectFileDrawerContent {...state} lesson={lesson} showDragHint={showDragHint} groupedFiles={groupedFiles} openFile={openFile} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
