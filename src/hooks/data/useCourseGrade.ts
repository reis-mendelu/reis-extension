import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { gradeForCourse } from '@/utils/gradeLookup';
import type { CourseGrade } from '@/types/documents';

/** Reactive lookup of a subject's E-index grade by predmet id (from the store). */
export function useCourseGrade(predmetId: string, courseCode?: string): CourseGrade | null {
  const gradeHistory = useAppStore(s => s.gradeHistory);
  return useMemo(
    () => (gradeHistory ? gradeForCourse(gradeHistory.grades, predmetId, courseCode) : null),
    [gradeHistory, predmetId, courseCode]
  );
}
