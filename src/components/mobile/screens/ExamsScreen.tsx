import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { ScreenError } from '../primitives/ScreenError';
import { RefreshButton } from '../primitives/RefreshButton';
import { useTranslation } from '../../../hooks/useTranslation';
import { useExams } from '../../../hooks/data/useExams';
import { useExamActions } from '../../ExamPanel/useExamActions';
import {
  buildRegisteredExams,
  buildOpenExams,
  type RegisteredExam,
  type OpenExam,
} from '../../../utils/mobile/examRows';
import { splitByWeek } from '../../../utils/mobile/examWhen';
import { splitByRegistrationOpen } from '../../../utils/mobile/examOpening';
import { pluralSuffix } from '../../../utils/plural';
import { ScreenHeader } from './calendar/ScreenHeader';
import { ExamGroup } from './exams/ExamGroup';
import { NextUpStrip } from './exams/NextUpStrip';
import { NotYetOpenCard } from './exams/NotYetOpenCard';
import { RegisteredCard } from './exams/RegisteredCard';
import { OpenCard } from './exams/OpenCard';
import { ConfirmSheet } from '../sheets/ConfirmSheet';

function ExamsSkeleton() {
  const { t } = useTranslation();
  return (
    <ScreenSkeleton
      testId="exams-skeleton"
      label={t('mobile.exams.loading')}
      // One row shorter and no inset of its own: the header above it is real
      // now rather than a placeholder bar.
      rows={['h-20', 'h-20', 'h-20']}
      underHeader
    />
  );
}

/**
 * Exam season on a phone: what is coming next, then everything registered split
 * by whether it lands this week, then the slots still open.
 *
 * The three groups are the screen's whole structure. "This week" is the set a
 * student actually acts on; "later" is reassurance that it is handled; "open
 * slots" is the only group with anything to decide. Sorting all of it into one
 * list by date would bury that distinction.
 */
