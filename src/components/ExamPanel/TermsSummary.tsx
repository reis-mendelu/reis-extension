import { CircleCheck, Clock, RotateCcw } from 'lucide-react';
import type { ExamTerm } from '../../types/exams';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { formatCountdown } from '../../utils/termUtils';
import type { SectionState } from './utils';

export function TermsSummary({ terms, sectionState }: { terms: ExamTerm[], sectionState: SectionState }) {
    const { t } = useTranslation();
    const now = useAppStore(s => s.now);
    const count = terms.length;
    const label = count === 1 ? t('exams.term') : count > 1 && count < 5 ? t('exams.terms24') : t('exams.terms5plus');

    if (sectionState.type === 'opening') {
        const ms = sectionState.earliest.getTime() - now.getTime();
        return (
            <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider whitespace-nowrap">{count} {label}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-warning/70 tracking-wide">
                    <Clock size={9} className="shrink-0" />
                    {t('exams.opens')} {ms > 0 ? formatCountdown(ms) : t('exams.opening')}
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 mt-2.5">
            <div className="flex items-center gap-3">
                {sectionState.type !== 'open' && (
                    <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider whitespace-nowrap">{count} {label}</span>
                )}

                <div className="flex items-center gap-1.5 overflow-hidden">
                    {terms.slice(0, 3).map((term) => (
                        <div
                            key={term.id}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                term.full || (term.capacity && term.capacity.occupied >= term.capacity.total)
                                    ? 'bg-base-200 text-base-content/30'
                                    : term.attemptType && term.attemptType !== 'regular'
                                        ? 'bg-warning/10 text-warning/80'
                                        : term.canRegisterNow === true
                                            ? 'bg-success/10 text-success/80'
                                            : 'bg-primary/5 text-primary/70'
                            }`}
                        >
                            {term.attemptType === 'regular' && <CircleCheck size={9} className="shrink-0" />}
                            {term.attemptType && term.attemptType !== 'regular' && <RotateCcw size={9} className="shrink-0" />}
                            {term.date.split('.').slice(0, 2).join('.')}
                        </div>
                    ))}
                    {terms.length > 3 && <span className="text-[10px] font-bold text-base-content/30">+{terms.length - 3}</span>}
                </div>
            </div>
        </div>
    );
}
