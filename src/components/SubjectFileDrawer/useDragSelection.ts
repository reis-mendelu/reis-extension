import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSelectionProcessor } from './useDragSelection/useSelectionProcessor';
import { useAutoScroll } from './useDragSelection/useAutoScroll';

export function useDragSelection({ isOpen, containerRef, contentRef, fileRefs }: any) {
    const [ids, setIds] = useState<string[]>([]), [dragging, setDragging] = useState(false);
    const [start, setStart] = useState<{ x: number, y: number } | null>(null), [end, setEnd] = useState<{ x: number, y: number } | null>(null);
    const draggingRef = useRef(false), startRef = useRef<{ x: number, y: number } | null>(null), initialIds = useRef<string[]>([]), ignoreRef = useRef(false);

    const process = useSelectionProcessor(startRef, containerRef, contentRef, fileRefs, initialIds, setIds, setEnd);
    const auto = useAutoScroll(containerRef, process);

    useEffect(() => { if (!isOpen) queueMicrotask(() => { setIds([]); setStart(null); setEnd(null); draggingRef.current = false; }); }, [isOpen]);

    const onMove = useCallback((e: MouseEvent) => {
        auto.handle(e.clientX, e.clientY);
        if (!draggingRef.current && startRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const dx = (e.clientX - rect.left + containerRef.current.scrollLeft) - startRef.current.x;
            const dy = (e.clientY - rect.top + containerRef.current.scrollTop) - startRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) { draggingRef.current = true; setDragging(true); }
        }
        if (draggingRef.current) process(e.clientX, e.clientY);
    }, [containerRef, auto, process]);

    const onUp = useCallback(() => {
        auto.clear(); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
        if (draggingRef.current) { ignoreRef.current = true; setTimeout(() => ignoreRef.current = false, 100); setDragging(false); draggingRef.current = false; }
        setStart(null); setEnd(null); startRef.current = null;
    }, [auto, onMove]);

    if (start && isOpen) { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }

    return { selectedIds: ids, isDragging: dragging, ignoreClickRef: ignoreRef, setSelectedIds: setIds, clearSelection: () => setIds([]),
        selectionBoxStyle: useMemo(() => (!start || !end) ? null : { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }, [start, end]),
        handleMouseDown: (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest('.interactive') || e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
            if (!containerRef.current) return;
            const r = containerRef.current.getBoundingClientRect();
            const x = e.clientX - r.left + containerRef.current.scrollLeft, y = e.clientY - r.top + containerRef.current.scrollTop;
            setStart({ x, y }); setEnd({ x, y }); startRef.current = { x, y };
            initialIds.current = (e.ctrlKey || e.shiftKey || e.metaKey) ? ids : [];
            if (!e.ctrlKey && !e.shiftKey && !e.metaKey) setIds([]);
        },
        toggleSelect: (id: string, e: React.MouseEvent) => { e.stopPropagation(); setIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
    };
}
