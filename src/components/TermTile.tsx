import { RotateCcw, Zap, CircleCheck, AlertCircle } from 'lucide-react';
import type { ExamTerm, ExamSection } from '../types/exams';
import { getDayOfWeek, parseRegistrationStart, formatCountdown } from '../utils/termUtils';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/useAppStore';
import { SNIPER_WINDOW_MS } from './ExamPanel/useAutoRegistration';

const attemptAccentClass: Record<string, string> = {
    regular: 'bg-success/50',
    retake1: 'bg-warning/50',
    retake2: 'bg-error/50',
    retake3: 'bg-error/50',
};

function attemptPillClass(type: string) {
    if (type === 'regular') return 'bg-success/10';
    if (type === 'retake1') return 'bg-warning/10';
    return 'bg-error/10';
}
function attemptIconClass(type: string) {
    if (type === 'regular') return 'text-success';
    if (type === 'retake1') return 'text-warning';
    return 'text-error';
}

export function TermTile({ term, section, isArmed, isFiring, onToggleArm, onSelect, isProcessing = false }: { term: ExamTerm; section?: ExamSection; isArmed?: boolean; isFiring?: boolean; onToggleArm?: () => void; onSelect: () => void; isProcessing?: boolean }) {
    const { t, language } = useTranslation();
    const now = useAppStore(s => s.now);
    const regStart = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
    const regEnd = term.registrationEnd ? parseRegistrationStart(term.registrationEnd) : null;
    const msRemaining = regStart ? regStart.getTime() - now.getTime() : 0;
    const isFuture = !!(regStart && regStart > now), isClosed = !!(regEnd && regEnd < now), isFull = term.full || (term.capacity && term.capacity.occupied >= term.capacity.total);
    const isWithinSniperWindow = isFuture && msRemaining <= SNIPER_WINDOW_MS;
    const isIneligible = !!term.ineligible;
    const isBlocked = term.canRegisterNow === false && !isFuture && !isFull && !isIneligible;
    const disabled = isIneligible || isFull || isProcessing || isFuture || isClosed || isBlocked;
    const sameDeadline = term.registrationEnd && term.deregistrationDeadline && term.registrationEnd === term.deregistrationDeadline;
    const primaryAttempt = term.attemptTypes?.find(t => t !== 'regular') ?? term.attemptTypes?.[0];
    const attemptAccent = primaryAttempt ? attemptAccentClass[primaryAttempt] ?? '' : '';

    return (
        <div onClick={() => !disabled && onSelect()}
                className={`relative flex flex-col w-full rounded-lg border transition-all text-left overflow-hidden ${(isArmed || isFiring) ? 'bg-warning/10 border-warning shadow-[0_0_10px_rgba(251,189,35,0.3)]' : isIneligible ? 'bg-warning/[0.04] border-warning/20 opacity-75' : isFuture ? 'bg-warning/5 border-warning/30' : (isFull || isClosed || isBlocked) ? 'bg-base-200 border-transparent opacity-60' : 'bg-base-100 border-transparent hover:border-primary shadow-sm cursor-pointer'}`}>
            {attemptAccent && <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${attemptAccent}`} />}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 w-full p-2.5">
                {/* Date */}
                <div className="flex items-baseline gap-1.5 min-w-[58px]">
                    <span className={`text-sm font-bold tracking-tight ${isIneligible ? 'text-base-content/40' : disabled ? 'text-base-content/30 line-through' : 'text-base-content'}`}>
                        {term.date.split('.').slice(0, 2).join('.')}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider opacity-25">
                        {getDayOfWeek(term.date, t)}
                    </span>
                </div>

                {/* Attempt type pills — one per type; regular shows icon only */}
                {term.attemptTypes && term.attemptTypes.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                        {term.attemptTypes.map(type => (
                            <div key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${attemptPillClass(type)}`} title={t(`successRate.${type}`)}>
                                {type === 'regular'
                                    ? <CircleCheck size={10} className={attemptIconClass(type)} />
                                    : <><RotateCcw size={10} className={attemptIconClass(type)} /><span className={`text-[9px] font-bold leading-none ${attemptIconClass(type)}`}>{type === 'retake1' ? '1' : type === 'retake2' ? '2' : '3'}</span></>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Time & Room */}
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-bold ${disabled ? 'opacity-30' : 'opacity-90'}`}>
                        {term.time}
                    </span>
                    {term.room && (
                        <span className="text-[10px] truncate opacity-25">
                            {(language === 'en' && term.roomEn) ? term.roomEn : (term.roomCs || term.room)}
                        </span>
                    )}
                </div>

                {/* Action Section: Stabilized & Context-Aware */}
                <div className="ml-auto flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
                    {isFuture ? (
                        <div className="flex items-center gap-2 sm:gap-3 justify-end flex-wrap">
                            <div className={`flex flex-col items-end transition-colors ${isWithinSniperWindow ? 'text-warning' : 'text-base-content/30'}`}>
                                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                    {t('exams.opening')} {formatCountdown(msRemaining)}
                                </span>
                                <span className="text-[10px] font-mono opacity-60">
                                    {term.registrationStart}
                                </span>
                            </div>
                            
                            {onToggleArm && section && isWithinSniperWindow && (
                                <div className="flex justify-end min-w-[100px]">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleArm(); }}
                                        className={`btn btn-xs h-8 ${isArmed ? 'btn-warning shadow-lg shadow-warning/20' : 'btn-outline border-warning/30 hover:bg-warning hover:border-warning'} ${isFiring ? 'animate-pulse' : ''} gap-1.5 px-3 whitespace-nowrap`}
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
                        <div className="flex items-center gap-3">
                            {isProcessing ? (
                                <span className="loading loading-spinner loading-sm text-primary" />
                            ) : isIneligible ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-warning/70 uppercase tracking-wider bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    <AlertCircle size={10} strokeWidth={2.5} />
                                    {t('exams.ineligible')}
                                </span>
                            ) : (isClosed || isBlocked) ? (
                                <span className="text-[10px] font-bold opacity-30 uppercase tracking-wider">{t('exams.closed')}</span>
                            ) : term.capacity ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <progress
                                            className={`progress w-12 h-1 ${isFull ? 'progress-error' : 'progress-primary'} opacity-60`}
                                            value={Math.min(100, (term.capacity.occupied / term.capacity.total) * 100)}
                                            max="100"
                                        />
                                        <span className={`text-[11px] font-bold ${isFull ? 'text-error/60' : 'opacity-60'}`}>
                                            {isFull ? t('exams.full') : term.capacity.raw}
                                        </span>
                                    </div>
                                    {!isFull && (
                                        <span className="btn btn-primary btn-sm px-4 font-bold">{t('exams.register')}</span>
                                    )}
                                </>
                            ) : null}
                        </div>
                    )}
                </div>

            </div>

            {/* Deadlines */}
            {term.registrationEnd && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pb-2 text-[10px] font-medium border-t border-base-content/5 pt-1.5">
                    {sameDeadline ? (
                        <span className="text-base-content/40">{t('exams.registerAndUnregisterDeadline')} <b className="text-base-content/60">{term.registrationEnd}</b></span>
                    ) : (
                        <>
                            <span className="text-base-content/40">{t('exams.registerDeadline')} <b className="text-base-content/60">{term.registrationEnd}</b></span>
                            {term.deregistrationDeadline && (
                                <span className="text-base-content/40">{t('exams.unregisterDeadline')} <b className="text-base-content/60">{term.deregistrationDeadline}</b></span>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
