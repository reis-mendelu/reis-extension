import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { useTranslation } from '../../../../hooks/useTranslation';
import { formatOpensAtBare } from '../../../../utils/mobile/examOpening';
import { parseRegistrationStart } from '../../../../utils/termUtils';

export interface TermRowStatusProps {
  term: ExamTerm;
  section: ExamSection;
  now: Date;
  /** The student is registered on THIS term. */
  isRegHere: boolean;
  isProcessing: boolean;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * A term row's trailing slot: its one answer to "can I act on this?" — your
 * term, closed, cannot register (with IS's reason), full, register, or when it
 * opens. Nothing at all only where none of those is true.
 */
export function TermRowStatus({
  term,
  section,
  now,
  isRegHere,
  isProcessing,
  onRegister,
}: TermRowStatusProps) {
  const { t } = useTranslation();
  const isFull = term.full || !!(term.capacity && term.capacity.occupied >= term.capacity.total);
  // Only a start date still ahead of `now` says "opens later". A past one is
  // registration that already opened — and closed — which is a different fact
  // and must not be dressed up as this one.
  const opensAt = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
  const opensLater = !term.canRegisterNow && opensAt && opensAt.getTime() > now.getTime();
  // Registration is over. The desktop tile marks this "UZAVŘENO" and greys the
  // whole tile; the row used to leave its slot empty, which reads as "nothing
  // to say here" rather than "too late".
  const regEnd = term.registrationEnd ? parseRegistrationStart(term.registrationEnd) : null;
  const isClosed = !!regEnd && regEnd.getTime() < now.getTime();

  return isRegHere ? (
    <span className="flex-shrink-0 text-sm font-bold text-success">
      {t('mobile.exams.yourTerm')}
    </span>
  ) : isClosed ? (
    <span className="flex-shrink-0 text-sm font-semibold text-base-content/60">
      {t('mobile.exams.closed')}
    </span>
  ) : term.cannotRegister ? (
    // From "Kam se přihlásit nemohu?": its registration may open later on
    // paper, but not for this student — so no "otevírá se", and IS's own
    // reason one tap away.
    <span className="flex flex-shrink-0 flex-col items-end leading-tight">
      <span className="whitespace-nowrap text-2sm text-base-content/60">
        {t('mobile.exams.cannotRegister')}
      </span>
      {term.blockReasonUrl && (
        <a
          href={term.blockReasonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap text-2sm font-semibold text-base-content underline"
        >
          {t('mobile.exams.whyNot')}
        </a>
      )}
    </span>
  ) : isFull ? (
    <span className="flex-shrink-0 text-sm font-semibold text-base-content/60">
      {t('mobile.exams.full')}
    </span>
  ) : term.canRegisterNow ? (
    <button
      type="button"
      onClick={() => onRegister(section, term.id)}
      disabled={isProcessing}
      className="min-h-11 flex-shrink-0 rounded-lg bg-primary/15 px-4 text-sm font-bold text-primary disabled:opacity-50"
    >
      {t('mobile.exams.register')}
    </button>
  ) : opensLater ? (
    // Two lines, not one. The sentence on a single line is 152px wide on a
    // 375px screen — it ate the room name and cut the time mid-digit
    // ("po 9. 11. · 10:2…"). Stacked, it is about as wide as the register
    // button that will replace it, which is the point of the slot.
    <span className="flex flex-shrink-0 flex-col items-end leading-tight text-warning/90">
      <span className="whitespace-nowrap text-2sm">{t('mobile.exams.opensAtLabel')}</span>
      <span className="whitespace-nowrap text-2sm font-medium">{formatOpensAtBare(opensAt)}</span>
    </span>
  ) : null;
}
