import { useRef, useCallback } from 'react';
import type { Position } from './types';

export function useAutoScroll(
    containerRef: React.RefObject<HTMLDivElement | null>,
    scrollThreshold: number,
    scrollSpeed: number,
    scrollDelay: number,
    lastMousePos: React.MutableRefObject<Position | null>,
    processSelection: (x: number, y: number) => void
) {
    const interval = useRef<NodeJS.Timeout | null>(null);
    const delay = useRef<NodeJS.Timeout | null>(null);

    const clear = useCallback(() => {
        if (interval.current) { clearInterval(interval.current); interval.current = null; }
        if (delay.current) { clearTimeout(delay.current); delay.current = null; }
    }, []);

    const handle = useCallback((clientX: number, clientY: number, isDragging: boolean) => {
        if (!containerRef.current || !isDragging) return;
        const { top, bottom } = containerRef.current.getBoundingClientRect();
        const startScroll = (dir: number) => {
            if (!interval.current && !delay.current) {
                delay.current = setTimeout(() => {
                    delay.current = null;
                    interval.current = setInterval(() => {
                        const c = containerRef.current;
                        if (!c) return;
                        if (dir === -1 && c.scrollTop > 0) { c.scrollTop -= scrollSpeed; if (lastMousePos.current) processSelection(lastMousePos.current.x, lastMousePos.current.y); }
                        else if (dir === 1 && c.scrollTop < c.scrollHeight - c.clientHeight) { c.scrollTop += scrollSpeed; if (lastMousePos.current) processSelection(lastMousePos.current.x, lastMousePos.current.y); }
                        else clear();
                    }, 16);
                }, scrollDelay);
            }
        };

        if (clientY < top + scrollThreshold) startScroll(-1);
        else if (clientY > bottom - scrollThreshold) startScroll(1);
        else clear();
    }, [containerRef, scrollThreshold, scrollSpeed, scrollDelay, processSelection, lastMousePos, clear]);

    return { handle, clear };
}
