import type { ReactNode } from 'react';
import { BookOpen, ListTree } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { ScreenError } from '../primitives/ScreenError';
import { useStudyPlan } from '../../../hooks/useStudyPlan';
import { selectEnrolledNow, enrolledSemester } from '../../../utils/mobile/enrolledSubjects';
import type { SubjectStatus } from '../../../types/studyPlan';
import { ScreenHeader } from './calendar/ScreenHeader';
import { CreditRing } from './subjects/CreditRing';
import { SemesterCard } from './subjects/SemesterCard';
import { AverageAccordion } from './subjects/AverageAccordion';
import { NavRow } from '../primitives/NavRow';

function SubjectsSkeleton() {
  const { t } = useTranslation();
  return (
    <ScreenSkeleton
      testId="subjects-skeleton"
      label={t('mobile.subjects.loading')}
      // One row shorter and no inset of its own: the header above it is real
      // now rather than a placeholder bar.
      rows={['h-20', 'h-40', 'h-14']}
      underHeader
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
  const syncError = useAppStore((s) => s.syncStatus.error);

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
  // Every subject's pass/fail statistics, not only the ones whose drawer has
  // been opened — that is what left the chip on one row out of eight.

  const planUsable = !!plan && plan.blocks.some((b) => b.groups.some((g) => g.subjects.length > 0));

  // No per-domain shortcut here, unlike the calendar and exams screens. The
  // plan's fetch is TTL-gated, so "nothing came back" covers skipped-as-fresh,
  // no-studium and genuinely-none — and releasing on it showed "Zatím žádné
  // předměty" to a student who has plenty, which everyone reads as a statement
  // of fact. The skeleton stays until there is a usable plan to draw, or until
  // a whole sync has finished and the emptiness is the real answer.
  // A navigation row at the BOTTOM of the screen, under Studijní průměr, rather
  // than a filled button in the header: "let's put studijni plan under studijni
  // prumer but rather that being a dropdown, it just opens a new page (same as
  // on desktop)". A primary-tinted button in the header read as the screen's
  // main action, which the plan is not — the enrolled subjects are. The
  // chevron is what says it opens a page, next to an accordion that does not.
  const openPlan = () => pushSheet({ kind: 'studyPlan' });

  // The header renders in every state below, not only the loaded one. A bare
  // skeleton or error in its place left this tab with no route to the vývěska,
  // search or notifications while a crawl ran — the same hole CalendarScreen
  // had, caught in review on this PR. The plan's title is only known once the
  // plan is, so the eyebrow is empty until then.
  const shell = (body: ReactNode, eyebrow = '') => (
    <div data-testid="subjects-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader eyebrow={eyebrow} title={t('mobile.subjects.title')} />
      {body}
    </div>
  );

  if ((!handshakeDone && !handshakeTimedOut) || (isSyncing && !firstSyncSettled && !planUsable)) {
    return shell(<SubjectsSkeleton />);
  }

  // Narrower than the other two screens on purpose: the study plan carries no
  // arrival signal (its fetch is TTL-gated, so a null is ambiguous — see
  // SyncDomain), leaving the whole-sync error as the only failure this screen
  // can distinguish. A lone study-plan rejection inside an otherwise healthy
  // run still reads as "no subjects"; narrowing that needs a fetched/skipped
  // distinction inside ttlGated, which is a separate change.
  if (!planUsable && syncError) {
    return shell(<ScreenError testId="subjects-error" />);
  }

  if (!planUsable) {
    return shell(<EmptyState />);
  }

  // What the student enrolled in, not what the plan offers. Picking a "current"
  // block by inference showed a semester they had not registered for, and
  // showed every alternative in it — see utils/mobile/enrolledSubjects.
  const enrolled = selectEnrolledNow(plan);
  const semester = enrolledSemester(enrolled);
  const openSubject = (subject: SubjectStatus) => {
    pushSheet({
      kind: 'subjectDrawer',
      courseCode: subject.code,
      courseName: subject.name,
      courseId: subject.id,
    });
  };

  return shell(
    <>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-24 pt-3.5">
        <CreditRing earned={plan.creditsAcquired} total={plan.creditsRequired} />
        {enrolled.length > 0 ? (
          <SemesterCard enrolled={enrolled} semester={semester} onOpenSubject={openSubject} />
        ) : (
          // Said plainly rather than left blank: a student who has not
          // registered yet used to be shown a semester the heuristics picked,
          // with no sign it was a guess.
          <div
            data-testid="subjects-none-enrolled"
            className="flex-shrink-0 rounded-2xl border border-base-300 bg-base-100 px-4 py-5 text-center text-sm text-base-content/60"
          >
            {t('mobile.subjects.noneEnrolled')}
          </div>
        )}
        <AverageAccordion studyStats={studyStats} comparison={studyComparison} />
        {/* Under the average, and only where the plan is real: in the skeleton
            and error shells above there is nothing to open. */}
        <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100">
          <NavRow
            icon={ListTree}
            label={t('mobile.subjects.studyPlan')}
            sublabel={plan.title}
            onClick={openPlan}
          />
        </div>
      </div>
    </>,
    plan.title
  );
}
