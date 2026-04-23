import { useState } from 'react';
import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { TermTile } from '../TermTile';
import { RegisteredTermDetails } from './RegisteredTermDetails';
import { ExamClassmatesList } from './ExamClassmatesPopover';
import { TermsSummary } from './TermsSummary';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

interface ExamSectionCardProps {
    subject: ExamSubject;
    section: ExamSection;
    isExpanded: boolean;
    isProcessing: boolean;
    onToggleExpand: (id: string) => void;
    onRegister: (section: ExamSection, termId: string) => void;
    onUnregister: (section: ExamSection) => void;
    armedTerms?: Map<string, any>;
    firingTerms?: Set<string>;
    toggleArm?: (term: any, section: ExamSection) => void;
}

export function ExamSectionCard({ subject, section, isExpanded, isProcessing, onToggleExpand, onRegister, onUnregister, armedTerms, firingTerms, toggleArm }: ExamSectionCardProps) {
    const { t, language } = useTranslation();
    const [classmatesOpen, setClassmatesOpen] = useState(false);
    const terminId = section.registeredTerm?.id;
    const classmates = useAppStore(s => terminId ? s.examClassmates[terminId] : undefined);
    const isReg = section.status === 'registered';

    const canUnregister = (() => {
        const deadline = section.registeredTerm?.deregistrationDeadline;
        if (!deadline) return isReg;
        const [datePart, timePart] = deadline.split(' ');
        const [day, month, year] = datePart.split('.');
        const [hours, minutes] = timePart.split(':');
        const deadlineDate = new Date(+year, +month - 1, +day, +hours, +minutes);
        return isReg && new Date() <= deadlineDate;
    })();

    const subjectName = (language === 'en' && subject.nameEn) ? subject.nameEn : (subject.nameCs || subject.name);
    const sectionName = (language === 'en' && section.nameEn) ? section.nameEn : (section.nameCs || section.name);

    return (
        <div className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow overflow-hidden">
            {/* Interactive Header Wrapper */}
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
                    </div>
                    {isReg && section.registeredTerm ? (
                        <RegisteredTermDetails
                            section={section}
                            classmatesCount={classmates?.length}
                            classmatesOpen={classmatesOpen}
                            onToggleClassmates={e => { e.stopPropagation(); setClassmatesOpen(p => !p); }}
                        />
                    ) : (
                        section.terms.length > 0 && !isExpanded && <TermsSummary terms={section.terms} />
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {canUnregister && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUnregister(section); }}
                            disabled={isProcessing}
                            className="btn btn-sm btn-error btn-outline"
                        >
                            {isProcessing ? <span className="loading loading-spinner loading-xs" /> : t('exams.unregister')}
                        </button>
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

            {/* Full-width classmates list */}
            {classmatesOpen && classmates && (
                <div className="border-t border-base-200">
                    <ExamClassmatesList classmates={classmates} />
                </div>
            )}

            {isExpanded && section.terms.length > 0 && (
                <div className="p-3 pt-0">
                    <div className="mt-1 pt-4 border-t border-base-200">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-3 ml-1">
                            {t('exams.clickToRegister')}
                        </div>
                        <div className="flex flex-col gap-2">
                            {section.terms.map(t => (
                                <TermTile
                                    key={t.id}
                                    term={t}
                                    section={section}
                                    isArmed={armedTerms?.has(t.id)}
                                    isFiring={firingTerms?.has(t.id)}
                                    onToggleArm={toggleArm ? () => toggleArm(t, section) : undefined}
                                    onSelect={() => onRegister(section, t.id)}
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
