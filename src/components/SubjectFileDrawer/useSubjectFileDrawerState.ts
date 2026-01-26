import { useState, useEffect, useRef, useMemo } from 'react';
import { useSchedule, useFiles, useSyncStatus, useSyllabus } from '../../hooks/data';
import { useDragSelection } from './useDragSelection';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';

export function useSubjectFileDrawerState(lesson: BlockLesson | null, isOpen: boolean) {
    const { schedule } = useSchedule();
    const [activeTab, setActiveTab] = useState<'files' | 'stats' | 'assessments' | 'syllabus'>(lesson?.isExam ? 'stats' : 'files');
    const { files, isLoading: isFilesLoading } = useFiles(isOpen ? lesson?.courseCode : undefined);
    const { isSyncing } = useSyncStatus();

    const resolvedCourseId = useMemo(() => {
        if (lesson?.courseId) return lesson.courseId;
        return schedule?.find(s => s.courseCode === lesson?.courseCode && s.courseId)?.courseId || '';
    }, [lesson, schedule]);

    const syllabusResult = useSyllabus(isOpen ? lesson?.courseCode : undefined, isOpen ? resolvedCourseId : undefined, isOpen ? (lesson as any)?.courseName : undefined);

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const drag = useDragSelection({ isOpen, containerRef, contentRef, fileRefs });

    useEffect(() => {
        if (isOpen && lesson) setActiveTab(lesson.isExam ? 'stats' : 'files');
    }, [isOpen, lesson]);

    return { activeTab, setActiveTab, files, isFilesLoading, isSyncing, resolvedCourseId, syllabusResult, containerRef, contentRef, fileRefs, ...drag };
}
