/**
 * ExamSectionCard Component
 * 
 * Renders a single exam section with its terms.
 */

import { ChevronDown, ChevronUp, AlertCircle, Repeat, Calendar, Clock, MapPin, Timer } from 'lucide-react';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { TermTile } from '../TermTile';
import { getDayOfWeek } from './utils';

interface ExamSectionCardProps {
    subject: ExamSubject;
    section: ExamSection;
    isExpanded: boolean;
    isProcessing: boolean;
    onToggleExpand: (sectionId: string) => void;
    onRegister: (section: ExamSection, termId: string) => void;
    onUnregister: (section: ExamSection) => void;
    onSelectSubject: (subj: { code: string; name: string; sectionName?: string; date?: string; time?: string; room?: string }) => void;
}

export function ExamSectionCard({
    subject,
    section,
    isExpanded,
    isProcessing,
    onToggleExpand,
    onRegister,
    onUnregister,
    onSelectSubject
}: ExamSectionCardProps) {
    const isRegistered = section.status === 'registered';

    return (
        <div className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
            <div className="card-body p-4">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Subject + Section Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span 
                                className="badge badge-sm font-bold bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20 active:scale-95 transition-all"
                                onClick={() => onSelectSubject({ ...subject, sectionName: section.name })}
                                title="Klikněte pro zobrazení souborů a statistik předmětu"
                            >
                                {subject.name}
                            </span>
                            <span className="text-sm font-bold text-base-content/80 truncate">
                                {section.name}
                            </span>
                            {isRegistered && (
                                <span className="badge badge-success badge-outline badge-sm font-semibold">Přihlášen</span>
                            )}
                        </div>

                        {/* Registered Term Details */}
                        {isRegistered && section.registeredTerm && (
                            <RegisteredTermDetails section={section} />
                        )}

                        {/* Available Terms Summary - only when collapsed */}
                        {!isRegistered && section.terms.length > 0 && !isExpanded && (
                            <TermsSummary terms={section.terms} />
                        )}
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Unregister button for registered exams */}
                        {isRegistered && (
                            <button
                                onClick={() => onUnregister(section)}
                                disabled={isProcessing}
                                className="btn btn-sm btn-error btn-outline gap-1"
                            >
                                {isProcessing ? (
                                    <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                    'Odhlásit se'
                                )}
                            </button>
                        )}

                        {/* Expand button to show other terms */}
                        {section.terms.length > 0 && (
                            <button
                                onClick={() => onToggleExpand(section.id)}
                                disabled={isProcessing}
                                className={isRegistered && !isExpanded 
                                    ? "btn btn-sm btn-outline border-base-300 hover:border-warning hover:bg-warning/10 hover:text-warning gap-1" 
                                    : "btn btn-sm btn-ghost gap-1"}
                            >
                                {isExpanded ? (
                                    <>Zavřít <ChevronUp size={14} /></>
                                ) : isRegistered ? (
                                    <>Změnit termín <Repeat size={14} /></>
                                ) : (
                                    <>Vybrat <ChevronDown size={14} /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Expanded: Inline Term Tiles */}
                {isExpanded && section.terms.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-base-200">
                        <div className="text-xs text-base-content/50 mb-2">
                            Klikněte pro přihlášení:
                        </div>
                        <div className="flex flex-col gap-2">
                            {section.terms.map(term => (
                                <TermTile
                                    key={term.id}
                                    term={term}
                                    onSelect={() => {
                                        console.debug('[ExamSectionCard] Direct registration for term:', term.id);
                                        onRegister(section, term.id);
                                    }}
                                    isProcessing={isProcessing}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Registered term details subcomponent
 */
function RegisteredTermDetails({ section }: { section: ExamSection }) {
    const term = section.registeredTerm;
    if (!term) return null;

    return (
        <div className="text-xs text-base-content/60 flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-base-content/40" />
                    <span className="text-base-content/80 font-medium">{term.date}</span>
                    <span className="text-base-content/40">({getDayOfWeek(term.date)})</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-base-content/40" />
                    <span className="text-base-content/80 font-medium">{term.time}</span>
                </span>
                {term.room && (
                    <span className="flex items-center gap-1.5 ml-0.5">
                        <MapPin size={13} className="text-base-content/40" />
                        <span className="text-base-content/80 font-medium">{term.room}</span>
                    </span>
                )}
            </div>

            {term.deregistrationDeadline && (
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-warning/80 mt-1">
                    <AlertCircle size={10} />
                    <span>Odhlášení do: {term.deregistrationDeadline}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Terms summary for collapsed state
 */
function TermsSummary({ terms }: { terms: ExamSection['terms'] }) {
    // Find if any term is opening in the future
    const openingTerm = terms.find(t => t.canRegisterNow !== true && t.registrationStart);
    
    return (
        <div className="flex flex-col gap-2 mt-2.5">
            <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">
                    {terms.length} termín{terms.length > 1 ? (terms.length < 5 ? 'y' : 'ů') : ''}
                </span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {terms.slice(0, 3).map(term => (
                        <div 
                            key={term.id} 
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${term.full ? 'bg-base-200 text-base-content/30' : 'bg-primary/5 text-primary/70'}`}
                        >
                            {term.date.split('.').slice(0, 2).join('.')}
                        </div>
                    ))}
                    {terms.length > 3 && (
                        <span className="text-[10px] font-bold text-base-content/30">
                            +{terms.length - 3}
                        </span>
                    )}
                </div>
            </div>

            {openingTerm && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-warning/80">
                    <Timer size={12} className="text-warning/60" />
                    <span className="uppercase tracking-tight">Otevírá se: {openingTerm.registrationStart}</span>
                </div>
            )}
        </div>
    );
}
