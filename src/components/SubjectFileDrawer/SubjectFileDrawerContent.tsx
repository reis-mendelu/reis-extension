import { FileText, ExternalLink, Check, Loader2 } from 'lucide-react';
import { FileList, FileListSkeleton } from './FileList';
import { AssessmentTab } from './AssessmentTab';
import { SyllabusTab } from './SyllabusTab';
import { ClassmatesTab } from './ClassmatesTab';
import { SuccessRateTab } from '../SuccessRateTab';
import { SelectionBox, DragHint } from './DragHint';
import type { FileGroup } from './types';
import type { SyllabusRequirements } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';

function StatusTicks({ status, count }: { status?: string, count: number }) {
    const { t } = useTranslation();
    
    const steps = [
        { id: 'initializing', label: t('course.sync.initializing') || 'Initializing...' },
        { id: 'fetching_first', label: t('course.sync.fetchingFirst') || 'Finding first files...' },
        { id: 'syncing_remaining', label: (t('course.sync.syncingRemaining') || 'Syncing remaining files...').replace('{count}', count.toString()) },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === status);
    const isError = status === 'error';
    const isSuccess = status === 'success';

    if (isSuccess && count > 0) return null; // Hide if successful and we have files

    return (
        <div className="flex flex-col gap-1.5">
            {steps.map((step, idx) => {
                const isPast = currentStepIndex > idx || isSuccess;
                const isCurrent = currentStepIndex === idx && !isSuccess && !isError;
                const isFuture = currentStepIndex < idx && !isSuccess;

                if (isFuture) return null;

                return (
                    <div key={step.id} className="flex items-center gap-2 text-xs transition-all animate-in fade-in slide-in-from-left-1">
                        {isPast ? (
                            <Check size={12} className="text-success" />
                        ) : isCurrent ? (
                            <Loader2 size={12} className="text-primary animate-spin" />
                        ) : null}
                        <span className={isPast ? 'text-base-content/40' : 'text-base-content/70 font-medium'}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
            {isError && (
                <div className="text-xs text-error flex items-center gap-2">
                    <span>!</span>
                    <span>{t('course.sync.failed') || 'Sync failed'}</span>
                </div>
            )}
        </div>
    );
}


interface SubjectFileDrawerContentProps {
    activeTab: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates';
    lesson: BlockLesson | SelectedSubject | null;
    files: unknown[] | null;
    isFilesLoading: boolean;
    isSyncing: boolean;
    isPriorityLoading?: boolean;
    progressStatus?: string;
    isDragging: boolean;

    selectionBoxStyle: { left: number; top: number; width: number; height: number; } | null;
    showDragHint: boolean;
    groupedFiles: FileGroup[];
    selectedIds: string[];
    fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
    ignoreClickRef: React.MutableRefObject<boolean>;
    toggleSelect: (id: string, e: React.MouseEvent) => void;
    openFile: (link: string) => void;
    resolvedCourseId: string;
    syllabusResult: { syllabus: SyllabusRequirements | null; isLoading: boolean };
    folderUrl?: string;
}

export function SubjectFileDrawerContent({
    activeTab, lesson, files, isFilesLoading, isSyncing, isPriorityLoading, progressStatus, isDragging, selectionBoxStyle, showDragHint,
    groupedFiles, selectedIds, fileRefs, ignoreClickRef, toggleSelect, openFile, resolvedCourseId, syllabusResult, folderUrl
}: SubjectFileDrawerContentProps) {
    const { t, language } = useTranslation();
    if (activeTab === 'files') {
        const isEmpty = !files || files.length === 0;
        const showSkeleton = (isFilesLoading || (isPriorityLoading && isEmpty)) && !isSyncing;
        const showProgress = isPriorityLoading || (isSyncing && isEmpty);
        
        return (
            <>
                <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                <DragHint show={showDragHint} />
                {showProgress && (
                    <div className="px-6 py-4 bg-base-200/30 border-b border-base-300 animate-in fade-in slide-in-from-top-1">
                        <StatusTicks status={progressStatus} count={files?.length || 0} />
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
                            <a 
                                href={folderUrl.includes('?') ? `${folderUrl};lang=${language === 'cz' ? 'cz' : 'en'}` : `${folderUrl}?lang=${language === 'cz' ? 'cz' : 'en'}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary normal-case font-bold mt-4"
                            >
                                <span>IS MENDELU</span>
                                <ExternalLink size={16} />
                            </a>
                        )}
                    </div>
                 ) : (
                    <FileList groups={groupedFiles} selectedIds={selectedIds} fileRefs={fileRefs}
                               ignoreClickRef={ignoreClickRef} onToggleSelect={toggleSelect} onOpenFile={openFile} 
                               folderUrl={folderUrl} />
                 )}
            </>
        );
    }

    if (activeTab === 'assessments') return <AssessmentTab courseCode={lesson?.courseCode || ''} />;
    if (activeTab === 'syllabus') return <SyllabusTab courseCode={lesson?.courseCode || ''} courseId={resolvedCourseId} courseName={lesson?.courseName ?? ''} prefetchedResult={syllabusResult} />;
    if (activeTab === 'classmates') return <ClassmatesTab courseCode={lesson?.courseCode || ''} skupinaId={lesson && 'skupinaId' in lesson ? (lesson as any).skupinaId : undefined} />;
    return <SuccessRateTab courseCode={lesson?.courseCode || ''} facultyCode={'facultyCode' in (lesson ?? {}) ? (lesson as { facultyCode?: string }).facultyCode : undefined} />;
}
