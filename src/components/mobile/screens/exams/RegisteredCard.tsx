import { useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { formatWhenRow } from '../../../../utils/mobile/examWhen';
import type { RegisteredExam } from '../../../../utils/mobile/examRows';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';
import { TermDetails } from './TermDetails';
import { MoreChip } from './MoreChip';
import { parseRegistrationStart } from '../../../../utils/termUtils';
import { alternativeTerms } from '../../../ExamPanel/utils';

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
      // No room here: it is under Více, as on every term row.
      secondaryMeta=""
      expanded={expanded}
      onToggle={onToggle}
    >
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
      {/* Last, after the other terms: right under the "Více" chip a thumb
          reaching for the details could land on the way out instead. */}
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
          className="min-h-11 w-full rounded-lg border border-error/35 text-sm font-bold text-[var(--tone-error)] disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            t('mobile.exams.unregister')
          )}
        </button>
      )}
    </ExamRowCard>
  );
}
