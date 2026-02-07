import { FileText } from 'lucide-react';
import { FileList, FileListSkeleton } from './FileList';
import { AssessmentTab } from './AssessmentTab';
import { SyllabusTab } from './SyllabusTab';
import { SuccessRateTab } from '../SuccessRateTab';
import { SelectionBox, DragHint } from './DragHint';
import type { FileGroup } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson } from '../../types/calendarTypes';

interface SubjectFileDrawerContentProps {
    activeTab: 'files' | 'stats' | 'assessments' | 'syllabus';
    lesson: BlockLesson | null;
    files: any[] | null;
    isFilesLoading: boolean;
    isSyncing: boolean;
    isDragging: boolean;
    selectionBoxStyle: any;
    showDragHint: boolean;
    groupedFiles: FileGroup[];
    selectedIds: string[];
    fileRefs: any;
    ignoreClickRef: any;
    toggleSelect: (id: string, e: React.MouseEvent) => void;
    openFile: (file: any) => void;
    resolvedCourseId: string;
    syllabusResult: any;
}

export function SubjectFileDrawerContent({
    activeTab, lesson, files, isFilesLoading, isSyncing, isDragging, selectionBoxStyle, showDragHint,
    groupedFiles, selectedIds, fileRefs, ignoreClickRef, toggleSelect, openFile, resolvedCourseId, syllabusResult
}: SubjectFileDrawerContentProps) {
    const { t } = useTranslation();
    if (activeTab === 'files') {
        return (
            <>
                <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                <DragHint show={showDragHint} />
                {(isFilesLoading || (isSyncing && files === null)) ? <FileListSkeleton /> :
                 (!files || files.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <FileText className="w-12 h-12 text-base-content/20 mb-3" />
                        <p className="text-sm text-base-content/60">
                            {lesson?.isFromSearch ? t('course.footer.searchOnlyInSchedule') : 
                            t('course.footer.noFilesAvailable')}
                        </p>
                    </div>
                 ) : (
                    <FileList groups={groupedFiles} selectedIds={selectedIds} fileRefs={fileRefs}
                              ignoreClickRef={ignoreClickRef} onToggleSelect={toggleSelect} onOpenFile={openFile} />
                 )}
            </>
        );
    }
    if (activeTab === 'assessments') return <AssessmentTab courseCode={lesson?.courseCode || ''} />;
    if (activeTab === 'syllabus') return <SyllabusTab courseCode={lesson?.courseCode || ''} courseId={resolvedCourseId} courseName={(lesson as any)?.courseName} prefetchedResult={syllabusResult} />;
    return <SuccessRateTab courseCode={lesson?.courseCode || ''} />;
}
