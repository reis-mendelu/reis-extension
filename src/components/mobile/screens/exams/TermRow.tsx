import { useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, BellRing } from 'lucide-react';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { useWatchdog } from '../../../../hooks/data/useWatchdog';
import { useTranslation } from '../../../../hooks/useTranslation';
import { freeSeats } from '../../../../utils/mobile/examRows';
import { parseCzechDateTime } from '../../../../utils/mobile/examTimeline';
import { formatDayMonth, trimHour } from '../../../../utils/mobile/examWhen';

export interface TermRowProps {
    term: ExamTerm;
    section: ExamSection;
    isProcessing: boolean;
    onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * One exam term row: date/time label, a room/teacher/form sub-line, and
 * exactly one trailing control (register / "your slot" / full). The watch
 * button is independent of that — it renders whenever IS marks the term
 * watchable, regardless of which of the three states above applies.
 */
export function TermRow({ term, section, isProcessing, onRegister }: TermRowProps) {
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
    const room = (language === 'en' && term.roomEn) ? term.roomEn : (term.roomCs || term.room);
    const sectionForm = (language === 'en' && term.sectionFormEn) ? term.sectionFormEn : (term.sectionFormCs || term.sectionForm);

    // "po 3. 8. · 14:00 · Q08", with the seats left beneath. Falls back to the
    // raw IS strings when the date does not parse, so a placeholder value
    // never blanks out the row.
    const parsed = parseCzechDateTime(term.date, term.time);
    const when = parsed
        ? `${formatDayMonth(parsed, language === 'en' ? 'en-US' : 'cs-CZ')} · ${trimHour(term.time)}`
        : `${term.date} · ${term.time}`;
    const seats = freeSeats(term);
    const subline = [
        seats ? t('mobile.exams.freeOf', { free: seats.free, total: seats.total }) : null,
        term.teacher,
        sectionForm,
    ].filter(Boolean).join(' · ');

    return (
        <div
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                isRegHere ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-100'
            }`}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-md font-bold text-base-content">
                    {[when, room].filter(Boolean).join(' · ')}
                </span>
                {subline && <span className="truncate text-2sm text-base-content/60">{subline}</span>}
            </div>

            {isRegHere ? (
                <span className="flex-shrink-0 text-sm font-bold text-success">{t('mobile.exams.yourTerm')}</span>
            ) : isFull ? (
                <span className="flex-shrink-0 text-sm font-semibold text-base-content/60">{t('mobile.exams.full')}</span>
            ) : term.canRegisterNow ? (
                <button
                    type="button"
                    onClick={() => onRegister(section, term.id)}
                    disabled={isProcessing}
                    className="min-h-11 flex-shrink-0 rounded-lg bg-primary/15 px-4 text-sm font-bold text-primary disabled:opacity-50"
                >
                    {t('mobile.exams.register')}
                </button>
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
