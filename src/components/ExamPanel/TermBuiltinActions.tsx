import { useState, useEffect } from 'react';
import { Bell, BellRing, Info, ExternalLink } from 'lucide-react';
import type { ExamTerm } from '../../types/exams';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { triggerWatchdog } from '../../api/exams';

/**
 * Action row for IS Mendelu's built-in term actions (watchdog + "why blocked?").
 * Armed state is derived from the URL itself: IS Mendelu emits `aktivace=1`
 * when the watchdog is off (click to arm) and `aktivace=2` when it's on
 * (click to disarm). The same URL the parser captured is the one we GET.
 */
export function TermBuiltinActions({ term }: { term: ExamTerm }) {
    const { t } = useTranslation();
    const triggerExamsRefresh = useAppStore(s => s.triggerExamsRefresh);
    // Optimistic override: flips the UI instantly on click. Held until the next
    // exam-refresh re-parses the URL (aktivace=1 ↔ aktivace=2) and urlArmed agrees.
    const [optimisticArmed, setOptimisticArmed] = useState<boolean | null>(null);
    const [firing, setFiring] = useState(false);
    
    // Custom inline micro-toast state
    const [activeFeedback, setActiveFeedback] = useState<'activated' | 'deactivated' | 'failed' | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const urlArmed = !!term.watchdogUrl?.includes('aktivace=2');
    const armed = optimisticArmed ?? urlArmed;

    // Once the parsed URL catches up to the optimistic value, drop the override
    // so the URL is authoritative again for any future external state changes.
    useEffect(() => {
        if (optimisticArmed !== null && urlArmed === optimisticArmed) {
            setOptimisticArmed(null);
        }
    }, [urlArmed, optimisticArmed]);

    // Automatically hide contextual micro-toast after timeout
    useEffect(() => {
        if (activeFeedback) {
            const timer = setTimeout(() => {
                setActiveFeedback(null);
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [activeFeedback]);

    if (!term.watchdogUrl && !term.blockReasonUrl) return null;

    const handleWatchdog = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!term.watchdogUrl || firing) return;
        const next = !armed;
        setOptimisticArmed(next);
        setFiring(true);
        const result = await triggerWatchdog(term.watchdogUrl);
        setFiring(false);
        if (result.success) {
            setActiveFeedback(next ? 'activated' : 'deactivated');
            triggerExamsRefresh();
        } else {
            setOptimisticArmed(null);
            setErrorMessage(result.error || null);
            setActiveFeedback('failed');
        }
    };

    return (
        <>
            {term.blockReasonUrl && (
                <a
                    href={term.blockReasonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    aria-label={t('exams.whyBlockedAriaLabel')}
                    className="link link-hover text-[10px] text-base-content/55 italic inline-flex items-center gap-0.5"
                >
                    <Info size={10} />
                    <span>{t('exams.whyBlocked')}</span>
                </a>
            )}
            {term.watchdogUrl && (
                <div className="relative inline-block">
                    <button
                        onClick={handleWatchdog}
                        disabled={firing}
                        aria-label={armed ? t('exams.unwatchAriaLabel') : t('exams.watchAriaLabel')}
                        title={armed ? t('exams.unwatchAriaLabel') : t('exams.watchAriaLabel')}
                        className={`btn btn-outline btn-xs h-7 gap-1 px-2 transition-colors ${
                            armed
                                ? 'border-success/40 text-success hover:bg-success/10 hover:border-success'
                                : 'border-warning/40 text-warning hover:bg-warning/10 hover:border-warning'
                        } ${firing ? 'opacity-60' : ''}`}
                    >
                        {armed ? <BellRing size={11} /> : <Bell size={11} />}
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {armed ? t('exams.watching') : t('exams.watch')}
                        </span>
                    </button>
                    {activeFeedback && (
                        <>
                            <style>{`
                                @keyframes toastFadeIn {
                                    from { opacity: 0; transform: translate(-50%, 4px) scale(0.95); }
                                    to { opacity: 1; transform: translate(-50%, 0) scale(1); }
                                }
                            `}</style>
                            <div
                                style={{ animation: 'toastFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none w-48 p-2.5 rounded-lg shadow-xl text-center text-[10px] font-bold leading-normal border ${
                                    activeFeedback === 'failed'
                                        ? 'bg-error text-error-content border-error/20'
                                        : activeFeedback === 'activated'
                                        ? 'bg-success text-success-content border-success/20'
                                        : 'bg-warning text-warning-content border-warning/20'
                                }`}
                            >
                                {activeFeedback === 'activated' && t('exams.watchdogActivated')}
                                {activeFeedback === 'deactivated' && t('exams.watchdogDeactivated')}
                                {activeFeedback === 'failed' && (errorMessage || t('exams.watchdogFailed'))}

                                {/* Caret / Tooltip Arrow */}
                                <div className={`absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] w-2.5 h-2.5 rotate-45 border-r border-b ${
                                    activeFeedback === 'failed'
                                        ? 'bg-error border-error/20'
                                        : activeFeedback === 'activated'
                                        ? 'bg-success border-success/20'
                                        : 'bg-warning border-warning/20'
                                }`} />
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

/**
 * Small "Open in IS" link rendered in the tile footer.
 * Separate from TermBuiltinActions so it can sit alongside deadlines.
 */
export function TermDetailLink({ term }: { term: ExamTerm }) {
    const { t } = useTranslation();
    if (!term.detailUrl) return null;
    return (
        <a
            href={term.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            aria-label={t('exams.openInIs')}
            className="ml-auto link link-hover text-base-content/40 hover:text-primary inline-flex items-center gap-0.5"
        >
            <span>{t('exams.openInIs')}</span>
            <ExternalLink size={10} />
        </a>
    );
}
