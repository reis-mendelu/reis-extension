import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { TermTile } from '../TermTile';
import { RegisteredTermDetails } from './RegisteredTermDetails';
import { TermsSummary } from './TermsSummary';

export function ExamSectionCard({ subject, section, isExpanded, isProcessing, onToggleExpand, onRegister, onUnregister, onSelectSubject }: any) {
    const isReg = section.status === 'registered';
    return (
        <div className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
            <div className="p-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="badge badge-sm font-bold bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-all py-1 h-auto whitespace-normal" 
                                  onClick={() => onSelectSubject({ ...subject, courseCode: subject.code, courseName: subject.name, sectionName: section.name, isExam: true })}>
                                {subject.name}
                            </span>
                            <span className="text-sm font-bold opacity-80">{section.name}</span>
                            {isReg && <span className="badge badge-success badge-outline badge-sm font-semibold">Přihlášen</span>}
                        </div>
                        {isReg && section.registeredTerm ? <RegisteredTermDetails section={section} /> : (section.terms.length > 0 && !isExpanded && <TermsSummary terms={section.terms} />)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {isReg && <button onClick={() => onUnregister(section)} disabled={isProcessing} className="btn btn-sm btn-error btn-outline">{isProcessing ? <span className="loading loading-spinner loading-xs" /> : 'Odhlásit se'}</button>}
                        {section.terms.length > 0 && (
                            <button onClick={() => onToggleExpand(section.id)} disabled={isProcessing} className={isReg && !isExpanded ? "btn btn-sm btn-outline border-base-300 hover:border-warning hover:bg-warning/10 hover:text-warning gap-1" : "btn btn-sm btn-ghost gap-1"}>
                                {isExpanded ? <>Zavřít <ChevronUp size={14} /></> : isReg ? <>Změnit termín <Repeat size={14} /></> : <>Vybrat <ChevronDown size={14} /></>}
                            </button>
                        )}
                    </div>
                </div>
                {isExpanded && section.terms.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-base-200"><div className="text-xs opacity-50 mb-2">Klikněte pro přihlášení:</div><div className="flex flex-col gap-2">{section.terms.map((t: any) => <TermTile key={t.id} term={t} onSelect={() => onRegister(section, t.id)} isProcessing={isProcessing} />)}</div></div>
                )}
            </div>
        </div>
    );
}
