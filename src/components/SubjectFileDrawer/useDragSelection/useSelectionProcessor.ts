import { useCallback } from 'react';

export function useSelectionProcessor(
    selectionStartRef: React.MutableRefObject<{ x: number, y: number } | null>,
    containerRef: React.RefObject<HTMLDivElement | null>,
    contentRef: React.RefObject<HTMLDivElement | null>,
    fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
    initialSelectedIds: React.MutableRefObject<string[]>,
    setSelectedIds: (ids: string[]) => void,
    setSelectionEnd: (pos: { x: number, y: number } | null) => void
) {
    return useCallback((clientX: number, clientY: number) => {
        if (!selectionStartRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left + containerRef.current.scrollLeft;
        const y = clientY - rect.top + containerRef.current.scrollTop;
        const cw = contentRef.current?.scrollWidth ?? containerRef.current.scrollWidth;
        const ch = contentRef.current?.scrollHeight ?? containerRef.current.scrollHeight;
        const cx = Math.max(0, Math.min(x, cw)), cy = Math.max(0, Math.min(y, ch));
        setSelectionEnd({ x: cx, y: cy });
        const bl = Math.min(selectionStartRef.current.x, cx), bt = Math.min(selectionStartRef.current.y, cy);
        const br = Math.max(selectionStartRef.current.x, cx), bb = Math.max(selectionStartRef.current.y, cy);
        const next = new Set(initialSelectedIds.current);
        fileRefs.current.forEach((node, id) => {
            if (node) {
                const nl = node.offsetLeft, nt = node.offsetTop;
                const nr = nl + node.offsetWidth, nb = nt + node.offsetHeight;
                if (!(bl > nr || br < nl || bt > nb || bb < nt)) next.add(id);
            }
        });
        setSelectedIds(Array.from(next));
    }, [containerRef, contentRef, fileRefs, initialSelectedIds, setSelectedIds, setSelectionEnd, selectionStartRef]);
}
