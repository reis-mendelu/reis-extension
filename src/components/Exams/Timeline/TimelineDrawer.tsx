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

export function parseDeadline(s: string): Date {
    const [datePart, timePart] = s.split(' ');
    const [d, m, y] = datePart.split('.').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
}

export function getDeadlineUrgency(deadline?: string): 'none' | 'warning' | 'critical' | 'expired' {
    if (!deadline) return 'none';
    const ms = parseDeadline(deadline).getTime() - Date.now();
    if (ms < 0) return 'expired';
    if (ms < 86_400_000) return 'critical';
    if (ms < 172_800_000) return 'warning';
    return 'none';
}

export function formatDeadlineCountdown(deadline: string): string {
    const ms = parseDeadline(deadline).getTime() - Date.now();
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
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${urgencyText[urgency]} ${urgency === 'critical' ? 'animate-pulse' : ''}`}>
                        <AlertCircle size={12} />
                        {t('exams.unregisterDeadline')} {deadline}
                    </span>
                ) : <span />}

                {urgency !== 'expired' && onUnregister && (
                    <button
                        onClick={() => onUnregister(section)}
                        disabled={isProcessing}
                        className="btn btn-xs btn-error btn-outline gap-1 ml-auto"
                    >
                        {isProcessing
                            ? <span className="loading loading-spinner loading-xs" />
                            : <><LogOut size={12} />{t('exams.unregister')}</>}
                    </button>
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
                            onSelect={() => { onChangeTerm?.(section, term.id); setShowTerms(false); }}
                            isProcessing={isProcessing}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
