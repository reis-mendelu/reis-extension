import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';

export const HOVER_INTENT_MS = 100;

/**
 * Returns mouseenter/mouseleave handlers that fire a speculative file refresh
 * after HOVER_INTENT_MS of continuous hover. Cancels if cursor leaves first,
 * so flicker-scrolling does not trigger fetches.
 */
export function useSpeculativeHover(courseCode: string, enabled: boolean) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const onMouseEnter = () => {
        if (!enabled || !courseCode) return;
        timerRef.current = setTimeout(() => {
            useAppStore.getState().speculativeRefreshFiles(courseCode);
        }, HOVER_INTENT_MS);
    };

    const onMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    return { onMouseEnter, onMouseLeave };
}
