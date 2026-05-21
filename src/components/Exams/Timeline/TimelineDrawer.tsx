import { AlertCircle, LogOut } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { TermTile } from '../../TermTile';
import type { ExamSection } from '../../../types/exams';
import type { TimelineExam } from './ExamTimeline';

interface Props {
    exam: TimelineExam;
    onUnregister?: (section: ExamSection) => void;
    onChangeTerm?: (section: ExamSection, termId: string) => void;
    isProcessing?: boolean;
}

export function parseDeadline(s: string): Date | null {
    const [datePart, timePart] = s.split(' ');
    if (!datePart || !timePart) return null;
    const [d, m, y] = datePart.split('.').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    if ([d, m, y, h, min].some(Number.isNaN)) return null;
    return new Date(y, m - 1, d, h, min);
}

export function getDeadlineUrgency(deadline?: string): 'none' | 'warning' | 'critical' | 'expired' {
    if (!deadline) return 'none';
    const parsed = parseDeadline(deadline);
    if (!parsed) return 'none';
    const ms = parsed.getTime() - Date.now();
    if (ms < 0) return 'expired';
    if (ms < 86_400_000) return 'critical';
    if (ms < 172_800_000) return 'warning';
    return 'none';
}

export function formatDeadlineCountdown(deadline: string): string {
    const parsed = parseDeadline(deadline);
    if (!parsed) return '';
    const ms = parsed.getTime() - Date.now();
    if (ms < 0) return '';
    const h = Math.floor(ms / 3_600_000);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

const urgencyText = {
    none: 'text-base-content/50',
    warning: 'text-warning',
    critical: 'text-error',
    expired: 'text-base-content/30',
};

export function TimelineDrawer({ exam, onUnregister, onChangeTerm, isProcessing }: Props) {
    const { t } = useTranslation();
    const section = exam.section!;
    const deadline = section.registeredTerm?.deregistrationDeadline;
    const urgency = getDeadlineUrgency(deadline);

    return (
        <div className="border-t border-base-200 bg-base-50/40 px-4 py-3 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-3 flex-wrap">
                {deadline ? (
                    <span className={`flex flex-wrap items-center gap-1.5 text-xs font-semibold ${urgency === 'expired' ? 'text-base-content/30' : urgencyText[urgency]} ${urgency === 'critical' ? 'animate-pulse' : ''}`}>
                        <AlertCircle size={12} className="shrink-0" />
                        <span className={urgency === 'expired' ? 'line-through' : ''}>{t('exams.unregisterDeadline')} {deadline}</span>
                        {urgency === 'expired' && (
                            <span className="badge badge-xs bg-error/10 text-error/80 border-none font-bold normal-case tracking-normal shrink-0">
                                {t('exams.afterDeadlineCannotDeregister')}
                            </span>
                        )}
                    </span>
                ) : <span />}

                {onUnregister && (
                    <div 
                        className={urgency === 'expired' ? "tooltip tooltip-left cursor-not-allowed ml-auto" : "ml-auto"}
                        data-tip={urgency === 'expired' ? t('exams.afterDeadlineCannotDeregister') : undefined}
                    >
                        <button
                            onClick={() => { if (urgency !== 'expired') onUnregister(section); }}
                            disabled={isProcessing || urgency === 'expired'}
                            className={`btn btn-xs gap-1 ${urgency === 'expired' ? 'btn-outline btn-neutral opacity-40 cursor-not-allowed' : 'btn-error btn-outline'}`}
                        >
                            {isProcessing ? (
                                <span className="loading loading-spinner loading-xs" />
                            ) : (
                                <><LogOut size={12} />{t('exams.unregister')}</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {section.terms.length > 0 && (
                <div className="mt-3 pt-3 border-t border-base-200 flex flex-col gap-2 max-h-96 overflow-y-auto">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-1">{t('exams.changeTerm')}</div>
                    {section.terms.map(term => (
                        <TermTile
                            key={term.id}
                            term={term}
                            section={section}
                            onSelect={() => { onChangeTerm?.(section, term.id); }}
                            isProcessing={isProcessing}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
