import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { EnrolledNowSection } from './EnrolledNowSection';
import { useSubjectsData } from './useSubjectsData';

interface SubjectsPanelProps {
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
  onSearchSubject: (name: string) => void;
  onOpenStudyPlan: () => void;
}

export function SubjectsPanel({ onOpenSubject, onSearchSubject, onOpenStudyPlan }: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const studyPlanLoaded = useAppStore(s => s.studyPlanLoaded);
  const studyStats = useAppStore(s => s.studyStats);
  const handshakeDone = useAppStore(s => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore(s => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore(s => s.syncStatus.isSyncing);

  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code)));
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);

  const { subjectSemesters, subjectToZameranis, zameraniProgress, failRates, enrolledCredits } = useSubjectsData(plan);

  if (!plan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing) return <SubjectsPanelSkeleton />;
    return <div className="flex items-center justify-center h-full text-base-content/50">{t('subjects.noData')}</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SubjectsPanelHeader
        creditsAcquired={plan.creditsAcquired}
        creditsRequired={plan.creditsRequired}
        studyStats={studyStats}
        plan={plan}
        zameraniProgress={zameraniProgress}
        enrolledCredits={enrolledCredits}
      />

      <div className="px-4 pt-3 pb-0 shrink-0">
        <EnrolledNowSection
          plan={plan}
          failRates={failRates}
          subjectSemesters={subjectSemesters}
          subjectToZameranis={subjectToZameranis}
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
        />
      </div>

      <div className="px-4 pt-3 pb-4 shrink-0">
        <button
          onClick={onOpenStudyPlan}
          className="btn btn-ghost btn-sm w-full justify-between text-base-content/60 font-medium"
        >
          <span>{t('subjects.studyPlan')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
