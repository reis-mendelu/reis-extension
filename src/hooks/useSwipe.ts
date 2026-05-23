import { useEffect, type RefObject } from 'react';

const MIN_DISTANCE_PX = 50;
const MAX_ANGLE_DEG = 30;

interface SwipeOptions {
    onLeft?: () => void;
    onRight?: () => void;
}

/**
 * Horizontal swipe detector using Pointer Events. Single consumer at introduction
 * (WeeklyCalendar week navigation). Cancels on scroll inside the target element.
 */
export function useSwipe(
    ref: RefObject<HTMLElement | null>,
    { onLeft, onRight }: SwipeOptions,
) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let startX = 0;
        let startY = 0;
        let tracking = false;
        let cancelled = false;

        const onDown = (e: Event) => {
            const pe = e as PointerEvent;
            tracking = true;
            cancelled = false;
            startX = pe.clientX;
            startY = pe.clientY;
        };
        const onScroll = () => { cancelled = true; };
        const onUp = (e: Event) => {
            if (!tracking) return;
            tracking = false;
            if (cancelled) return;
            const pe = e as PointerEvent;
            const dx = pe.clientX - startX;
            const dy = pe.clientY - startY;
            const dist = Math.hypot(dx, dy);
            if (dist < MIN_DISTANCE_PX) return;
            const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
            const offHorizontal = angle > 90 ? 180 - angle : angle;
            if (offHorizontal > MAX_ANGLE_DEG) return;
            if (dx < 0) onLeft?.();
            else onRight?.();
        };

        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('scroll', onScroll, { capture: true });
        return () => {
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('scroll', onScroll, { capture: true });
        };
    }, [ref, onLeft, onRight]);
}
