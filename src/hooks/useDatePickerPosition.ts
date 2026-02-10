import { useState, useEffect } from 'react';

export function useDatePickerPosition(isOpen: boolean, anchorRef: React.RefObject<HTMLElement | null>) {
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isOpen && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const w = 260, h = 420, p = 12;
            const left = Math.max(p, Math.min(rect.left, window.innerWidth - w - p));
            let top = rect.bottom + 4;
            if (top + h > window.innerHeight - p) {
                top = Math.max(p, rect.top - h - 4);
            }
            queueMicrotask(() => setPosition({ top, left }));
        }
    }, [isOpen, anchorRef]);

    return position;
}
