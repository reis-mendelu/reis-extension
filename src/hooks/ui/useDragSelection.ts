import { useRef, useState, useCallback, useEffect } from 'react';
import type { Position, UseDragSelectionOptions } from './useDragSelection/types';
import { useSelectionProcessor } from './useDragSelection/useSelectionProcessor';
import { useAutoScroll } from './useDragSelection/useAutoScroll';

export function useDragSelection(options: UseDragSelectionOptions = {}) {
    const { onItemClick, dragThreshold = 5, scrollSpeed = 10, scrollThreshold = 50, scrollDelay = 300 } = options;
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<Position | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<Position | null>(null);
    const containerRef = useRef<HTMLDivElement>(null), contentRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map()), isDraggingRef = useRef(false);
    const selectionStartRef = useRef<Position | null>(null), initialSelectedIds = useRef<string[]>([]);
    const lastMousePos = useRef<Position | null>(null), ignoreClickRef = useRef(false);

    const process = useSelectionProcessor(selectionStartRef, containerRef, contentRef, itemRefs, initialSelectedIds, setSelectedIds, setSelectionEnd);
    const autoScroll = useAutoScroll(containerRef, scrollThreshold, scrollSpeed, scrollDelay, lastMousePos, process);

    const onMouseMove = useCallback((e: MouseEvent) => {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        autoScroll.handle(e.clientX, e.clientY, isDraggingRef.current);
        if (!isDraggingRef.current && selectionStartRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const dx = (e.clientX - rect.left + containerRef.current.scrollLeft) - selectionStartRef.current.x;
            const dy = (e.clientY - rect.top + containerRef.current.scrollTop) - selectionStartRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) >= dragThreshold) { isDraggingRef.current = true; setIsDragging(true); }
        }
        if (isDraggingRef.current) process(e.clientX, e.clientY);
    }, [dragThreshold, autoScroll, process]);

    const onMouseUp = useCallback(() => {
        autoScroll.clear();
        if (isDraggingRef.current) { ignoreClickRef.current = true; setTimeout(() => ignoreClickRef.current = false, 100); setIsDragging(false); isDraggingRef.current = false; }
        setSelectionStart(null); setSelectionEnd(null); selectionStartRef.current = null;
    }, [autoScroll]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, [data-no-drag]')) return;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + containerRef.current.scrollLeft, y = e.clientY - rect.top + containerRef.current.scrollTop;
        selectionStartRef.current = { x, y }; setSelectionStart({ x, y }); initialSelectedIds.current = [...selectedIds];
    }, [selectedIds]);

    useEffect(() => {
        if (selectionStart) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            return () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
        }
    }, [selectionStart, onMouseMove, onMouseUp]);

    return { selectedIds, setSelectedIds, isDragging, selectionStart, selectionEnd, containerRef, contentRef, itemRefs, handleMouseDown, ignoreClickRef,
             handleBackdropClick: (e: React.MouseEvent, cb: () => void) => !ignoreClickRef.current && e.target === e.currentTarget && cb(),
             toggleSelection: (id: string) => onItemClick ? onItemClick(id) : setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]),
             handleSelectAll: (ids: string[]) => setSelectedIds(p => ids.every(x => p.includes(x)) ? p.filter(x => !ids.includes(x)) : [...new Set([...p, ...ids])]),
             clearSelection: () => setSelectedIds([]) };
}
