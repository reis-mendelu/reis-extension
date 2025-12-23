import { useRef, useCallback, useEffect } from 'react';


interface UseAutoScrollProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    isDragging: boolean;
    scrollThreshold?: number;
    scrollSpeed?: number;
    scrollDelay?: number;
    onScroll?: () => void;
}

export function useAutoScroll({
    containerRef,
    isDragging,
    scrollThreshold = 50,
    scrollSpeed = 10,
    scrollDelay = 300,
    onScroll
}: UseAutoScrollProps) {
    const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);
    const autoScrollDelayTimeout = useRef<NodeJS.Timeout | null>(null);

    const clearAutoScroll = useCallback(() => {
        if (autoScrollInterval.current) {
            clearInterval(autoScrollInterval.current);
            autoScrollInterval.current = null;
        }
        if (autoScrollDelayTimeout.current) {
            clearTimeout(autoScrollDelayTimeout.current);
            autoScrollDelayTimeout.current = null;
        }
    }, []);

    const processAutoScroll = useCallback((mouseY: number) => {
        if (!containerRef.current || !isDragging) {
            clearAutoScroll();
            return;
        }

        const { top, bottom } = containerRef.current.getBoundingClientRect();

        const shouldScrollUp = mouseY < top + scrollThreshold;
        const shouldScrollDown = mouseY > bottom - scrollThreshold;

        if (!shouldScrollUp && !shouldScrollDown) {
            clearAutoScroll();
            return;
        }

        // Return if scroll already active for this direction
        if (autoScrollInterval.current || autoScrollDelayTimeout.current) {
             // We could check direction here to allow switching direction without delay,
             // but simple "don't restart if running" is usually sufficient and simpler.
             return; 
        }

        autoScrollDelayTimeout.current = setTimeout(() => {
            autoScrollDelayTimeout.current = null;
            autoScrollInterval.current = setInterval(() => {
                if (!containerRef.current) {
                     clearAutoScroll();
                     return;
                }
                
                let scrolled = false;
                if (shouldScrollUp && containerRef.current.scrollTop > 0) {
                    containerRef.current.scrollTop -= scrollSpeed;
                    scrolled = true;
                } else if (shouldScrollDown) {
                    const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
                    if (containerRef.current.scrollTop < maxScroll - 1) {
                         containerRef.current.scrollTop += scrollSpeed;
                         scrolled = true;
                    }
                }

                if (scrolled) {
                     onScroll?.();
                } else {
                     clearAutoScroll();
                }
            }, 16);
        }, scrollDelay);
        
    }, [containerRef, isDragging, scrollThreshold, scrollSpeed, scrollDelay, clearAutoScroll, onScroll]);

    // Cleanup on unmount or when drag stops
    useEffect(() => {
        if (!isDragging) {
            clearAutoScroll();
        }
        return () => clearAutoScroll();
    }, [isDragging, clearAutoScroll]);

    return {
        processAutoScroll,
        clearAutoScroll
    };
}
