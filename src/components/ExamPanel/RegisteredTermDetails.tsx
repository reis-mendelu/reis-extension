import { Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import { getDayOfWeek } from './utils';
import { useTranslation } from '../../hooks/useTranslation';
import type { ExamSection } from '../../types/exams';
import { useAppStore } from '../../store/useAppStore';
import { parseRegistrationStart } from '../../utils/termUtils';

interface RegisteredTermDetailsProps {
    section: ExamSection;
    classmatesCount?: number;
    classmatesOpen?: boolean;
    onToggleClassmates?: (e: React.MouseEvent) => void;
}

export function RegisteredTermDetails({ section, classmatesCount: _classmatesCount, classmatesOpen: _classmatesOpen, onToggleClassmates: _onToggleClassmates }: RegisteredTermDetailsProps) {
    const { t, language } = useTranslation();
    const now = useAppStore(s => s.now);
    const term = section.registeredTerm;
    if (!term) return null;

    const isAfterDeadline = (() => {
        if (!term.deregistrationDeadline) return false;
        const deadlineDate = parseRegistrationStart(term.deregistrationDeadline);
        return !!deadlineDate && now > deadlineDate;
    })();

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
            </div>
            {term.deregistrationDeadline && (
                <div className={`flex flex-wrap items-center gap-1.5 text-[10px] uppercase font-bold mt-1 ${isAfterDeadline ? 'text-base-content/30' : 'text-warning/80'}`}>
                    <AlertCircle size={10} className="shrink-0" />
                    <span className={isAfterDeadline ? 'line-through' : ''}>
                        {t('exams.unregisterDeadline')} {term.deregistrationDeadline}
                    </span>
                    {isAfterDeadline && (
                        <span className="badge badge-xs bg-error/10 text-error/80 border-none font-bold normal-case tracking-normal shrink-0">
                            {t('exams.afterDeadlineCannotDeregister')}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
