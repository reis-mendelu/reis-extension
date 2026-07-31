import { useMemo, useState } from 'react';
import { Calendar, Users } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useExams } from '../../../hooks/data/useExams';
import { useExamClassmates } from '../../../hooks/data/useExamClassmates';
import { useExamActions } from '../../ExamPanel/useExamActions';
import {
  buildRegisteredExams,
  buildOpenExams,
  type RegisteredExam,
  type OpenExam,
} from '../../../utils/mobile/examRows';
import { splitByWeek, formatWhenRow } from '../../../utils/mobile/examWhen';
import { pluralSuffix } from '../../../utils/plural';
import { getSectionState } from '../../ExamPanel/utils';
import { ScreenHeader } from './calendar/ScreenHeader';
import { ExamGroup } from './exams/ExamGroup';
import { ExamRowCard } from './exams/ExamRowCard';
import { TermRow } from './exams/TermRow';
import { NextUpStrip } from './exams/NextUpStrip';
import { ConfirmSheet } from '../sheets/ConfirmSheet';

function ExamsSkeleton() {
  return (
    <div data-testid="exams-skeleton" className="flex flex-1 flex-col gap-3 overflow-hidden p-5">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-base-300" />
      <div className="h-20 animate-pulse rounded-2xl bg-base-300" />
      <div className="h-20 animate-pulse rounded-xl bg-base-300" />
      <div className="h-20 animate-pulse rounded-xl bg-base-300" />
    </div>
  );
}

/** The classmate line inside an expanded registered card. Kept as its own
 *  component so `useExamClassmates` only fetches for the card actually open. */
function ClassmateLine({
  termId,
  t,
  language,
}: {
  termId?: string;
  t: (k: string, p?: Record<string, string | number>) => string;
  language: string;
}) {
  const { classmates } = useExamClassmates(termId);
  if (classmates === null) return null;
  return (
    <span className="flex items-center gap-1.5 text-sm text-base-content/70">
      <Users size={14} className="flex-shrink-0" />
      {classmates.length > 0
        ? t(`mobile.exams.mates${pluralSuffix(language, classmates.length)}`, {
            count: classmates.length,
          })
        : t('mobile.exams.matesNone')}
    </span>
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

  const eyebrowLabel = t('mobile.exams.eyebrow');
  const eyebrow = userSemester ? `${eyebrowLabel} · ${userSemester}` : eyebrowLabel;
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const registeredCard = (row: RegisteredExam) => (
    <ExamRowCard
      key={row.section.id}
      title={row.sectionName}
      subtitle={row.subjectName}
      primaryMeta={formatWhenRow(row.date, row.term.time, locale)}
      secondaryMeta={row.term.room ?? ''}
      expanded={expandedId === row.section.id}
      onToggle={() => toggle(row.section.id)}
    >
      <ClassmateLine termId={row.term.id} t={t} language={language} />
      <button
        type="button"
        onClick={() => handleUnregisterRequest(row.section)}
        disabled={processingSectionId === row.section.id}
        className="min-h-11 w-full rounded-lg border border-error/35 text-sm font-bold text-error disabled:opacity-50"
      >
        {processingSectionId === row.section.id ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          t('mobile.exams.unregister')
        )}
      </button>
      {row.section.terms.map((term) => (
        <TermRow
          key={term.id}
          term={term}
          section={row.section}
          isProcessing={processingSectionId === row.section.id}
          onRegister={handleRegisterRequest}
        />
      ))}
    </ExamRowCard>
  );

  const openCard = (row: OpenExam) => {
    const state = getSectionState(row.section, now);
    const openCount = state.type === 'open' ? state.openCount : 0;
    return (
      <ExamRowCard
        key={row.section.id}
        title={row.sectionName}
        subtitle={row.subjectName}
        primaryMeta={openCount > 0 ? `${openCount} ${t('exams.available')}` : ''}
        secondaryMeta={t(
          `mobile.exams.termCount${pluralSuffix(language, row.section.terms.length)}`,
          { count: row.section.terms.length }
        )}
        expanded={expandedId === row.section.id}
        onToggle={() => toggle(row.section.id)}
      >
        {row.section.terms.map((term) => (
          <TermRow
            key={term.id}
            term={term}
            section={row.section}
            isProcessing={processingSectionId === row.section.id}
            onRegister={handleRegisterRequest}
          />
        ))}
      </ExamRowCard>
    );
  };

  if (!handshakeDone && !handshakeTimedOut) return <ExamsSkeleton />;

  return (
    <div data-testid="exams-screen" className="flex flex-1 flex-col overflow-hidden">
      <ScreenHeader
        eyebrow={eyebrow}
        title={t('mobile.exams.title')}
        action={
          registered.length > 0 ? (
            <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-info/15 px-3 py-1.5 text-sm font-semibold text-info">
              {t(`mobile.exams.registeredCount${pluralSuffix(language, registered.length)}`, {
                count: registered.length,
              })}
            </span>
          ) : undefined
        }
      />

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
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-24 pt-3"
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
            {open.length > 0 && (
              <ExamGroup title={t('mobile.exams.groupOpen')} count={open.length}>
                {open.map(openCard)}
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
    </div>
  );
}
