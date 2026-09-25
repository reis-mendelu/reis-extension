import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellRing } from 'lucide-react';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { useWatchdog } from '../../../../hooks/data/useWatchdog';
import { useTranslation } from '../../../../hooks/useTranslation';
import { freeSeats } from '../../../../utils/mobile/examRows';
import { parseCzechDateTime } from '../../../../utils/mobile/examTimeline';
import { formatDayMonth, trimHour } from '../../../../utils/mobile/examWhen';
import { reportToastOptions } from '../../../Feedback/reportPrefill';
import { AttemptBadge } from './AttemptBadge';
import { MoreChip } from './MoreChip';
import { TermDetails } from './TermDetails';
import { TermRowStatus } from './TermRowStatus';

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
  // Tapping the term's text opens its own details — see TermDetails.
  const [open, setOpen] = useState(false);

  // Mirror desktop's TermBuiltinActions inline micro-toast, but via the
  // shared sonner Toaster MobileApp already mounts — a failed toggle would
  // otherwise silently revert the button with no explanation at all.
  useEffect(() => {
    if (feedback === 'activated') toast.success(t('exams.watchdogActivated'));
    else if (feedback === 'deactivated') toast.info(t('exams.watchdogDeactivated'));
    else if (feedback === 'failed')
      toast.error(
        errorMessage || t('exams.watchdogFailed'),
        reportToastOptions(t, 'examActionFailed')
      );
    // Intentionally reacting only to `feedback` transitions: errorMessage/t
    // are read at the moment feedback fires (set together in useWatchdog),
    // not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const isRegHere = section.registeredTerm?.id === term.id;

  // "po 3. 8. · 14:00", with the seats left beneath; the room is under Více
  // (TermDetails). Falls back to the
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

  // Which attempts this term counts as. IS can list more than one, and
  // sometimes none.
  const attempts = term.attemptTypes ?? [];

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-3 py-2 ${
        isRegHere ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-100'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${t('mobile.exams.termDetailsAria')}: ${when}`}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
        >
          <span className="truncate text-md font-semibold text-base-content">{when}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-2sm">
            {/* Wraps rather than squeezes: a term counting as all three attempts
                needs three badges, which at 320px run into the Přihlásit button.
                The badges wrap as one group, never one stranded on its own line. */}
            {/* Seats first, the attempt badges after them: "volno 66 z 66 Ř".
                Seats are the number a student acts on, so they carry the status
                colour and lead the line; regular weight, as the colour is the
                signal. A badge each replaced the spelled-out attempt, which
                clipped the seat count on a phone. */}
            {subline && (
              <span
                className={`flex-shrink-0 ${
                  seats && seats.free > 0
                    ? 'text-[var(--tone-success)]'
                    : 'text-[var(--tone-error)]'
                }`}
              >
                {subline}
              </span>
            )}
            {attempts.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {attempts.map((type) => (
                  <AttemptBadge key={type} type={type} />
                ))}
              </span>
            )}
            <MoreChip open={open} />
          </span>
        </button>

        <TermRowStatus
          term={term}
          section={section}
          now={now}
          isRegHere={isRegHere}
          isProcessing={isProcessing}
          onRegister={onRegister}
        />

        {term.watchdogUrl && (
          <button
            type="button"
            data-testid="watch-toggle"
            onClick={() => void toggle()}
            disabled={firing}
            aria-label={armed ? t('exams.unwatchAriaLabel') : t('exams.watchAriaLabel')}
            className={`flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg border ${
              armed
                ? 'border-success/40 text-[var(--tone-success)]'
                : 'border-warning/40 text-[var(--tone-warning)]'
            } ${firing ? 'opacity-60' : ''}`}
          >
            {armed ? <BellRing size={13} /> : <Bell size={13} />}
          </button>
        )}
      </div>
      {open && <TermDetails term={term} section={section} isRegHere={isRegHere} now={now} />}
    </div>
  );
}
