import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useExamClassmates } from '../../../../hooks/data/useExamClassmates';
import { pluralSuffix } from '../../../../utils/plural';
import { formatWhenRow } from '../../../../utils/mobile/examWhen';
import type { RegisteredExam } from '../../../../utils/mobile/examRows';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';
import { TermDetails } from './TermDetails';
import { MoreChip } from './MoreChip';
import { parseRegistrationStart } from '../../../../utils/termUtils';
import { alternativeTerms } from '../../../ExamPanel/utils';

/** The classmate line inside an expanded registered card. Its own component so
 *  `useExamClassmates` only fetches for the card actually open. */
function ClassmateLine({ term }: { term: ExamTerm }) {
  const { t, language } = useTranslation();
  const { classmates } = useExamClassmates(term.id);
  // No "Zatím nikdo ze spolužáků": an empty list means "nobody we could name"
  // at least as often as it means nobody is going — the classmate list is a
  // separate IS page, and it is the student's own year, not the term's roll.
  // Where there is nobody to name, the row says nothing and the card's terms
  // carry IS's own "Kdo jde se mnou na termín" link.
  // Nothing where there is nobody to name: the term's own details below carry
  // IS's "Kdo jde se mnou na termín" link, and two of them in one card is one
  // too many. Never "Zatím nikdo ze spolužáků" — an empty list means "nobody
  // we could name" at least as often as it means nobody is going.
  if (!classmates || classmates.length === 0) return null;
  return (
    <span className="flex items-center gap-1.5 text-sm text-base-content/70">
      <Users size={14} className="flex-shrink-0" />
      {t(`mobile.exams.mates${pluralSuffix(language, classmates.length)}`, {
        count: classmates.length,
      })}
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
  const [showDetails, setShowDetails] = useState(false);
  const deadline = row.term.deregistrationDeadline
    ? parseRegistrationStart(row.term.deregistrationDeadline)
    : null;
  const pastDeregDeadline = !!deadline && now.getTime() > deadline.getTime();
  // The card's header IS the registered term, so the term list below leaves it
  // out — it was the same term twice, one above the other. Its own facts hang
  // off the header instead. The richer copy is the one from `terms`: it is the
  // one that carries IS's Podrobnosti link (the real studium/obdobi behind
  // "Kdo jde se mnou"), the seat count and the form.
  const mine = row.section.terms.find((term) => term.id === row.term.id) ?? (row.term as ExamTerm);
  const others = alternativeTerms(row.section);
  return (
    <ExamRowCard
      title={row.subjectName}
      subtitle={row.sectionName}
      primaryMeta={formatWhenRow(row.date, row.term.time, locale)}
      secondaryMeta={row.term.room ?? ''}
      expanded={expanded}
      onToggle={onToggle}
    >
      <ClassmateLine term={mine} />
      {/* Behind the same chip the term rows use: the form, the length and the
          deregistration deadline are what a student opens when they want them,
          not three lines every card carries whether or not they asked. */}
      <button
        type="button"
        aria-expanded={showDetails}
        aria-label={t('mobile.exams.myTermDetailsAria')}
        onClick={() => setShowDetails((v) => !v)}
        className="flex w-fit items-center"
      >
        <MoreChip open={showDetails} />
      </button>
      {showDetails && <TermDetails term={mine} section={row.section} isRegHere now={now} />}
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
      {others.map((term) => (
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
