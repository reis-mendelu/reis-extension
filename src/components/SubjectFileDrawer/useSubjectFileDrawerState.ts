import { useState, useRef, useMemo, useEffect } from 'react';
import { useSchedule, useFiles, useSyncStatus, useSyllabus, useSubjects, useClassmates } from '../../hooks/data';
import { useDragSelection } from './useDragSelection';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';


export function useSubjectFileDrawerState(lesson: BlockLesson | SelectedSubject | null, isOpen: boolean) {
    const { schedule } = useSchedule();
    const { getSubject } = useSubjects();
    const isExam = lesson && 'isExam' in lesson ? lesson.isExam : false;
    const isEnrolled = !!(lesson?.courseCode && getSubject(lesson.courseCode)?.subjectId);
    const requestedTab = lesson && 'initialTab' in lesson ? lesson.initialTab : undefined;
    const [activeTab, setActiveTab] = useState<'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates' | 'osnovy'>(requestedTab ?? (isExam ? 'stats' : (isEnrolled ? 'files' : 'syllabus')));

    useEffect(() => {
      if (requestedTab) queueMicrotask(() => setActiveTab(requestedTab));
    }, [requestedTab, lesson?.courseCode]);

    const { files, isLoading: isFilesLoading, isPriorityLoading, progressStatus, totalCount } = useFiles(isOpen ? lesson?.courseCode : undefined);
    const { isSyncing } = useSyncStatus();

    // Trigger pre-fetching for classmates when drawer opens
    useClassmates(isOpen ? lesson?.courseCode : undefined);

    const subjectInfo = isOpen && lesson?.courseCode ? getSubject(lesson.courseCode) : null;

    const resolvedCourseId = useMemo(() => {
        if (lesson?.courseId) return lesson.courseId;
        return schedule?.find(s => s.courseCode === lesson?.courseCode && s.courseId)?.courseId || '';
    }, [lesson, schedule]);

    const syllabusResult = useSyllabus(isOpen ? lesson?.courseCode : undefined, isOpen ? resolvedCourseId : undefined, isOpen ? lesson?.courseName : undefined);

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const drag = useDragSelection({ isOpen, containerRef, contentRef, fileRefs });

    // Reset tab and clear file refs when drawer opens
    useEffect(() => {
        if (isOpen && lesson) {
            const requested = 'initialTab' in lesson ? lesson.initialTab : undefined;
            if (!requested) {
                const isExamNow = 'isExam' in lesson ? lesson.isExam : false;
                const isEnrolledNow = !!(lesson.courseCode && getSubject(lesson.courseCode)?.subjectId);
                queueMicrotask(() => setActiveTab(isExamNow ? 'stats' : (isEnrolledNow ? 'files' : 'syllabus')));
            }
            fileRefs.current.clear();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear file refs when course changes
    useEffect(() => {
        fileRefs.current.clear();
    }, [lesson?.courseCode]);

    return { activeTab, setActiveTab, files, isFilesLoading, isSyncing, isPriorityLoading, progressStatus, totalCount, resolvedCourseId, syllabusResult, subjectInfo, containerRef, contentRef, fileRefs, ...drag };
}

