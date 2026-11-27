import { useMemo } from 'react';
import { STUDY_AIDS, type StudyAidsEntry } from '../data/studyAids';
import { useAppStore } from '../store/useAppStore';
import { studyAidsFor } from '../utils/studyAids';
import { useViewer } from './useViewer';

/** The links under Předměty for this student's field, decided on the device. */
export function useStudyAids(): StudyAidsEntry[] {
  const audiences = useAppStore((s) => s.studyAids);
  const viewer = useViewer();
  return useMemo(() => studyAidsFor(audiences, viewer, STUDY_AIDS), [audiences, viewer]);
}
