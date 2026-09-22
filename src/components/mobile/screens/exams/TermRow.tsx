import { useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, BellRing } from 'lucide-react';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { useWatchdog } from '../../../../hooks/data/useWatchdog';
import { useTranslation } from '../../../../hooks/useTranslation';
import { freeSeats } from '../../../../utils/mobile/examRows';
import { parseCzechDateTime } from '../../../../utils/mobile/examTimeline';
import { formatDayMonth, trimHour } from '../../../../utils/mobile/examWhen';
import { formatOpensAtBare } from '../../../../utils/mobile/examOpening';
import { parseRegistrationStart } from '../../../../utils/termUtils';

export interface TermRowProps {
  term: ExamTerm;
  section: ExamSection;
  /** The store's clock, so "has registration opened yet" and the tests agree
   *  on the same moment. */
  now: Date;
  isProcessing: boolean;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * One exam term row: date/time label, a room/teacher/form sub-line, and
 * exactly one trailing control (register / "your slot" / full / when it opens).
 * The watch button is independent of that — it renders whenever IS marks the
 * term watchable, regardless of which of the four states above applies.
 *
 * That trailing slot is the row's single answer to "can I act on this?", so a
 * term IS has not opened yet fills it with the moment it will, rather than
 * leaving the blank that used to read as "nothing here".
 */
export function TermRow({ term, section, now, isProcessing, onRegister }: TermRowProps) {
  const { t, language } = useTranslation();
  const { armed, firing, feedback, errorMessage, toggle } = useWatchdog(term);

  // Mirror desktop's TermBuiltinActions inline micro-toast, but via the
  // shared sonner Toaster MobileApp already mounts — a failed toggle would
  // otherwise silently revert the button with no explanation at all.
  useEffect(() => {
    if (feedback === 'activated') toast.success(t('exams.watchdogActivated'));
    else if (feedback === 'deactivated') toast.info(t('exams.watchdogDeactivated'));
    else if (feedback === 'failed') toast.error(errorMessage || t('exams.watchdogFailed'));
    // Intentionally reacting only to `feedback` transitions: errorMessage/t
    // are read at the moment feedback fires (set together in useWatchdog),
    // not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const isRegHere = section.registeredTerm?.id === term.id;
  const isFull = term.full || !!(term.capacity && term.capacity.occupied >= term.capacity.total);
  const room = language === 'en' && term.roomEn ? term.roomEn : term.roomCs || term.room;

  // "po 3. 8. · 14:00 · Q08", with the seats left beneath. Falls back to the
  // raw IS strings when the date does not parse, so a placeholder value
  // never blanks out the row.
  const parsed = parseCzechDateTime(term.date, term.time);
  const when = parsed
    ? `${formatDayMonth(parsed, language === 'en' ? 'en-US' : 'cs-CZ')} · ${trimHour(term.time)}`
    : `${term.date} · ${term.time}`;
  // Seats only. The row already carries date, time, room and a status on one
  // line; adding the teacher and the section form pushed it to six facts and
  // truncated the name mid-title anyway ("Ing. Břetislav Andrlí…"). The design
  // shows just the seat count here, and the teacher stays available on the
  // subject's own screen.
  const seats = freeSeats(term);
  const subline = seats ? t('mobile.exams.freeOf', { free: seats.free, total: seats.total }) : '';

  // "Řádný", "1. opravný" — the same `successRate.*` strings the desktop's
  // attempt pills use, so the two clients cannot drift apart on wording. A term
  // can serve as more than one attempt, and IS sometimes classifies none.
  const attempts = term.attemptTypes?.length
    ? term.attemptTypes.map((type) => t(`successRate.${type}`)).join(' · ')
    : '';

  // Only a start date still ahead of `now` says "opens later". A past one is
  // registration that already opened — and closed — which is a different fact
  // and must not be dressed up as this one.
  const opensAt = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
  const opensLater = !term.canRegisterNow && opensAt && opensAt.getTime() > now.getTime();

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
        isRegHere ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-100'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-md font-semibold text-base-content">
          {[when, room].filter(Boolean).join(' · ')}
        </span>
        {(attempts || subline) && (
          <span className="flex min-w-0 items-baseline gap-1.5 text-2sm">
            {/* Which attempt this term counts as decides whether the student may
                sit it at all, so it leads the line. Muted: it is a fact about
                the term, not a status to act on — and the gap plus that tone
                difference is what separates the two, rather than a bullet. A
                `text-base-content/30` dot was tried and is below AA, which the
                UI check flags; a separator nobody can see is not one. */}
            {attempts && <span className="truncate text-base-content/60">{attempts}</span>}
            {/* Seats are the one number a student acts on, so they carry the
                status colour — green while there is room, error once there is
                not — and they are the part that must NOT give way: a term
                serving two attempts ("1. opravný · 2. opravný", 129px of a
                187px line) clipped "volno 23 z 24" instead. The attempt label
                truncates first, which loses a suffix off a fact that was
                already stated in full on the terms above it.

                Regular weight, not semibold. Four rows of coloured bold text
                down a card is a wall of shouting — the colour alone is the
                signal, and adding weight to it made the list "bijící do očí". */}
            {subline && (
              <span
                className={`flex-shrink-0 ${
                  seats && seats.free > 0 ? 'text-success' : 'text-error'
                }`}
              >
                {subline}
              </span>
            )}
          </span>
        )}
      </div>

      {isRegHere ? (
        <span className="flex-shrink-0 text-sm font-bold text-success">
          {t('mobile.exams.yourTerm')}
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
          <span className="whitespace-nowrap text-2sm font-medium">
            {formatOpensAtBare(opensAt)}
          </span>
        </span>
      ) : null}

      {term.watchdogUrl && (
        <button
          type="button"
          data-testid="watch-toggle"
          onClick={() => void toggle()}
          disabled={firing}
          aria-label={armed ? t('exams.unwatchAriaLabel') : t('exams.watchAriaLabel')}
          className={`flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg border ${
            armed ? 'border-success/40 text-success' : 'border-warning/40 text-warning'
          } ${firing ? 'opacity-60' : ''}`}
        >
          {armed ? <BellRing size={13} /> : <Bell size={13} />}
        </button>
      )}
    </div>
  );
}
