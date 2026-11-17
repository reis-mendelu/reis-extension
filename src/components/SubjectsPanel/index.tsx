import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
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
import { boxesSummaryShows } from '../../utils/submissionBoxes';
import { useScreenSignal } from '../../hooks/useScreenSignal';

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
  useScreenSignal('screen_subjects');
  const { t } = useTranslation();
  const studyPlanLoaded = useAppStore((s) => s.studyPlanLoaded);
  const studyStats = useAppStore((s) => s.studyStats);
  const studyComparison = useAppStore((s) => s.studyComparison);
  const language = useAppStore((s) => s.language);
  const boxes = useAppStore((s) => s.odevzdavarny);
  const now = useAppStore((s) => s.now);
  const obdobi = useAppStore((s) => s.obdobiId);
  // The summary renders nothing without an open or a handed-in box; the layout
  // below has to know that too, so it asks the same question the summary does.
  const hasBoxCard = useMemo(
    () => boxesSummaryShows(boxes, now.getTime(), obdobi),
    [boxes, now, obdobi]
  );
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
  // py-1.5 beside the average: its collapsed header is 34px, and so is this.
  const studyPlanButton = (className: string) => (
    <button
      onClick={onOpenStudyPlan}
      className={`${className} flex items-center justify-between gap-2 px-4 rounded-xl border border-base-300 bg-base-200 hover:bg-base-300 transition-colors text-sm text-base-content/70 font-medium`}
    >
      <span>{t('subjects.studyPlan')}</span>
      <ChevronRight className="w-4 h-4 text-base-content/70" />
    </button>
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

      {/* Not shrink-0: in a short window this block is taller than the room
          left. It gives way and scrolls rather than pushing Studijní plán off
          the bottom. */}
      <div className="px-4 pt-3 pb-0 min-h-0 overflow-y-auto">
        <EnrolledNowSection
          plan={effectivePlan}
          failRates={failRates}
          subjectSemesters={subjectSemesters}
          subjectToZameranis={subjectToZameranis}
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
        />
        {/* An open box spans the width, like Aktuálně zapsáno above it; the
            average and the plan split the row under it into equal halves.
            Beside the average, the box left three cards of three heights and
            widths. The row scrolls with the box: pinned below, the expanded
            average cut the box down to its title at 1280×800. The plan sits at
            the top of its half, so it stays in view while the average runs on. */}
        {hasBoxCard ? (
          <>
            {boxesSummary('mt-3 w-full')}
            <div
              data-testid="subjects-bottom-row"
              className="mt-3 pb-4 grid gap-3 md:grid-cols-2 md:items-start"
            >
              <StudyAveragesSection
                studyStats={studyStats}
                comparison={studyComparison}
                className="w-full"
              />
              {studyPlanButton('w-full py-1.5 shadow-sm')}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <StudyAveragesSection studyStats={studyStats} comparison={studyComparison} />
          </div>
        )}
      </div>

      {!hasBoxCard && (
        <div className="px-4 pt-3 pb-4 shrink-0">
          {studyPlanButton('max-w-xl mx-auto w-full py-2')}
        </div>
      )}
    </div>
  );
}
