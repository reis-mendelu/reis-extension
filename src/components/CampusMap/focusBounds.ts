/** A rectangle to fit, plus how close the camera may get to it. */
export interface FocusView<B> {
  bounds: B;
  maxZoom: number;
  padding: [number, number];
}

/**
 * How close to sit when a single room has been selected.
 *
 * "Clicking 'show on the map' should open the room in a much higher view (above
 * the entire building)." It used to fit the ROOM's own polygon at `maxZoom: 21`
 * — a few metres of floor filling the screen, with no way to tell which
 * building it was in or which side of it you were looking at. For a student
 * walking to an office that is the one thing they need.
 *
 * So the building is what gets framed, and the room stays highlighted inside
 * it. `maxZoom` still applies: it is a CEILING, so a small building is not
 * pushed absurdly close, and Leaflet picks whatever is needed to fit the box.
 *
 * The room's own bounds remain the fallback for a room whose building has no
 * footprint in the data — better a close view than none.
 */
export function roomFocusView<B>(
  roomBounds: B | null,
  buildingBounds: B | null
): FocusView<B> | null {
  if (buildingBounds)
    // Generous padding: the point is context, and a building that touches the
    // viewport edge reads as "cut off" rather than "all of it".
    return { bounds: buildingBounds, maxZoom: 19, padding: [60, 60] };
  if (roomBounds) return { bounds: roomBounds, maxZoom: 21, padding: [120, 120] };
  return null;
}
