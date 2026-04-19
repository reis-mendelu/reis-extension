import { useState } from 'react';
import { Calendar, Clock, MapPin, AlertCircle, Users } from 'lucide-react';
import { getDayOfWeek } from './utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { ExamClassmatesList } from './ExamClassmatesPopover';
import type { ExamSection } from '../../types/exams';

interface RegisteredTermDetailsProps {
    section: ExamSection;
    terminId?: string;
}

export function RegisteredTermDetails({ section, terminId }: RegisteredTermDetailsProps) {
    const { t, language } = useTranslation();
    const [classmatesOpen, setClassmatesOpen] = useState(false);
    const classmates = useAppStore(s => terminId ? s.examClassmates[terminId] : undefined);
    const term = section.registeredTerm;
    if (!term) return null;

    return (
        <div className="text-xs text-base-content/60 flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-base-content/40" />
                    <span className="text-base-content/80 font-medium">{term.date}</span>
                    <span className="text-base-content/40">({getDayOfWeek(term.date, t)})</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-base-content/40" />
                    <span className="text-base-content/80 font-medium">{term.time}</span>
                </span>
                {term.room && (
                    <span className="flex items-center gap-1.5 ml-0.5">
                        <MapPin size={13} className="text-base-content/40" />
                        <span className="text-base-content/80 font-medium">{(language === 'en' && term.roomEn) ? term.roomEn : (term.roomCs || term.room)}</span>
                    </span>
                )}
                {classmates && (
                    <button
                        onClick={e => { e.stopPropagation(); setClassmatesOpen(p => !p); }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${classmatesOpen ? 'bg-primary text-primary-content' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                    >
                        <Users size={11} />
                        {classmates.length}
                    </button>
                )}
            </div>
            {term.deregistrationDeadline && (
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-warning/80 mt-1">
                    <AlertCircle size={10} />
                    <span>{t('exams.unregisterDeadline')} {term.deregistrationDeadline}</span>
                </div>
            )}
            {classmatesOpen && classmates && (
                <ExamClassmatesList classmates={classmates} />
            )}
        </div>
    );
}
