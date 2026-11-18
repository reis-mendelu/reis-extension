import { useMemo } from 'react';
import { STUDY_AIDS, type StudyAidsEntry } from '../data/studyAids';
import { useAppStore } from '../store/useAppStore';
import { studyAidsFor } from '../utils/studyAids';
import { useViewer } from './useViewer';

/** The study-aids link for this student's field, decided on the device. */
export function useStudyAids(): StudyAidsEntry | null {
  const audiences = useAppStore((s) => s.studyAids);
  const viewer = useViewer();
  return useMemo(() => studyAidsFor(audiences, viewer, STUDY_AIDS), [audiences, viewer]);
}
