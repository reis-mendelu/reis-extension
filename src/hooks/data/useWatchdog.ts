import { useState, useEffect } from 'react';
import type { ExamTerm } from '../../types/exams';
import { useAppStore } from '../../store/useAppStore';
import { triggerWatchdog } from '../../api/exams';

export interface UseWatchdogResult {
    armed: boolean;
    firing: boolean;
    feedback: 'activated' | 'deactivated' | 'failed' | null;
    errorMessage: string | null;
    toggle: () => Promise<void>;
}

/**
 * Shared logic for IS Mendelu's built-in term "hlídací pes" (watchdog) toggle.
 * Armed state is derived from the URL itself: IS Mendelu emits `aktivace=1`
 * when the watchdog is off (click to arm) and `aktivace=2` when it's on
 * (click to disarm). The same URL the parser captured is the one we GET.
 *
 * Shared between desktop (`TermBuiltinActions`) and mobile so the cycle is
 * implemented once.
 */
export function useWatchdog(term: ExamTerm): UseWatchdogResult {
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

    const toggle = async () => {
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

    return { armed, firing, feedback: activeFeedback, errorMessage, toggle };
}
