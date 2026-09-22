import { Users } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useExamClassmates } from '../../../../hooks/data/useExamClassmates';
import { pluralSuffix } from '../../../../utils/plural';
import { formatWhenRow } from '../../../../utils/mobile/examWhen';
import type { RegisteredExam } from '../../../../utils/mobile/examRows';
import type { ExamSection } from '../../../../types/exams';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';
import { parseRegistrationStart } from '../../../../utils/termUtils';

/** The classmate line inside an expanded registered card. Its own component so
 *  `useExamClassmates` only fetches for the card actually open. */
function ClassmateLine({ termId }: { termId?: string }) {
  const { t, language } = useTranslation();
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

export interface RegisteredCardProps {
  row: RegisteredExam;
  locale: string;
  /** The store's clock, passed through to each term row. */
  now: Date;
  expanded: boolean;
  onToggle: () => void;
  isProcessing: boolean;
  onUnregister: (section: ExamSection) => void;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * An exam the student is signed up for: when and where, and the way back out.
 *
 * A component rather than a closure in the screen, matching `NotYetOpenCard`
 * and `OpenCard`. The screen was three card builders and a fetch of state
 * around them, and holding the three in one file made it the longest screen in
 * the app while none of the cards could be read on its own.
 */
export function RegisteredCard({
  row,
  locale,
  now,
  expanded,
  onToggle,
  isProcessing,
  onUnregister,
  onRegister,
}: RegisteredCardProps) {
  const { t } = useTranslation();
  const deadline = row.term.deregistrationDeadline
    ? parseRegistrationStart(row.term.deregistrationDeadline)
    : null;
  const pastDeregDeadline = !!deadline && now.getTime() > deadline.getTime();
  return (
    <ExamRowCard
      title={row.subjectName}
      subtitle={row.sectionName}
      primaryMeta={formatWhenRow(row.date, row.term.time, locale)}
      secondaryMeta={row.term.room ?? ''}
      expanded={expanded}
      onToggle={onToggle}
    >
      <ClassmateLine termId={row.term.id} />
      {/* IS closes deregistration at `deregistrationDeadline`. The button was
          offered whatever the date, so past the deadline a tap could only
          fail; the desktop panel has always said so instead. */}
      {pastDeregDeadline ? (
        <span className="flex min-h-11 w-full items-center justify-center rounded-lg bg-base-200 text-sm text-base-content/70">
          {t('exams.afterDeadlineCannotDeregister')}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onUnregister(row.section)}
          disabled={isProcessing}
          className="min-h-11 w-full rounded-lg border border-error/35 text-sm font-bold text-error disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            t('mobile.exams.unregister')
          )}
        </button>
      )}
      {row.section.terms.map((term) => (
        <TermRow
          key={term.id}
          term={term}
          section={row.section}
          now={now}
          isProcessing={isProcessing}
          onRegister={onRegister}
        />
      ))}
    </ExamRowCard>
  );
}
