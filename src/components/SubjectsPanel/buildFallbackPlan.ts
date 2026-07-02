import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import type { SubjectsData } from '@/types/documents';

/**
 * Builds a minimal one-block StudyPlan from the subjects store (student/list.pl)
 * for students without KontrolaPlanu (e.g. Erasmus/exchange). Render-only —
 * never persisted, so it cannot leak into other plan consumers.
 */
export function buildFallbackPlan(subjects: SubjectsData, language: 'cs' | 'en'): StudyPlan {
  const items: SubjectStatus[] = Object.values(subjects.data).map(info => ({
    id: info.subjectId ?? '',
    code: info.subjectCode,
    name: (language === 'en' ? info.nameEn : info.nameCs) ?? info.displayName,
    credits: 0,
    type: '',
    isEnrolled: true,
    isFulfilled: false,
    enrollmentCount: 0,
    rawStatusText: '',
  }));

  return {
    title: '',
    isFulfilled: false,
    creditsAcquired: 0,
    creditsRequired: 0,
    blocks: [{ title: '', groups: [{ name: '', statusDescription: '', subjects: items }] }],
    zameranis: [],
  };
}
