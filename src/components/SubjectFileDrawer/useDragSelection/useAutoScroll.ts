import { useRef, useCallback } from 'react';

export function useAutoScroll(containerRef: React.RefObject<HTMLDivElement | null>, processSelection: (x: number, y: number) => void) {
    const interval = useRef<NodeJS.Timeout | null>(null);
    const lastMouse = useRef<{ x: number, y: number } | null>(null);

    const clear = useCallback(() => {
        if (interval.current) { clearInterval(interval.current); interval.current = null; }
    }, []);

    const handle = useCallback((clientX: number, clientY: number) => {
        lastMouse.current = { x: clientX, y: clientY };
        if (!containerRef.current) return;
        const { top, bottom } = containerRef.current.getBoundingClientRect();
        const start = (dir: number) => {
            if (!interval.current) {
                interval.current = setInterval(() => {
                    if (containerRef.current) {
                        containerRef.current.scrollTop += (dir * 15);
                        if (lastMouse.current) processSelection(lastMouse.current.x, lastMouse.current.y);
                    }
                }, 16);
            }
        };
        if (clientY < top + 50) start(-1);
        else if (clientY > bottom - 50) start(1);
        else clear();
    }, [containerRef, processSelection, clear]);

    return { handle, clear };
}
