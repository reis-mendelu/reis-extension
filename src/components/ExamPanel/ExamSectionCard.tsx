import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { TermTile } from '../TermTile';
import { RegisteredTermDetails } from './RegisteredTermDetails';
import { TermsSummary } from './TermsSummary';
import { useTranslation } from '../../hooks/useTranslation';

interface ExamSectionCardProps {
    subject: ExamSubject;
    section: ExamSection;
    isExpanded: boolean;
    isProcessing: boolean;
    onToggleExpand: (id: string) => void;
    onRegister: (section: ExamSection, termId: string) => void;
    onUnregister: (section: ExamSection) => void;
    onSelectSubject: (subject: ExamSubject & { courseCode: string; courseName: string; sectionName: string; isExam: true }) => void;
}

export function ExamSectionCard({ subject, section, isExpanded, isProcessing, onToggleExpand, onRegister, onUnregister, onSelectSubject }: ExamSectionCardProps) {
    const { t, language } = useTranslation();
    const isReg = section.status === 'registered';
    
    // Localized names
    const subjectName = (language === 'en' && subject.nameEn) ? subject.nameEn : (subject.nameCs || subject.name);
    const sectionName = (language === 'en' && section.nameEn) ? section.nameEn : (section.nameCs || section.name);

    return (
        <div className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
            <div className="p-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="badge badge-sm font-bold bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-all py-1 h-auto whitespace-normal" 
                                  onClick={() => onSelectSubject({ ...subject, courseCode: subject.code, courseName: subjectName, sectionName: sectionName, isExam: true })}>
                                {subjectName}
                            </span>
                            <span className="text-sm font-bold opacity-80">{sectionName}</span>
                            {isReg && <span className="badge badge-success badge-outline badge-sm font-semibold">{t('exams.registered')}</span>}
                        </div>
                        {isReg && section.registeredTerm ? <RegisteredTermDetails section={section} /> : (section.terms.length > 0 && !isExpanded && <TermsSummary terms={section.terms} />)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {isReg && <button onClick={() => onUnregister(section)} disabled={isProcessing} className="btn btn-sm btn-error btn-outline">{isProcessing ? <span className="loading loading-spinner loading-xs" /> : t('exams.unregister')}</button>}
                        {section.terms.length > 0 && (
                            <button onClick={() => onToggleExpand(section.id)} disabled={isProcessing} className={isReg && !isExpanded ? "btn btn-sm btn-outline border-base-300 hover:border-warning hover:bg-warning/10 hover:text-warning gap-1" : "btn btn-sm btn-ghost gap-1"}>
                                {isExpanded ? <>{t('common.close')} <ChevronUp size={14} /></> : isReg ? <>{t('exams.changeTerm')} <Repeat size={14} /></> : <>{t('exams.select')} <ChevronDown size={14} /></>}
                            </button>
                        )}
                    </div>
                </div>
                {isExpanded && section.terms.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-base-200"><div className="text-xs opacity-50 mb-2">{t('exams.clickToRegister')}</div><div className="flex flex-col gap-2">{section.terms.map(t => <TermTile key={t.id} term={t} onSelect={() => onRegister(section, t.id)} isProcessing={isProcessing} />)}</div></div>
                )}
            </div>
        </div>
    );
}
