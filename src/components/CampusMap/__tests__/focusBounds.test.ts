import { describe, it, expect } from 'vitest';
import { roomFocusView } from '../focusBounds';

/**
 * "Clicking 'show on the map' should open the room in a much higher view
 * (above the entire building)."
 *
 * It fitted the ROOM's own polygon at maxZoom 21 — a few metres of floor
 * filling the screen, with nothing to say which building it was in or which
 * side of it you were looking at, which for a student walking to an office is
 * the only thing that matters.
 */
describe('roomFocusView', () => {
  const room = { id: 'room' };
  const building = { id: 'building' };

  it('frames the building, not the room', () => {
    expect(roomFocusView(room, building)?.bounds).toBe(building);
  });

  it('stays high enough to keep the building in frame', () => {
    // The old value was 21, which is where the "on top of one room" view came
    // from. maxZoom is a ceiling, so Leaflet still zooms out further when the
    // building needs it.
    expect(roomFocusView(room, building)?.maxZoom).toBeLessThan(21);
  });

  it('pads the building so it does not touch the viewport edge', () => {
    // A building bleeding off the edge reads as "cut off" rather than "all of it".
    const [x, y] = roomFocusView(room, building)!.padding;
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it('falls back to the room when its building has no footprint', () => {
    // Better a close view than none — some buildings have no polygon in the data.
    const view = roomFocusView(room, null);
    expect(view?.bounds).toBe(room);
    expect(view?.maxZoom).toBe(21);
  });

  it('asks for nothing when there is nothing to frame', () => {
    expect(roomFocusView(null, null)).toBeNull();
  });
});
