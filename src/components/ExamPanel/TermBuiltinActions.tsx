import { useState } from 'react';
import { toast } from 'sonner';
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
    const [firing, setFiring] = useState(false);

    if (!term.watchdogUrl && !term.blockReasonUrl) return null;

    const armed = !!term.watchdogUrl?.includes('aktivace=2');

    const handleWatchdog = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!term.watchdogUrl || firing) return;
        setFiring(true);
        const result = await triggerWatchdog(term.watchdogUrl);
        setFiring(false);
        if (result.success) {
            toast.success(armed ? t('exams.watchdogDeactivated') : t('exams.watchdogActivated'));
            triggerExamsRefresh();
        } else {
            toast.error(result.error || t('exams.watchdogFailed'));
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