export function ExamsScreen() {
  const { t, language } = useTranslation();
  const { exams } = useExams();
  const now = useAppStore((s) => s.now);
  const userSemester = useAppStore((s) => s.userSemester);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);
  const syncLoaded = useAppStore((s) => s.syncLoaded);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const {
    processingSectionId,
    pendingAction,
    setPendingAction,
    handleRegisterRequest,
    handleUnregisterRequest,
    handleConfirmAction,
  } = useExamActions({ exams, setExpandedSectionId: setExpandedId });

  const registered = useMemo(() => buildRegisteredExams(exams, language), [exams, language]);
  const open = useMemo(() => buildOpenExams(exams, language), [exams, language]);
  const { thisWeek, later } = useMemo(
    () => splitByWeek(registered, (r) => r.date, now),
    [registered, now]
  );
  // "Otevřené termíny 2" has to mean two things that can be booked. A section
  // whose registration opens in December is not one of them — see
  // utils/mobile/examOpening.
  const { notYetOpen, open: bookable } = useMemo(
    () => splitByRegistrationOpen(open, now),
    [open, now]
  );

  // No "Zkouškové" label: it sat directly above a title reading "Zkoušky" and
  // told the student nothing the title had not already said. The semester it
  // used to be prefixed to is real information, so that survives on its own —
  // and where there is none, the row goes away and gives the title its width
  // back, which matters at 320px.
  const eyebrow = userSemester || undefined;
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const registeredCard = (row: RegisteredExam) => (
    <RegisteredCard
      key={row.section.id}
      row={row}
      locale={locale}
      expanded={expandedId === row.section.id}
      onToggle={() => toggle(row.section.id)}
      isProcessing={processingSectionId === row.section.id}
      onUnregister={handleUnregisterRequest}
      onRegister={handleRegisterRequest}
    />
  );

  const openCard = (row: OpenExam) => (
    <OpenCard
      key={row.section.id}
      row={row}
      now={now}
      expanded={expandedId === row.section.id}
      onToggle={() => toggle(row.section.id)}
      isProcessing={processingSectionId === row.section.id}
      onRegister={handleRegisterRequest}
    />
  );

  // Two different questions, and only one of them is `handshakeDone`. That
  // flag flips on the first status message, which the sync posts as it STARTS,
  // so on a first run it says "connected", not "finished". Until a crawl has
  // actually completed (`firstSyncSettled`) and while one is in flight, an
  // absence of exam terms means it has not arrived yet — show the skeleton rather than
  // an empty state that reads as a wrong answer.
  //
  // Same rule as the calendar: not gated on the latched `firstSyncSettled`, so
  // a retry shows the skeleton instead of parking on ScreenError. A student
  // with genuinely no exams is protected by `syncLoaded.exams` instead.
  // Its own row under the title rather than beside the header actions:
  // "Přihlášen na 3 zkoušky" next to the actions overflows 320px.
  const registeredPill =
    registered.length > 0 ? (
      <span className="w-fit whitespace-nowrap rounded-full bg-info/15 px-3 py-1.5 text-sm font-semibold text-info">
        {t(`mobile.exams.registeredCount${pluralSuffix(language, registered.length)}`, {
          count: registered.length,
        })}
      </span>
    ) : undefined;

  // The refresh circle rides the pill's row rather than earning one of its
  // own, so it costs zero vertical space on a screen that must fit without
  // scrolling. The row is unconditional even though the pill is not: at zero
  // registered exams `registeredPill` is `undefined`, and a control that
  // disappears for the student with nothing registered is missing exactly when
  // they are waiting on a fetch. A fourth header action was the alternative and
  // is ruled out — see HeaderActions on what a fourth 40px target does to
  // "Zkoušky" at 320px.
  const belowRow = (
    <div className="flex items-center gap-2">
      {registeredPill}
      <span className="ml-auto">
        <RefreshButton />
      </span>
    </div>
  );

  // The header renders in every state below, not only the loaded one. Returning
  // a bare skeleton or error in its place left two of the four tabs with no
  // route to the vývěska, search or notifications for as long as a crawl took —
  // the same hole CalendarScreen had, caught in review on this PR.
  const shell = (body: ReactNode) => (
    <div data-testid="exams-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader eyebrow={eyebrow} title={t('mobile.exams.title')} below={belowRow} />
      {body}
    </div>
  );

  if (
    (!handshakeDone && !handshakeTimedOut) ||
    (isSyncing && !syncLoaded.exams && exams.length === 0)
  ) {
    return shell(<ExamsSkeleton />);
  }

  // Same rule as the calendar: a settled sync that never delivered exams, with
  // nothing cached, is a failure and not an answer.
  if (firstSyncSettled && !syncLoaded.exams && exams.length === 0) {
    return shell(<ScreenError testId="exams-error" />);
  }

  return shell(
    <>
      {exams.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Calendar size={28} />
          </div>
          <div className="font-display text-lg font-bold">{t('mobile.exams.emptyTitle')}</div>
          <div className="max-w-56 text-sm text-base-content/60">{t('mobile.exams.emptyBody')}</div>
        </div>
      ) : (
        <>
          <NextUpStrip
            items={registered}
            now={now}
            locale={locale}
            t={t}
            onOpen={(item) => setExpandedId(item.section.id)}
          />
          <div
            data-testid="exam-list"
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[calc(6rem_+_var(--safe-bottom,0px))] pt-3"
          >
            {thisWeek.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupThisWeek')} count={thisWeek.length}>
                {thisWeek.map(registeredCard)}
              </ExamGroup>
            )}
            {later.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupLater')} count={later.length}>
                {later.map(registeredCard)}
              </ExamGroup>
            )}
            {/* Above the bookable ones: a term that has not opened is the
                thing a student is waiting on, and burying it under the list
                they have already decided about hides the date they came for. */}
            {notYetOpen.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupNotYetOpen')} count={notYetOpen.length}>
                {notYetOpen.map(({ row, earliest }) => (
                  <NotYetOpenCard
                    key={row.section.id}
                    row={row}
                    earliest={earliest}
                    locale={locale}
                    expanded={expandedId === row.section.id}
                    onToggle={() => toggle(row.section.id)}
                    isProcessing={processingSectionId === row.section.id}
                    onRegister={handleRegisterRequest}
                  />
                ))}
              </ExamGroup>
            )}
            {bookable.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupOpen')} count={bookable.length}>
                {bookable.map(openCard)}
              </ExamGroup>
            )}
          </div>
        </>
      )}

      <ConfirmSheet
        pendingAction={pendingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
