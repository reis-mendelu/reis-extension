import { FileText, ExternalLink } from 'lucide-react';
import { FileList, FileListSkeleton } from './FileList';
import { AssessmentTab } from './AssessmentTab';
import { SyllabusTab } from './SyllabusTab';
import { SuccessRateTab } from '../SuccessRateTab';
import { SelectionBox, DragHint } from './DragHint';
import type { FileGroup } from './types';
import type { SyllabusRequirements } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';

interface SubjectFileDrawerContentProps {
    activeTab: 'files' | 'stats' | 'assessments' | 'syllabus';
    lesson: BlockLesson | SelectedSubject | null;
    files: unknown[] | null;
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
    resolvedCourseId: string;
    syllabusResult: { syllabus: SyllabusRequirements | null; isLoading: boolean };
    folderUrl?: string;
}

export function SubjectFileDrawerContent({
    activeTab, lesson, files, isFilesLoading, isSyncing, isDragging, selectionBoxStyle, showDragHint,
    groupedFiles, selectedIds, fileRefs, ignoreClickRef, toggleSelect, openFile, resolvedCourseId, syllabusResult, folderUrl
}: SubjectFileDrawerContentProps) {
    const { t, language } = useTranslation();
    if (activeTab === 'files') {
        const isEmpty = !files || files.length === 0;
        const showSkeleton = isFilesLoading || (isSyncing && isEmpty);
        
        if (showSkeleton) {
            console.log(`[SubjectFileDrawerContent] ${lesson?.courseCode}: ⏳ LOADING START (isSyncing=${isSyncing}, files=${files?.length ?? 'none'})`);
        } else if (files && files.length > 0) {
            console.log(`[SubjectFileDrawerContent] ${lesson?.courseCode}: ✅ LOADING END - FILES FOUND: ${files.length}`);
        } else {
            console.log(`[SubjectFileDrawerContent] ${lesson?.courseCode}: ⏹️ LOADING END - NO FILES AVAILABLE`);
        }
        
        return (
            <>
                <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                <DragHint show={showDragHint} />
                {showSkeleton ? <FileListSkeleton /> :
                 isEmpty ? (
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
    return <SuccessRateTab courseCode={lesson?.courseCode || ''} />;
}
