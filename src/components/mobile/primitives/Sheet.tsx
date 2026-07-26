import type { ReactNode } from 'react';

export interface SheetProps {
    /** `full` pins below the status area and scrolls; `content` hugs the bottom. */
    size: 'full' | 'content';
    onClose: () => void;
    children: ReactNode;
    /** Raises the sheet above other sheets (confirm dialogs). */
    elevated?: boolean;
}

/**
 * The one bottom-sheet container. Nine sheets share this exact behaviour:
 * backdrop fade, slide-up, tap-outside-to-close, and one of two heights.
 */
export function Sheet({ size, onClose, children, elevated }: SheetProps) {
    // Tailwind's default z-index scale stops at 50 — z-60/z-61 are not real
    // classes and would silently drop the sheet's stacking order. z-50 is
    // on-scale and stays as-is; anything above it (51, 60, 61) needs an
    // arbitrary value.
    const backdropZ = elevated ? 'z-[60]' : 'z-50';
    const panelZ = elevated ? 'z-[61]' : 'z-[51]';
    const panelPosition =
        size === 'full'
            ? 'top-[70px] bottom-0'
            : 'bottom-0 max-h-[85dvh]';

    return (
        <>
            <div
                data-testid="sheet-backdrop"
                onClick={onClose}
                className={`absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out] ${backdropZ}`}
            />
            <div
                data-testid="sheet-panel"
                className={`absolute inset-x-0 ${panelPosition} ${panelZ} flex flex-col overflow-hidden rounded-t-[20px] bg-base-100 shadow-drawer animate-[sheetUp_0.3s_ease-out]`}
            >
                {children}
            </div>
        </>
    );
}
