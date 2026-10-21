import { useState, useRef, useMemo, useEffect } from 'react';
import {
  useSchedule,
  useFiles,
  useSyncStatus,
  useSyllabus,
  useSubjects,
  useClassmates,
} from '../../hooks/data';
import { useDragSelection } from './useDragSelection';
import { useMarkZaznamnikSeen } from '../../hooks/ui/useMarkZaznamnikSeen';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';

export function useSubjectFileDrawerState(
  lesson: BlockLesson | SelectedSubject | null,
  isOpen: boolean
) {
  const { schedule } = useSchedule();
  const { getSubject } = useSubjects();
  const isExam = lesson && 'isExam' in lesson ? lesson.isExam : false;
  const isEnrolled = !!(lesson?.courseCode && getSubject(lesson.courseCode)?.subjectId);
  const requestedTab = lesson && 'initialTab' in lesson ? lesson.initialTab : undefined;
  const [activeTab, setActiveTab] = useState<
    'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik'
  >(requestedTab ?? (isExam || !isEnrolled ? 'stats' : 'files'));

  useEffect(() => {
    if (requestedTab) queueMicrotask(() => setActiveTab(requestedTab));
  }, [requestedTab, lesson?.courseCode]);

  // The drawer outlives a close, and its tab used to as well: opening B while
  // A's Záznamník was the leftover tab showed B on it for one commit, long
  // enough for the seen-hook to clear B's new points. So the tab is reset
  // during render whenever a new opening starts, before any effect runs.
  const openingKey = isOpen && lesson ? `${lesson.id}|${lesson.courseCode}` : null;
  const [tabOpening, setTabOpening] = useState(openingKey);
  if (openingKey !== tabOpening) {
    setTabOpening(openingKey);
    if (openingKey) setActiveTab(requestedTab ?? (isExam || !isEnrolled ? 'stats' : 'files'));
  }

  useMarkZaznamnikSeen(lesson?.courseCode, activeTab, isOpen);

  const { files, isLoading: isFilesLoading } = useFiles(isOpen ? lesson?.courseCode : undefined);
  const { isSyncing } = useSyncStatus();

  // Trigger pre-fetching for classmates when drawer opens
  useClassmates(isOpen ? lesson?.courseCode : undefined);

  const subjectInfo = isOpen && lesson?.courseCode ? getSubject(lesson.courseCode) : null;

  const resolvedCourseId = useMemo(() => {
    if (lesson?.courseId) return lesson.courseId;
    return schedule?.find((s) => s.courseCode === lesson?.courseCode && s.courseId)?.courseId || '';
  }, [lesson, schedule]);

  const syllabusResult = useSyllabus(
    isOpen ? lesson?.courseCode : undefined,
    isOpen ? resolvedCourseId : undefined,
    isOpen ? lesson?.courseName : undefined
  );

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
        queueMicrotask(() => setActiveTab(isExamNow || !isEnrolledNow ? 'stats' : 'files'));
      }
      fileRefs.current.clear();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear file refs when course changes
  useEffect(() => {
    fileRefs.current.clear();
  }, [lesson?.courseCode]);

  return {
    activeTab,
    setActiveTab,
    files,
    isFilesLoading,
    isSyncing,
    resolvedCourseId,
    syllabusResult,
    subjectInfo,
    containerRef,
    contentRef,
    fileRefs,
    ...drag,
  };
}
