import { FileText, Loader2 } from 'lucide-react';
import { FileList, FileListSkeleton } from './FileList';
import { SyllabusTab } from './SyllabusTab';
import { ClassmatesTab } from './ClassmatesTab';
import { ZaznamnikTab } from './ZaznamnikTab';
import { SuccessRateTab } from '../SuccessRateTab';
import { SelectionBox, DragHint } from './DragHint';
import { ISBacklink } from './ISBacklink';
import type { FileGroup } from './types';
import type { SyllabusRequirements, ParsedFile } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';


interface SubjectFileDrawerContentProps {
    activeTab: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik';
    lesson: BlockLesson | SelectedSubject | null;
    files: ParsedFile[] | null;
    isFilesLoading: boolean;
    isSyncing: boolean;
    isDragging: boolean;

    selectionBoxStyle: { left: number; top: number; width: number; height: number; } | null;
    showDragHint: boolean;
    groupedFiles: FileGroup[];
    selectedIds: string[];
    fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
    ignoreClickRef: React.MutableRefObject<boolean>;
    toggleSelect: (id: string, e: React.MouseEvent) => void;
    openFile: (link: string) => void;
    onViewPdf?: (link: string) => void;
    onOpenNote?: (link: string, name: string) => void;
    onDownloadSingle?: (link: string) => void;
    resolvedCourseId: string;
    syllabusResult: { syllabus: SyllabusRequirements | null; isLoading: boolean };
    folderUrl?: string;
    lastVisitedAt?: number | null;
}

export function SubjectFileDrawerContent({
    activeTab, lesson, files, isFilesLoading, isSyncing, isDragging, selectionBoxStyle, showDragHint,
    groupedFiles, selectedIds, fileRefs, ignoreClickRef, toggleSelect, openFile, onViewPdf, onOpenNote, onDownloadSingle, resolvedCourseId, syllabusResult, folderUrl, lastVisitedAt
}: SubjectFileDrawerContentProps) {
    const { t, language } = useTranslation();

    if (activeTab === 'files') {
        const isEmpty = !files || files.length === 0;
        const showSkeleton = isFilesLoading && isEmpty;
        const showProgress = showSkeleton || (isSyncing && isEmpty);

        return (
            <>
                <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                <DragHint show={showDragHint} />
                {showProgress && (
                    <div className="flex items-center gap-2 text-xs text-base-content/70 font-medium px-6 py-4 bg-base-200/30 border-b border-base-300 animate-in fade-in slide-in-from-top-1">
                        <Loader2 size={12} className="text-primary animate-spin" />
                        <span>{t('course.sync.loadingFiles') || 'Loading files...'}</span>
                    </div>
                )}

                {showSkeleton ? <FileListSkeleton /> :
                 isEmpty && !showProgress ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <FileText className="w-12 h-12 text-base-content/20 mb-3" />
                        <p className="text-sm text-base-content/60">
                            {lesson?.isFromSearch ? t('course.footer.searchOnlyInSchedule') : 
                            t('course.footer.noFilesAvailable')}
                        </p>
                        {folderUrl && (
                            <ISBacklink
                                href={folderUrl.includes('?') ? `${folderUrl};lang=${language === 'cz' ? 'cz' : 'en'}` : `${folderUrl}?lang=${language === 'cz' ? 'cz' : 'en'}`}
                                showBorder={false}
                            />
                        )}
                    </div>
                 ) : (
                    <FileList groups={groupedFiles} selectedIds={selectedIds} courseCode={lesson?.courseCode || ''}
                               fileRefs={fileRefs} ignoreClickRef={ignoreClickRef} onToggleSelect={toggleSelect}
                               onOpenFile={openFile} onViewPdf={onViewPdf} onOpenNote={onOpenNote} onDownloadSingle={onDownloadSingle} folderUrl={folderUrl} lastVisitedAt={lastVisitedAt} />
                 )}
            </>
        );
    }

    if (activeTab === 'syllabus') return <SyllabusTab courseCode={lesson?.courseCode || ''} courseId={resolvedCourseId} courseName={lesson?.courseName ?? ''} prefetchedResult={syllabusResult} />;
    if (activeTab === 'classmates') return <ClassmatesTab courseCode={lesson?.courseCode || ''} />;
    if (activeTab === 'zaznamnik') return <ZaznamnikTab courseCode={lesson?.courseCode || ''} />;

    return <SuccessRateTab courseCode={lesson?.courseCode || ''} facultyCode={(lesson as { facultyCode?: string } | null)?.facultyCode} />;
}
