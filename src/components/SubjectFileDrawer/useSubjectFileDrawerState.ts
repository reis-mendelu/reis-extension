import { useState, useRef, useMemo } from 'react';
import { useSchedule, useFiles, useSyncStatus, useSyllabus, useSubjects } from '../../hooks/data';
import { useDragSelection } from './useDragSelection';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';


export function useSubjectFileDrawerState(lesson: BlockLesson | SelectedSubject | null, isOpen: boolean) {
    const { schedule } = useSchedule();
    const { getSubject } = useSubjects();
    const isExam = lesson && 'isExam' in lesson ? lesson.isExam : false;
    const [activeTab, setActiveTab] = useState<'files' | 'stats' | 'assessments' | 'syllabus'>(isExam ? 'stats' : 'files');
    const { files, isLoading: isFilesLoading } = useFiles(isOpen ? lesson?.courseCode : undefined);
    const { isSyncing } = useSyncStatus();

    const subjectInfo = useMemo(() => {
        if (!isOpen || !lesson?.courseCode) return null;
        return getSubject(lesson.courseCode);
    }, [isOpen, lesson?.courseCode, getSubject]);

    const resolvedCourseId = useMemo(() => {
        if (lesson?.courseId) return lesson.courseId;
        return schedule?.find(s => s.courseCode === lesson?.courseCode && s.courseId)?.courseId || '';
    }, [lesson, schedule]);

    const syllabusResult = useSyllabus(isOpen ? lesson?.courseCode : undefined, isOpen ? resolvedCourseId : undefined, isOpen ? lesson?.courseName : undefined);

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const drag = useDragSelection({ isOpen, containerRef, contentRef, fileRefs });

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen && lesson) {
            const isExamNow = 'isExam' in lesson ? lesson.isExam : false;
            setActiveTab(isExamNow ? 'stats' : 'files');
        }
    }

    return { activeTab, setActiveTab, files, isFilesLoading, isSyncing, resolvedCourseId, syllabusResult, subjectInfo, containerRef, contentRef, fileRefs, ...drag };
}
