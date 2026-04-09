import { CircleCheck, RotateCcw, Zap } from 'lucide-react';
import type { ExamTerm, ExamSection } from '../types/exams';
import { getDayOfWeek, parseRegistrationStart, formatCountdown } from '../utils/termUtils';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/useAppStore';
import { SNIPER_WINDOW_MS } from './ExamPanel/useAutoRegistration';

export function TermTile({ term, section, isArmed, isFiring, onToggleArm, onSelect, isProcessing = false }: { term: ExamTerm; section?: ExamSection; isArmed?: boolean; isFiring?: boolean; onToggleArm?: () => void; onSelect: () => void; isProcessing?: boolean }) {
    const { t, language } = useTranslation();
    const now = useAppStore(s => s.now);
    const regStart = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
    const regEnd = term.registrationEnd ? parseRegistrationStart(term.registrationEnd) : null;
    const msRemaining = regStart ? regStart.getTime() - now.getTime() : 0;
    const isFuture = !!(regStart && regStart > now), isClosed = !!(regEnd && regEnd < now), isFull = term.full || (term.capacity && term.capacity.occupied >= term.capacity.total);
    const isWithinSniperWindow = isFuture && msRemaining <= SNIPER_WINDOW_MS;
    const isBlocked = term.canRegisterNow === false && !isFuture && !isFull;
    const disabled = isFull || isProcessing || isFuture || isClosed || isBlocked;
    const sameDeadline = term.registrationEnd && term.deregistrationDeadline && term.registrationEnd === term.deregistrationDeadline;

    return (
        <div onClick={() => !disabled && onSelect()}
                className={`flex flex-col w-full rounded-lg border transition-all text-left ${(isArmed || isFiring) ? 'bg-warning/10 border-warning shadow-[0_0_10px_rgba(251,189,35,0.3)]' : isFuture ? 'bg-warning/5 border-warning/30' : (isFull || isClosed || isBlocked) ? 'bg-base-200 opacity-60' : 'bg-base-100 hover:border-primary shadow-sm cursor-pointer'}`}>
            <div className="flex items-center gap-4 w-full p-3.5">
                {/* Date: Bold & Clear */}
                <div className="flex flex-col min-w-[70px]">
                    <span className={`text-base font-bold tracking-tight ${disabled ? 'text-base-content/40 line-through' : 'text-base-content'}`}>
                        {term.date.split('.').slice(0, 2).join('.')}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-40">
                        {getDayOfWeek(term.date, t)}
                    </span>
                </div>

                {/* Status Icon */}
                {term.attemptType && (
                    <div className="flex items-center shrink-0">
                        {term.attemptType === 'regular' ? (
                            <CircleCheck size={16} className="text-success/70" />
                        ) : (
                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20">
                                <RotateCcw size={10} className="text-warning" />
                                <span className="text-[10px] font-black text-warning">
                                    {term.attemptType === 'retake1' ? '1' : term.attemptType === 'retake2' ? '2' : '3'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Time & Room: Typographic Priority */}
                <div className="flex flex-col min-w-[60px] ml-1">
                    <span className={`text-base font-bold ${disabled ? 'opacity-40' : 'opacity-90'}`}>
                        {term.time}
                    </span>
                    {term.room && (
                        <span className="text-[11px] truncate opacity-50 font-medium">
                            {(language === 'en' && term.roomEn) ? term.roomEn : (term.roomCs || term.room)}
                        </span>
                    )}
                </div>

                {/* Action Section: Stabilized & Context-Aware */}
                <div className="ml-auto flex items-center justify-end gap-3">
                    {isFuture ? (
                        <div className="flex items-center gap-3">
                            <div className={`flex flex-col items-end px-3 py-1.5 rounded-md border transition-colors ${isWithinSniperWindow ? 'bg-warning/10 border-warning/30' : 'bg-base-200/50 border-transparent'}`}>
                                <span className={`text-[10px] font-bold ${isWithinSniperWindow ? 'text-warning' : 'opacity-40'} uppercase tracking-wider`}>
                                    {t('exams.opening')} {formatCountdown(msRemaining)}
                                </span>
                                <span className={`text-[10px] font-mono ${isWithinSniperWindow ? 'text-warning/70' : 'opacity-30'}`}>
                                    {term.registrationStart}
                                </span>
                            </div>
                            
                            {onToggleArm && section && isWithinSniperWindow && (
                                <div className="w-[100px] flex justify-end">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleArm(); }}
                                        className={`btn btn-xs h-8 ${isArmed ? 'btn-warning shadow-lg shadow-warning/20' : 'btn-outline border-warning/30 hover:bg-warning hover:border-warning'} ${isFiring ? 'animate-pulse' : ''} gap-1.5 px-3`}
                                    >
                                        <Zap size={12} className={isArmed ? 'fill-current' : ''} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {isFiring ? t('exams.autoRegFiring') : isArmed ? t('exams.autoRegArmed') : t('exams.autoRegArm')}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        term.capacity && (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                        <progress 
                                            className={`progress w-12 h-1 ${disabled ? 'progress-error' : 'progress-primary'} opacity-60`} 
                                            value={Math.min(100, (term.capacity.occupied / term.capacity.total) * 100)} 
                                            max="100" 
                                        />
                                        <span className={`text-[11px] font-bold ${isFull ? 'text-error' : 'opacity-60'}`}>
                                            {isFull ? t('exams.full') : (isClosed || isBlocked) ? t('exams.closed') : term.capacity.raw}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-[100px] flex justify-end">
                                    {isProcessing ? (
                                        <span className="loading loading-spinner loading-sm text-primary"></span>
                                    ) : (isFull || isClosed || isBlocked) ? (
                                        <span className="text-error/40 text-lg font-bold">✕</span>
                                    ) : (
                                        <span className="btn btn-primary btn-sm px-4 font-bold">{t('exams.register')}</span>
                                    )}
                                </div>
                            </div>
                        )
                    )}
                </div>

            </div>

            {/* Constraints: Clearer and More Reliable */}
            {term.registrationEnd && (
                <div className="flex items-center gap-4 px-4 pb-3 text-[10px] font-medium border-t border-base-content/5 mt-[-2px] pt-2">
                    {sameDeadline ? (
                        <span className="opacity-50 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-base-content/30" />
                            {t('exams.registerAndUnregisterDeadline')} <b className="opacity-100">{term.registrationEnd}</b>
                        </span>
                    ) : (
                        <>
                            <span className="opacity-50 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-base-content/30" />
                                {t('exams.registerDeadline')} <b className="opacity-100">{term.registrationEnd}</b>
                            </span>
                            {term.deregistrationDeadline && (
                                <span className="opacity-50 flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-base-content/30" />
                                    {t('exams.unregisterDeadline')} <b className="opacity-100">{term.deregistrationDeadline}</b>
                                </span>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
