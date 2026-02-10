import { useState, useEffect } from 'react';
import { Clock, MapPin, Users, Timer, CircleCheck, RotateCcw } from 'lucide-react';
import type { ExamTerm } from '../types/exams';
import { getDayOfWeek, parseRegistrationStart, formatCountdown } from '../utils/termUtils';
import { useTranslation } from '../hooks/useTranslation';

export function TermTile({ term, onSelect, isProcessing = false }: { term: ExamTerm; onSelect: () => void; isProcessing?: boolean }) {
    const { t, language } = useTranslation();
    const [now, setNow] = useState(new Date());
    const regStart = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
    const regEnd = term.registrationEnd ? parseRegistrationStart(term.registrationEnd) : null;
    const isFuture = !!(regStart && regStart > now), isClosed = !!(regEnd && regEnd < now), isFull = term.full || (term.capacity && term.capacity.occupied >= term.capacity.total);
    const isBlocked = term.canRegisterNow === false && !isFuture && !isFull;
    const disabled = isFull || isProcessing || isFuture || isClosed || isBlocked;

    useEffect(() => { if (isFuture) { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); } }, [isFuture]);

    return (
        <button onClick={() => !disabled && onSelect()} disabled={disabled}
                className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all text-left ${isFuture ? 'bg-warning/5 border-warning/30' : (isFull || isClosed || isBlocked) ? 'bg-base-200 opacity-60' : 'bg-base-100 hover:border-primary shadow-sm'}`}>
            <div className="flex flex-col min-w-[80px]"><span className={`font-semibold ${disabled ? 'text-base-content/50 line-through' : ''}`}>{term.date.split('.').slice(0, 2).join('.')}</span><span className="text-xs text-base-content/60">{getDayOfWeek(term.date, t)}</span></div>
            {term.attemptType && <div className="flex items-center">{term.attemptType === 'regular' ? <CircleCheck size={14} className="text-success" /> : <div className="flex items-center gap-0.5"><RotateCcw size={12} className="text-warning" /><span className="text-[10px] font-bold text-warning">{term.attemptType === 'retake1' ? '1' : term.attemptType === 'retake2' ? '2' : '3'}</span></div>}</div>}
            <div className="flex items-center gap-1 min-w-[60px]"><Clock size={12} className="text-base-content/40" /><span className="text-sm opacity-70">{term.time}</span></div>
            {term.room && <div className="flex items-center gap-1 flex-1 min-w-0"><MapPin size={12} className="text-base-content/40 shrink-0" /><span className="text-sm truncate opacity-70">{(language === 'en' && term.roomEn) ? term.roomEn : (term.roomCs || term.room)}</span></div>}
            {isFuture ? <div className="flex items-center gap-2 min-w-[120px] bg-warning/10 px-2 py-1 rounded-md"><Timer size={14} className="text-warning" /><div className="flex flex-col"><span className="text-xs font-medium text-warning">{t('exams.countdown')} {formatCountdown(regStart!.getTime() - now.getTime())}</span><span className="text-[10px] text-warning/70">{term.registrationStart?.split(' ')[0]}</span></div></div>
            : term.capacity && <div className="flex items-center gap-2 min-w-[90px]"><Users size={12} className="text-base-content/40" /><div className="flex items-center gap-1.5"><progress className={`progress w-12 h-1.5 ${disabled ? 'progress-error' : 'progress-primary'}`} value={Math.min(100, (term.capacity.occupied / term.capacity.total) * 100)} max="100" /><span className={`text-xs ${disabled ? 'text-error font-medium' : 'opacity-50'}`}>{isFull ? t('exams.full') : (isClosed || isBlocked) ? t('exams.closed') : term.capacity.raw}</span></div></div> }
            <div className="shrink-0 ml-auto">{isProcessing ? <span className="loading loading-spinner loading-sm text-primary"></span> : isFuture ? <span className="text-warning text-sm">⏳</span> : (isFull || isClosed || isBlocked) ? <span className="text-error/60 text-sm font-medium">✕</span> : <span className="btn btn-primary btn-sm">{t('exams.register')}</span>}</div>
        </button>
    );
}
