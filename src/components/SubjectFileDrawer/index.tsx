/**
 * SubjectFileDrawer Component (Refactored)
 * 
 * Modular drawer for displaying subject files with drag selection.
 * Main orchestration component delegating to subcomponents.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { loggers } from '../../utils/logger';
import { useSchedule, useFiles, useSyncStatus, useSyllabus } from '../../hooks/data';
import { cleanFolderName } from '../../utils/fileUrl';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { SuccessRateTab } from '../SuccessRateTab';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';

import { DrawerHeader } from './DrawerHeader';
import { FileList, FileListSkeleton } from './FileList';
import { AssessmentTab } from './AssessmentTab';
import { SyllabusTab } from './SyllabusTab';
import { DragHint, SelectionBox } from './DragHint';
import { useDragSelection } from './useDragSelection';
import { IndexedDBService } from '../../services/storage';
import type { FileGroup } from './types';

interface SubjectFileDrawerProps {
    lesson: BlockLesson | null;
    isOpen: boolean;
    onClose: () => void;
}

export function SubjectFileDrawer({ lesson, isOpen, onClose }: SubjectFileDrawerProps) {
    const { schedule } = useSchedule();
    const { isDownloading, openFile, downloadZip } = useFileActions();

    loggers.ui.info('[SubjectFileDrawer] Rendering. Open:', isOpen, 'Lesson:', lesson?.courseCode);

    // State
    // Default to 'stats' tab when opened from exams view (zkousky page)
    const [activeTab, setActiveTab] = useState<'files' | 'stats' | 'assessments' | 'syllabus'>(lesson?.isExam ? 'stats' : 'files');
    const { files, isLoading: isFilesLoading } = useFiles(isOpen ? lesson?.courseCode : undefined);
    const { isSyncing } = useSyncStatus();
    const [showDragHint, setShowDragHint] = useState(false);
    
    // Resolve courseId from schedule if not present
    const resolvedCourseId = useMemo(() => {
        if (lesson?.courseId) return lesson.courseId;
        if (!lesson?.courseCode || !schedule?.length) return '';
        
        const matchingLesson = schedule.find(s => s.courseCode === lesson.courseCode && s.courseId);
        return matchingLesson?.courseId || '';
    }, [lesson, schedule]);

    // Pre-fetch syllabus as soon as drawer opens
    const syllabusResult = useSyllabus(
        isOpen ? lesson?.courseCode : undefined,
        isOpen ? resolvedCourseId : undefined,
        isOpen ? (lesson as any)?.courseName : undefined
    );

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Drag selection hook
    const {
        selectedIds,
        isDragging,
        selectionBoxStyle,
        ignoreClickRef,
        handleMouseDown,
        toggleSelect,
    } = useDragSelection({
        isOpen,
        containerRef,
        contentRef,
        fileRefs
    });

    // No manual file loading effect - handled by useFiles hook

    // Set default tab based on context when opening
    useEffect(() => {
        if (isOpen && lesson) {
            // Priority: search → stats, exam → stats, else → files
            setActiveTab(lesson.isFromSearch ? 'stats' : lesson.isExam ? 'stats' : 'files');
        }
        if (!isOpen) {
            queueMicrotask(() => {
                setShowDragHint(false);
            });
        }
    }, [isOpen, lesson]);

    // Show drag hint on first use
    useEffect(() => {
        if (!isOpen || !files || files.length === 0) return;
        
        async function checkHint() {
            try {
                const hasSeenHint = await IndexedDBService.get('meta', 'drag_hint_shown');
                if (hasSeenHint) return;
                
                await IndexedDBService.set('meta', 'drag_hint_shown', true);
                
                setTimeout(() => setShowDragHint(true), 800);
                setTimeout(() => setShowDragHint(false), 4800);

                // No cleanup returned here because timers are local to this check closure scope 
                // but if component unmounts we can't easily clear them from outside.
                // Ideally we use a ref or standard useEffect cleanup, but for now this async wrapper 
                // makes standard cleanup return tricky. 
                // Given the short duration, it's acceptable, or we could refactor to use a valid state check.
            } catch (err) {
               console.error('[SubjectFileDrawer] Failed to check drag hint:', err);
            }
        }
        
        checkHint();
    }, [isOpen, files]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onClose();
            }
        };

        // Use capture phase to intercept before ExamPanel
        document.addEventListener('keydown', handleEscape, true);
        return () => document.removeEventListener('keydown', handleEscape, true);
    }, [isOpen, onClose]);

    // Group and sort files
    const groupedFiles: FileGroup[] = useMemo(() => {
        if (!files) return [];
        const groups = new Map<string, ParsedFile[]>();
        
        files.forEach(f => {
            const subfolder = f.subfolder?.trim() || 'Ostatní';
            if (!groups.has(subfolder)) groups.set(subfolder, []);
            groups.get(subfolder)?.push(f);
        });

        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            if (a === 'Ostatní') return 1;
            if (b === 'Ostatní') return -1;
            return a.localeCompare(b, 'cs');
        });

        const naturalCompare = (s1: string, s2: string) =>
            s1.localeCompare(s2, 'cs', { numeric: true, sensitivity: 'base' });

        const sortFiles = (groupFiles: ParsedFile[]): ParsedFile[] => {
            return [...groupFiles].sort((a, b) => {
                const commentA = a.file_comment?.trim();
                const commentB = b.file_comment?.trim();
                
                if (commentA && commentB) return naturalCompare(commentA, commentB);
                if (commentA && !commentB) return -1;
                if (!commentA && commentB) return 1;
                return naturalCompare(a.file_name, b.file_name);
            });
        };

        return sortedKeys.map(key => ({
            name: key,
            displayName: key === 'Ostatní' ? 'Ostatní' : cleanFolderName(key, lesson?.courseCode),
            files: sortFiles(groups.get(key) || [])
        }));
    }, [files, lesson]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/15 transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer Container */}
            <div className="w-full flex justify-end items-start h-full pt-10 pb-10 relative z-10 pointer-events-none">
                {/* Drawer */}
                <div 
                    role="dialog"
                    aria-modal="true"
                    className="w-[600px] bg-base-100 shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-base-300 font-inter h-full animate-in slide-in-from-right duration-300 pointer-events-auto"
                >
                    
                    <DrawerHeader
                        lesson={lesson}
                        courseId={resolvedCourseId || syllabusResult.syllabus?.courseId || ''}
                        selectedCount={selectedIds.length}
                        isDownloading={isDownloading}
                        activeTab={activeTab}
                        onClose={onClose}
                        onDownload={() => downloadZip(selectedIds, `${lesson?.courseCode}_files.zip`)}
                        onTabChange={setActiveTab}
                    />

                    {/* Content Area */}
                    <div 
                        ref={containerRef}
                        className="flex-1 overflow-y-auto relative select-none"
                        onMouseDown={activeTab === 'files' ? handleMouseDown : undefined}
                        style={{ cursor: activeTab === 'files' ? 'crosshair' : 'default' }}
                    >
                        <div ref={contentRef} className="min-h-full pb-20 relative">
                            <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                            
                            {activeTab === 'files' && <DragHint show={showDragHint} />}

                            {activeTab === 'files' ? (
                                // Show skeleton if files are null (unknown state) AND we are syncing
                                (isFilesLoading || (isSyncing && files === null)) ? (
                                    <FileListSkeleton />
                                ) : (!files || files.length === 0) ? (
                                    // Empty state when no files available (either known empty [] or unknown null but not syncing)
                                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                        {lesson?.isFromSearch ? (
                                            <div className="flex flex-col items-center">
                                                <FileText className="w-12 h-12 text-base-content/20 mb-3" />
                                                <p className="text-sm text-base-content/60">
                                                    Soubory jsou dostupné pouze pro předměty ve vašem rozvrhu
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <p className="text-sm text-base-content/60 flex items-center justify-center gap-1">
                                                    Žádné soubory nejsou k dispozici. Možná je najdeš v
                                                    <a 
                                                        href="https://teams.microsoft.com/v2/" 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[#5059C9] font-bold hover:underline"
                                                    >
                                                        Teamsech
                                                        <img 
                                                            src={chrome.runtime.getURL("teams_icon_48.png")} 
                                                            alt="Teams" 
                                                            className="w-8 h-8 object-contain" 
                                                        />
                                                    </a>
                                                    ?
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <FileList
                                        groups={groupedFiles}
                                        selectedIds={selectedIds}
                                        fileRefs={fileRefs}
                                        ignoreClickRef={ignoreClickRef}
                                        onToggleSelect={toggleSelect}
                                        onOpenFile={openFile}
                                    />
                                )
                            ) : activeTab === 'assessments' ? (
                                <AssessmentTab courseCode={lesson?.courseCode || ''} />
                            ) : activeTab === 'syllabus' ? (
                                <SyllabusTab 
                                    courseCode={lesson?.courseCode || ''} 
                                    courseId={resolvedCourseId}
                                    courseName={(lesson as any)?.courseName}
                                    prefetchedResult={syllabusResult}
                                />
                            ) : (
                                <SuccessRateTab courseCode={lesson?.courseCode || ''} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
