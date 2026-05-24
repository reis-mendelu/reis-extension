/**
 * Given the set of currently-intersecting page indices, returns the set of
 * indices whose <Page> should be mounted: each visible page plus `buffer`
 * neighbours on either side, clamped to [0, numPages).
 *
 * pdf.js advises against mounting more than ~25 page canvases at once; on
 * memory-constrained mobile browsers (notably Firefox Android) mounting every
 * page blanks or crashes the canvas. Windowing keeps the live canvas count
 * bounded regardless of document length. Before any page has intersected
 * (initial mount), falls back to the window around page 0 so something renders.
 */
export function computeRenderWindow(
    visible: Set<number>,
    numPages: number,
    buffer: number,
): Set<number> {
    const anchors = visible.size > 0 ? visible : new Set([0]);
    const window = new Set<number>();
    for (const idx of anchors) {
        for (let i = idx - buffer; i <= idx + buffer; i++) {
            if (i >= 0 && i < numPages) window.add(i);
        }
    }
    return window;
}
