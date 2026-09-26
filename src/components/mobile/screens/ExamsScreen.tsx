import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { ScreenError } from '../primitives/ScreenError';
import { useTranslation } from '../../../hooks/useTranslation';
import { useExams } from '../../../hooks/data/useExams';
import { useExamActions } from '../../ExamPanel/useExamActions';
import {
  buildRegisteredExams,
  buildOpenExams,
  type RegisteredExam,
  type OpenExam,
} from '../../../utils/mobile/examRows';
import { dropFinished } from '../../../utils/mobile/examWhen';
import { splitByRegistrationOpen } from '../../../utils/mobile/examOpening';
import { pluralSuffix } from '../../../utils/plural';
import { ScreenHeader } from './calendar/ScreenHeader';
import { ExamGroup } from './exams/ExamGroup';
import { RegisteredStrip } from './exams/RegisteredStrip';
import { NotYetOpenCard } from './exams/NotYetOpenCard';
import { RegisteredCard } from './exams/RegisteredCard';
import { OpenCard } from './exams/OpenCard';
import { ExamsPullArea } from './exams/ExamsPullArea';
import { RefreshButton } from '../primitives/RefreshButton';
import { ConfirmSheet } from '../sheets/ConfirmSheet';
import { ReportMissingLink } from '../../Feedback/ReportMissingLink';

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
  const examsRefreshing = useAppStore((s) => s.examsRefreshing);
  const triggerExamsRefresh = useAppStore((s) => s.triggerExamsRefresh);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const {
    processingSectionId,
    pendingAction,
    setPendingAction,
    handleRegisterRequest,
    handleUnregisterRequest,
    handleConfirmAction,
  } = useExamActions({ exams, setExpandedSectionId: setExpandedId });

  // Only what is still to come. IS keeps a registered exam listed after it has
  // been sat, until it is graded — see `dropFinished` for why it is hidden
  // rather than grouped, and why "finished" means the day is over. Filtered
  // here, once, so the strip, the groups and the count all agree.
  const registered = useMemo(
    () => dropFinished(buildRegisteredExams(exams, language), (r) => r.date, now),
    [exams, language, now]
  );
  const open = useMemo(() => buildOpenExams(exams, language), [exams, language]);
  // "Otevřené termíny 2" has to mean two things that can be booked. A section
  // whose registration opens in December is not one of them — see
  // utils/mobile/examOpening.
  // Sections whose every term sits under "Kam se přihlásit nemohu?" are their
  // own group: nothing to book, and nothing that opens later either.
  const { blocked, joinable } = useMemo(() => {
    const onlyBlocked = (r: OpenExam) =>
      r.section.terms.length > 0 && r.section.terms.every((term) => term.cannotRegister);
    return { blocked: open.filter(onlyBlocked), joinable: open.filter((r) => !onlyBlocked(r)) };
  }, [open]);
  const { notYetOpen, open: bookable } = useMemo(
    () => splitByRegistrationOpen(joinable, now),
    [joinable, now]
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
      now={now}
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
      <span className="w-fit whitespace-nowrap rounded-full bg-success/15 px-3 py-1.5 text-sm font-semibold text-[var(--tone-success)]">
        {t(`mobile.exams.registeredCount${pluralSuffix(language, registered.length)}`, {
          count: registered.length,
        })}
      </span>
    ) : undefined;

  // The header renders in every state below, not only the loaded one. Returning
  // a bare skeleton or error in its place left two of the four tabs with no
  // route to the vývěska, search or notifications for as long as a crawl took —
  // the same hole CalendarScreen had, caught in review on this PR.
  // Refreshing is a pull on the list (ExamsPullArea), so the row under the
  // title is back to carrying only the registered pill, and only when there is
  // one. The refresh button sits among the header actions: sr-only on a touch
  // screen, a visible circle on a Mac, where nothing can pull.
  // Where a pull to refresh may start: anywhere on the screen (ExamsPullArea).
  const shell = (body: ReactNode) => (
    <div
      ref={screenRef}
      data-testid="exams-screen"
      className="flex flex-1 flex-col overflow-hidden"
    >
      <ScreenHeader
        eyebrow={eyebrow}
        title={t('mobile.exams.title')}
        below={registeredPill}
        action={
          <RefreshButton
            label={t('mobile.exams.refresh')}
            refreshing={examsRefreshing}
            onRefresh={triggerExamsRefresh}
          />
        }
      />
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
        <ExamsPullArea
          surfaceRef={screenRef}
          className="items-center justify-center gap-3 px-6 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-[var(--tone-primary)]">
            <Calendar size={28} />
          </div>
          <div className="font-display text-lg font-bold">{t('mobile.exams.emptyTitle')}</div>
          <div className="max-w-56 text-sm text-base-content/60">{t('mobile.exams.emptyBody')}</div>
          <ReportMissingLink prefill="examsEmpty" />
        </ExamsPullArea>
      ) : (
        <>
          <ExamsPullArea
            surfaceRef={screenRef}
            className="gap-4 px-4 pb-[calc(6rem_+_var(--safe-bottom,0px))] pt-3"
          >
            {/* The one place a registered exam appears — see RegisteredStrip.
                First, because these are the exams the student is committed to. */}
            {registered.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupRegistered')} tone="registered">
                <RegisteredStrip
                  rows={registered}
                  now={now}
                  locale={locale}
                  selectedId={expandedId}
                  onSelect={(row) => toggle(row.section.id)}
                  renderDetail={registeredCard}
                />
              </ExamGroup>
            )}
            {/* Above the bookable ones: a term that has not opened is the
              thing a student is waiting on, and burying it under the list
              they have already decided about hides the date they came for. */}
            {notYetOpen.length > 0 && (
              <ExamGroup
                title={t('mobile.exams.groupNotYetOpen')}
                count={notYetOpen.length}
                tone="notYetOpen"
              >
                {notYetOpen.map(({ row }) => (
                  <NotYetOpenCard
                    key={row.section.id}
                    row={row}
                    now={now}
                    expanded={expandedId === row.section.id}
                    onToggle={() => toggle(row.section.id)}
                    isProcessing={processingSectionId === row.section.id}
                    onRegister={handleRegisterRequest}
                  />
                ))}
              </ExamGroup>
            )}
            {bookable.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupOpen')} count={bookable.length} tone="open">
                {bookable.map(openCard)}
              </ExamGroup>
            )}
            {blocked.length > 0 && (
              <ExamGroup
                title={t('mobile.exams.groupBlocked')}
                count={blocked.length}
                tone="blocked"
              >
                {blocked.map((row) => (
                  <OpenCard
                    key={row.section.id}
                    row={row}
                    now={now}
                    accent="neutral"
                    expanded={expandedId === row.section.id}
                    onToggle={() => toggle(row.section.id)}
                    isProcessing={processingSectionId === row.section.id}
                    onRegister={handleRegisterRequest}
                  />
                ))}
              </ExamGroup>
            )}
          </ExamsPullArea>
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
