import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ExamSubject, ExamSection } from '../../../../types/exams';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useExamClassmates } from '../../../../hooks/data/useExamClassmates';
import { getSectionState } from '../../../ExamPanel/utils';
import { TermRow } from './TermRow';

export interface ExamCardProps {
    subject: ExamSubject;
    section: ExamSection;
    isProcessing: boolean;
    onRegister: (section: ExamSection, termId: string) => void;
    onUnregister: (section: ExamSection) => void;
}

function StatusPill({ section, now, t }: { section: ExamSection; now: Date; t: (k: string) => string }) {
    const state = getSectionState(section, now);
    if (state.type === 'open') {
        return (
            <span className="flex-shrink-0 text-2xs font-bold text-success">
                {state.openCount} {t('exams.available')}
            </span>
        );
    }
    if (state.type === 'opening') {
        return <span className="flex-shrink-0 text-2xs font-semibold text-warning/70">{t('exams.opening')}</span>;
    }
    return null;
}

/**
 * One subject/section card. Disclosure (`expanded`) is purely local UI state —
 * it does not need to be driven by `useExamActions`, which only cares about
 * register/unregister lifecycle, not what's currently open on screen.
 */
export function ExamCard({ subject, section, isProcessing, onRegister, onUnregister }: ExamCardProps) {
    const { t, language } = useTranslation();
    const now = useAppStore((s) => s.now);
    const [expanded, setExpanded] = useState(false);
    const isRegistered = section.status === 'registered';
    const { classmates } = useExamClassmates(isRegistered ? section.registeredTerm?.id : undefined);

    const subjectName = (language === 'en' && subject.nameEn) ? subject.nameEn : (subject.nameCs || subject.name);
    const sectionName = (language === 'en' && section.nameEn) ? section.nameEn : (section.nameCs || section.name);
    const hasTerms = section.terms.length > 0;

    return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-base-300 bg-base-100 p-3.5 shadow-card">
            <div
                onClick={() => hasTerms && setExpanded((e) => !e)}
                className={`flex items-center gap-3 ${hasTerms ? 'cursor-pointer' : ''}`}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-base-content">{subjectName}</span>
                    <span className="truncate text-xs text-base-content/60">{sectionName}</span>
                </div>
                {isRegistered ? (
                    <span className="flex-shrink-0 text-2xs font-bold text-success">{t('exams.registered')}</span>
                ) : (
                    <StatusPill section={section} now={now} t={t} />
                )}
                {hasTerms && (
                    expanded
                        ? <ChevronUp size={14} className="flex-shrink-0 text-base-content/60" />
                        : <ChevronDown size={14} className="flex-shrink-0 text-base-content/60" />
                )}
            </div>

            {isRegistered && section.registeredTerm && (
                <div className="flex flex-col gap-2">
                    {classmates !== null && (
                        <span className="text-2xs text-base-content/70">
                            {classmates.length > 0
                                ? t('mobile.exams.mates', { count: classmates.length })
                                : t('mobile.exams.matesNone')}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onUnregister(section); }}
                        disabled={isProcessing}
                        className="min-h-11 w-full rounded-lg border border-error/35 text-xs font-semibold text-error disabled:opacity-50"
                    >
                        {isProcessing ? <span className="loading loading-spinner loading-xs" /> : t('mobile.exams.unregister')}
                    </button>
                </div>
            )}

            {expanded && hasTerms && (
                <div className="flex flex-col gap-2 border-t border-base-200 pt-2.5">
                    {section.terms.map((term) => (
                        <TermRow key={term.id} term={term} section={section} isProcessing={isProcessing} onRegister={onRegister} />
                    ))}
                </div>
            )}
        </div>
    );
}
