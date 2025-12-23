export interface Position {
    x: number;
    y: number;
}

export interface SelectionBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

/**
 * Calculate the selection box coordinates relative to the container.
 * Clamps coordinates to the content boundaries.
 */
export function calculateSelectionBox(
    start: Position,
    currentX: number,
    currentY: number,
    contentWidth: number,
    contentHeight: number
): { end: Position; box: SelectionBox } {
    const clampedX = clamp(currentX, 0, contentWidth);
    const clampedY = clamp(currentY, 0, contentHeight);

    const box = {
        left: Math.min(start.x, clampedX),
        top: Math.min(start.y, clampedY),
        right: Math.max(start.x, clampedX),
        bottom: Math.max(start.y, clampedY)
    };

    return {
        end: { x: clampedX, y: clampedY },
        box
    };
}

/**
 * Check if two rectangles intersect.
 */
export function isIntersecting(
    box: SelectionBox,
    node: HTMLElement
): boolean {
    const nodeLeft = node.offsetLeft;
    const nodeTop = node.offsetTop;
    const nodeRight = nodeLeft + node.offsetWidth;
    const nodeBottom = nodeTop + node.offsetHeight;

    return !(
        box.left > nodeRight ||
        box.right < nodeLeft ||
        box.top > nodeBottom ||
        box.bottom < nodeTop
    );
}

/**
 * Find all items that intersect with the selection box.
 */
export function findIntersectingItems(
    box: SelectionBox,
    itemRefs: Map<string, HTMLElement>,
    initialSelectedIds: Set<string>
): string[] {
    const newSelectedIds = new Set(initialSelectedIds);
    
    itemRefs.forEach((node, itemId) => {
        if (node && isIntersecting(box, node)) {
            newSelectedIds.add(itemId);
        }
    });

    return Array.from(newSelectedIds);
}
