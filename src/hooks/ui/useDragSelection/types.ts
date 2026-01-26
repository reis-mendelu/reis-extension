export interface Position { x: number; y: number; }

export interface UseDragSelectionOptions {
    onItemClick?: (itemId: string) => void;
    dragThreshold?: number;
    scrollSpeed?: number;
    scrollThreshold?: number;
    scrollDelay?: number;
}
