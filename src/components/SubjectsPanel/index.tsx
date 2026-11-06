import { ChevronRight, Info } from 'lucide-react';
import { useEffectiveStudyPlan } from '@/hooks/useEffectiveStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { EnrolledNowSection } from './EnrolledNowSection';
import { StudyAveragesSection } from './StudyAveragesSection';
import { useSubjectsData } from './useSubjectsData';
import { ReportMissingLink } from '../Feedback/ReportMissingLink';
import { SubmissionBoxesSummary } from '../SubmissionBoxes/SubmissionBoxesSummary';

interface SubjectsPanelProps {
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik',
    isFulfilled?: boolean
  ) => void;
  onSearchSubject: (name: string) => void;
  onOpenStudyPlan: () => void;
}

export function SubjectsPanel({
  onOpenSubject,
  onSearchSubject,
  onOpenStudyPlan,
}: SubjectsPanelProps) {
  const { t } = useTranslation();
  const studyPlanLoaded = useAppStore((s) => s.studyPlanLoaded);
  const studyStats = useAppStore((s) => s.studyStats);
  const studyComparison = useAppStore((s) => s.studyComparison);
  const language = useAppStore((s) => s.language);
  // Opens a box's subject on Záznamník, where the box is listed.
  const boxesSummary = (className: string) => (
    <SubmissionBoxesSummary
      className={className}
      onOpen={(courseCode, box) =>
        onOpenSubject(
          courseCode,
          language === 'en' ? box.courseNameEn : box.courseNameCs,
          box.courseId,
          undefined,
          'zaznamnik'
        )
      }
    />
  );
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);

  // Erasmus/exchange students have no KontrolaPlanu, so the plan never
  // materializes — fall back to the subjects store (student/list.pl). The
  // fallback and the wait for the plan to settle are shared with the phone's
  // SubjectsScreen; see useEffectiveStudyPlan.
  const { plan: effectivePlan, planUsable } = useEffectiveStudyPlan();
  const { subjectSemesters, subjectToZameranis, zameraniProgress, failRates, enrolledCredits } =
    useSubjectsData(effectivePlan);

  if (!effectivePlan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing)
      return <SubjectsPanelSkeleton />;
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full text-base-content/70">
        <p>{t('subjects.noData')}</p>
        <ReportMissingLink prefill="subjectsEmpty" />
      </div>
    );
  }

  if (!planUsable) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-0 shrink-0">
          <div className="flex items-start gap-2 text-xs text-base-content/70 pb-3">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('subjects.noPlanExchange')}</span>
          </div>
          <EnrolledNowSection
            plan={effectivePlan}
            failRates={failRates}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />
          {boxesSummary('mt-3 max-w-xl mx-auto')}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SubjectsPanelHeader
        creditsAcquired={effectivePlan.creditsAcquired}
        creditsRequired={effectivePlan.creditsRequired}
        plan={effectivePlan}
        zameraniProgress={zameraniProgress}
        enrolledCredits={enrolledCredits}
      />

      {/* Not shrink-0: below lg the card stacks under the average, and in a
          short window this block is taller than the room left. It gives way
          and scrolls rather than pushing Studijní plán off the bottom. */}
      <div className="px-4 pt-3 pb-0 min-h-0 overflow-y-auto">
        <EnrolledNowSection
          plan={effectivePlan}
          failRates={failRates}
          subjectSemesters={subjectSemesters}
          subjectToZameranis={subjectToZameranis}
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
        />
        {/* Beside the average from lg up, not under it: at 1280×800 a stacked
            card pushed Studijní plán off the bottom. */}
        <div className="mt-3 flex flex-col items-center gap-3 lg:flex-row lg:items-start lg:justify-center">
          <div className="w-full max-w-xl lg:flex-1">
            <StudyAveragesSection studyStats={studyStats} comparison={studyComparison} />
          </div>
          {boxesSummary('w-full max-w-xl lg:flex-1')}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 shrink-0">
        <button
          onClick={onOpenStudyPlan}
          className="max-w-xl mx-auto w-full flex items-center justify-between gap-2 px-4 py-2 rounded-xl border border-base-300 bg-base-200 hover:bg-base-300 transition-colors text-sm text-base-content/70 font-medium"
        >
          <span>{t('subjects.studyPlan')}</span>
          <ChevronRight className="w-4 h-4 text-base-content/70" />
        </button>
      </div>
    </div>
  );
}
