import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { FileList, FileListSkeleton } from './FileList';
import { AssessmentTab } from './AssessmentTab';
import { SyllabusTab } from './SyllabusTab';
import { ClassmatesTab } from './ClassmatesTab';
import { SuccessRateTab } from '../SuccessRateTab';
import { SelectionBox, DragHint } from './DragHint';
import { useCvicneTests } from '../../hooks/data';
import { useUserParams } from '../../hooks/useUserParams';
import type { FileGroup } from './types';
import type { SyllabusRequirements, ParsedFile } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';


interface SubjectFileDrawerContentProps {
    activeTab: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates' | 'cvicneTests';
    lesson: BlockLesson | SelectedSubject | null;
    files: ParsedFile[] | null;
    isFilesLoading: boolean;
    isSyncing: boolean;
    isPriorityLoading?: boolean;
    totalCount?: number;
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
    resolvedCourseId: string;
    syllabusResult: { syllabus: SyllabusRequirements | null; isLoading: boolean };
    folderUrl?: string;
}

export function SubjectFileDrawerContent({
    activeTab, lesson, files, isFilesLoading, isSyncing, isPriorityLoading, totalCount, isDragging, selectionBoxStyle, showDragHint,
    groupedFiles, selectedIds, fileRefs, ignoreClickRef, toggleSelect, openFile, onViewPdf, resolvedCourseId, syllabusResult, folderUrl
}: SubjectFileDrawerContentProps) {
    const { t, language } = useTranslation();
    const { tests, status: cvicneTestsStatus } = useCvicneTests(lesson?.courseName);
    const { params } = useUserParams();
    const lang = language === 'cz' ? 'cz' : 'en';
    const studium = params?.studium;

    if (activeTab === 'files') {
        const isEmpty = !files || files.length === 0;
        // Show skeleton only when we have no data yet — never suppress it with isSyncing
        const showSkeleton = isFilesLoading || (isPriorityLoading && isEmpty);
        const currentFilesCount = files?.reduce((acc, f) => acc + f.files.length, 0) || 0;
        // Show progress bar when skeleton shows, when still fetching remaining files after first chunk,
        // or when syncing with no data yet
        const showProgress = showSkeleton || isPriorityLoading || (isSyncing && isEmpty);

        return (
            <>
                <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                <DragHint show={showDragHint} />
                {showProgress && (
                    <div className="flex items-center gap-2 text-xs text-base-content/70 font-medium px-6 py-4 bg-base-200/30 border-b border-base-300 animate-in fade-in slide-in-from-top-1">
                        <Loader2 size={12} className="text-primary animate-spin" />
                        <span>{t('course.sync.loadingFiles') || 'Loading files...'}</span>
                        {files && files.length > 0 && (
                            <span className="text-base-content/50">
                                ({currentFilesCount}{totalCount !== undefined && totalCount > files.length ? ` / ${totalCount}` : ''})
                            </span>
                        )}
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
                               onViewPdf={onViewPdf} folderUrl={folderUrl} />
                 )}
            </>
        );
    }

    if (activeTab === 'assessments') return <AssessmentTab courseCode={lesson?.courseCode || ''} />;
    if (activeTab === 'syllabus') return <SyllabusTab courseCode={lesson?.courseCode || ''} courseId={resolvedCourseId} courseName={lesson?.courseName ?? ''} prefetchedResult={syllabusResult} />;
    if (activeTab === 'classmates') return <ClassmatesTab courseCode={lesson?.courseCode || ''} />;
    
    if (activeTab === 'cvicneTests') {
        const isLoading = cvicneTestsStatus === 'loading';
        const hasTests = tests.length > 0;
        const isEmpty = !hasTests;

        if (isLoading && isEmpty) {
            return (
                <div className="flex flex-col gap-3 p-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl">
                            <div className="skeleton h-4 w-2/3" />
                            <div className="skeleton h-8 w-20 rounded-xl" />
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full bg-base-100 overflow-y-auto w-full">
                <div className="flex flex-col gap-6 p-4 flex-1">
                    {isEmpty ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center mt-4">
                            <FileText className="w-12 h-12 text-base-content/20 mb-3" />
                            <p className="text-sm text-base-content/60">
                                {t('course.cvicneTests.noTests') || 'Žádné testy k dispozici.'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 px-3">
                                {t('course.cvicneTests.tests') || 'Testy'}
                            </h3>
                            <div className="flex flex-col gap-1">
                                {tests.map(test => (
                                    <a key={test.url} href={test.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-base-200 active:scale-[0.99] transition-all animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer">
                                        <span className="font-semibold text-base-content/80 text-sm truncate min-w-0">
                                            {test.name}
                                        </span>
                                        <ExternalLink size={14} className="text-base-content/30 shrink-0" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {studium && (
                    <div className="flex items-center justify-center gap-3 py-3 mt-0">
                        <a href={`https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${studium};lang=${lang}`} target="_blank" rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary normal-case font-bold">
                            <span>IS MENDELU</span>
                            <ExternalLink size={16} />
                        </a>
                    </div>
                )}
            </div>
        );
    }

    return <SuccessRateTab courseCode={lesson?.courseCode || ''} facultyCode={(lesson as { facultyCode?: string } | null)?.facultyCode} />;
}
