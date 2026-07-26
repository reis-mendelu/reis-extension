import { Bell, BellRing } from 'lucide-react';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { useWatchdog } from '../../../../hooks/data/useWatchdog';
import { useTranslation } from '../../../../hooks/useTranslation';

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
    const { t } = useTranslation();
    const { armed, firing, toggle } = useWatchdog(term);
    const isRegHere = section.registeredTerm?.id === term.id;
    const isFull = term.full || !!(term.capacity && term.capacity.occupied >= term.capacity.total);
    const subline = [term.room, term.teacher, term.sectionForm].filter(Boolean).join(' · ');

    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-base-200 bg-base-100 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-semibold text-content-primary">
                    {term.date} · {term.time}
                </span>
                {subline && <span className="truncate text-2xs text-content-muted">{subline}</span>}
            </div>

            {isRegHere ? (
                <span className="flex-shrink-0 text-2xs font-bold text-success">{t('mobile.exams.yourTerm')}</span>
            ) : isFull ? (
                <span className="flex-shrink-0 text-2xs font-semibold text-content-muted">{t('mobile.exams.full')}</span>
            ) : term.canRegisterNow ? (
                <button
                    type="button"
                    onClick={() => onRegister(section, term.id)}
                    disabled={isProcessing}
                    className="min-h-11 flex-shrink-0 rounded-lg bg-primary/15 px-3.5 text-xs font-semibold text-primary disabled:opacity-50"
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
