import { Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import { getDayOfWeek } from './utils';
import { useTranslation } from '../../hooks/useTranslation';

import type { ExamSection } from '../../types/exams';

export function RegisteredTermDetails({ section }: { section: ExamSection }) {
    const { t, language } = useTranslation();
    const term = section.registeredTerm;
    if (!term) return null;
    return (
        <div className="text-xs text-base-content/60 flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-base-content/40" /><span className="text-base-content/80 font-medium">{term.date}</span><span className="text-base-content/40">({getDayOfWeek(term.date, t)})</span></span>
                <span className="flex items-center gap-1.5"><Clock size={13} className="text-base-content/40" /><span className="text-base-content/80 font-medium">{term.time}</span></span>
                {term.room && <span className="flex items-center gap-1.5 ml-0.5"><MapPin size={13} className="text-base-content/40" /><span className="text-base-content/80 font-medium">{ (language === 'en' && term.roomEn) ? term.roomEn : (term.roomCs || term.room) }</span></span>}
            </div>
            {term.deregistrationDeadline && <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-warning/80 mt-1"><AlertCircle size={10} /><span>{t('exams.unregisterDeadline')} {term.deregistrationDeadline}</span></div>}
        </div>
    );
}
