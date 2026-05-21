import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';
import { TermTile } from '../TermTile';
import { RegisteredTermDetails } from './RegisteredTermDetails';
import { ExamClassmatesStrip } from './ExamClassmatesStrip';
import { TermsSummary } from './TermsSummary';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { getSectionState } from './utils';
import { parseRegistrationStart } from '../../utils/termUtils';
import type { ArmedTerm } from './useAutoRegistration';

interface ExamSectionCardProps {
    subject: ExamSubject;
    section: ExamSection;
    isExpanded: boolean;
    isProcessing: boolean;
    onToggleExpand: (id: string) => void;
    onRegister: (section: ExamSection, termId: string) => void;
    onUnregister: (section: ExamSection) => void;
    armedTerms?: Map<string, ArmedTerm>;
    firingTerms?: Set<string>;
    toggleArm?: (term: ExamTerm, section: ExamSection) => void;
}

const stateCardClass = {
    registered: 'border-success/25 bg-success/[0.02]',
    open: 'border-success/25 bg-success/[0.02]',
    opening: 'border-base-200',
    noInfo: 'border-base-200',
    empty: 'border-base-200 opacity-55',
};

export function ExamSectionCard({ subject, section, isExpanded, isProcessing, onToggleExpand, onRegister, onUnregister, armedTerms, firingTerms, toggleArm }: ExamSectionCardProps) {
    const { t, language } = useTranslation();
    const now = useAppStore(s => s.now);
    const isReg = section.status === 'registered';
    const sectionState = isReg ? { type: 'registered' as const } : getSectionState(section, now);

    const isAfterDeadline = (() => {
        const deadline = section.registeredTerm?.deregistrationDeadline;
        if (!deadline) return false;
        const deadlineDate = parseRegistrationStart(deadline);
        return isReg && !!deadlineDate && now > deadlineDate;
    })();

    const subjectName = (language === 'en' && subject.nameEn) ? subject.nameEn : (subject.nameCs || subject.name);
    const sectionName = (language === 'en' && section.nameEn) ? section.nameEn : (section.nameCs || section.name);

    return (
        <div className={`card bg-base-100 shadow-sm border hover:shadow-md transition-shadow overflow-hidden ${stateCardClass[sectionState.type]}`}>
            <div
                onClick={() => section.terms.length > 0 && onToggleExpand(section.id)}
                className={`flex flex-wrap items-start justify-between gap-2 p-3 transition-colors ${section.terms.length > 0 ? 'cursor-pointer hover:bg-base-200/50' : ''}`}
            >
                <div className="flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="badge badge-sm font-bold bg-primary/10 text-primary py-1 h-auto whitespace-normal border-none">
                            {subjectName}
                        </span>
                        <span className="text-sm font-bold opacity-80">{sectionName}</span>
                        {isReg && <span className="badge badge-success badge-outline badge-sm font-semibold">{t('exams.registered')}</span>}
                        {!isReg && <SectionStatePill state={sectionState} t={t} />}
                    </div>
                    {isReg && section.registeredTerm ? (
                        <RegisteredTermDetails section={section} />
                    ) : (
                        section.terms.length > 0 && !isExpanded && <TermsSummary terms={section.terms} sectionState={sectionState} />
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {isReg && (
                        <div 
                            className={isAfterDeadline ? "tooltip tooltip-left md:tooltip-top cursor-not-allowed" : ""}
                            data-tip={isAfterDeadline ? t('exams.afterDeadlineCannotDeregister') : undefined}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); if (!isAfterDeadline) onUnregister(section); }}
                                disabled={isProcessing || isAfterDeadline}
                                className={`btn btn-sm ${isAfterDeadline ? 'btn-outline btn-neutral opacity-40 cursor-not-allowed' : 'btn-error btn-outline'}`}
                            >
                                {isProcessing ? (
                                    <span className="loading loading-spinner loading-xs" />
                                ) : (
                                    t('exams.unregister')
                                )}
                            </button>
                        </div>
                    )}

                    {section.terms.length > 0 && (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${isReg && !isExpanded ? 'bg-warning/10 text-warning border border-warning/20' : 'opacity-60'}`}>
                            {isExpanded ? (
                                <>{t('common.close')} <ChevronUp size={14} /></>
                            ) : isReg ? (
                                <>{t('exams.changeTerm')} <Repeat size={14} /></>
                            ) : (
                                <>{t('exams.select')} <ChevronDown size={14} /></>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isReg && section.registeredTerm?.id && !section.registeredTerm.id.includes('-') && (
                <div className="px-3 pb-3 -mt-1">
                    <ExamClassmatesStrip terminId={section.registeredTerm.id} />
                </div>
            )}

            {isExpanded && section.terms.length > 0 && (
                <div className="p-3 pt-0">
                    <div className="mt-1 pt-4 border-t border-base-200">
                        <div className="flex flex-col gap-2">
                            {section.terms.map(term => (
                                <TermTile
                                    key={term.id}
                                    term={term}
                                    section={section}
                                    isArmed={armedTerms?.has(term.id)}
                                    isFiring={firingTerms?.has(term.id)}
                                    onToggleArm={toggleArm ? () => toggleArm(term, section) : undefined}
                                    onSelect={() => onRegister(section, term.id)}
                                    isProcessing={isProcessing}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SectionStatePill({ state, t }: { state: ReturnType<typeof getSectionState>, t: (k: string) => string }) {
    if (state.type === 'open') return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-success/90 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
            {state.openCount} {t('exams.available')}
        </span>
    );
    if (state.type === 'opening') return (
        <span className="text-[10px] font-bold text-warning/60 uppercase tracking-wide">
            {t('exams.opening')}
        </span>
    );
    if (state.type === 'noInfo') return null;
    return null;
}
