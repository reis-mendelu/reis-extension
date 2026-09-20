/**
 * How far sideways a map label has to move to stay on the map.
 *
 * Leaflet anchors a tooltip on its feature and does not care whether the result
 * is still inside the container, so a route whose midpoint sits near the edge
 * pushes its label off the screen. At 320 px, "4 min · Hlavní brána ↔ Brána
 * Lesnická" ended one pixel past the right edge — which is off the screen.
 *
 * Pure so the arithmetic is testable without a map: the caller measures, this
 * decides, the caller applies.
 *
 * @param left   the label's current left edge, relative to the container
 * @param width  the label's width
 * @param containerWidth the map's width
 * @param pad    how much clear space to keep at the edge
 * @returns pixels to move the label by; negative is left
 */
export function tooltipShift(left: number, width: number, containerWidth: number, pad = 4): number {
  const overRight = left + width - (containerWidth - pad);
  const overLeft = pad - left;
  // Wider than the map: no shift makes it fit, so pin the start of the text to
  // the left edge rather than centring the overflow on both sides.
  if (width > containerWidth - pad * 2) return overLeft;
  if (overRight > 0) return -overRight;
  if (overLeft > 0) return overLeft;
  return 0;
}
