import { BookOpen } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { useStudyPlan } from '../../../hooks/useStudyPlan';
import { getSemesterState } from '../../SubjectsPanel/utils';
import type { SubjectStatus } from '../../../types/studyPlan';
import { ScreenHeader } from './calendar/ScreenHeader';
import { CreditRing } from './subjects/CreditRing';
import { SemesterCard } from './subjects/SemesterCard';
import { AverageAccordion } from './subjects/AverageAccordion';

function SubjectsSkeleton() {
  const { t } = useTranslation();
  return (
    <ScreenSkeleton
      testId="subjects-skeleton"
      label={t('mobile.subjects.loading')}
      rows={['h-6 w-40', 'h-20', 'h-40', 'h-14']}
    />
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BookOpen size={28} />
      </div>
      <div className="font-display text-lg font-bold">{t('mobile.subjects.emptyTitle')}</div>
      <div className="max-w-56 text-xs text-base-content/60">{t('mobile.subjects.emptyBody')}</div>
    </div>
  );
}

export function SubjectsScreen() {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const studyStats = useAppStore((s) => s.studyStats);
  const studyComparison = useAppStore((s) => s.studyComparison);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);
  const syncLoaded = useAppStore((s) => s.syncLoaded);

  // Two different questions, and only one of them is `handshakeDone`. That
  // flag flips on the first status message, which the sync posts as it STARTS,
  // so on a first run it says "connected", not "finished". Until a crawl has
  // actually completed (`firstSyncSettled`) and while one is in flight, an
  // absence of a study plan means it has not arrived yet — show the skeleton rather than
  // an empty state that reads as a wrong answer.
  // A KontrolaPlanu that failed to parse still comes back as an object
  // (creditsAcquired: 0, creditsRequired: 0, blocks: []) rather than null —
  // Erasmus/exchange students in particular never have a parseable plan.
  // Treat that shape as absent so we render the empty state instead of a
  // broken "0 %" ring. Mirrors desktop's planUsable check (SubjectsPanel/index.tsx).
  const planUsable = !!plan && plan.blocks.some((b) => b.groups.some((g) => g.subjects.length > 0));

  if (
    (!handshakeDone && !handshakeTimedOut) ||
    (isSyncing && !firstSyncSettled && !syncLoaded.studyPlan && !planUsable)
  ) {
    return <SubjectsSkeleton />;
  }

  const openPlan = () => pushSheet({ kind: 'studyPlan' });
  const headerAction = (
    <button
      type="button"
      onClick={openPlan}
      className="flex h-11 flex-shrink-0 items-center rounded-lg bg-primary/15 px-3.5 text-sm font-semibold text-primary"
    >
      {t('mobile.subjects.studyPlan')}
    </button>
  );

  if (!planUsable) {
    return (
      <div data-testid="subjects-screen" className="flex flex-1 flex-col overflow-hidden">
        <ScreenHeader eyebrow="" title={t('mobile.subjects.title')} action={headerAction} />
        <EmptyState />
      </div>
    );
  }

  const currentBlock = plan.blocks.find((b) => getSemesterState(b) === 'current') ?? null;
  const openSubject = (subject: SubjectStatus) => {
    pushSheet({
      kind: 'subjectDrawer',
      courseCode: subject.code,
      courseName: subject.name,
      courseId: subject.id,
    });
  };

  return (
    <div data-testid="subjects-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader eyebrow={plan.title} title={t('mobile.subjects.title')} action={headerAction} />
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-24 pt-3.5">
        <CreditRing earned={plan.creditsAcquired} total={plan.creditsRequired} />
        {currentBlock && <SemesterCard block={currentBlock} onOpenSubject={openSubject} />}
        <AverageAccordion studyStats={studyStats} comparison={studyComparison} />
      </div>
    </div>
  );
}
