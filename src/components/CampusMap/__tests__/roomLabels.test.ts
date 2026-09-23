import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { roomLabelsHidden } from '../roomLabels';

describe('roomLabelsHidden', () => {
  const building = L.latLngBounds([49.2091, 16.6136], [49.2101, 16.615]);
  /** Only the two methods the rule asks for. */
  const mapAt = (zoom: number, fitZoom: number) =>
    ({ getZoom: () => zoom, getBoundsZoom: () => fitZoom }) as unknown as L.Map;

  it('shows the room names once the building fills the screen', () => {
    expect(roomLabelsHidden(mapAt(18, 18), building)).toBe(false);
    expect(roomLabelsHidden(mapAt(19, 18), building)).toBe(false);
  });

  it('hides them when the plan is drawn smaller than that', () => {
    // The case that put them on screen: a route fits the whole walk, so the
    // camera zooms out to 16 with the floor plan still open, and fifteen room
    // names pile up over the building the walk ends at.
    expect(roomLabelsHidden(mapAt(16, 18), building)).toBe(true);
  });

  it('follows the viewport, not a fixed zoom', () => {
    // Same reasoning as the garden's bubbles: a small phone fits the building
    // at a lower zoom than a tablet does, and a hardcoded floor would hide
    // every label on the smaller screen.
    expect(roomLabelsHidden(mapAt(17, 17), building)).toBe(false);
  });

  it('shows them when there is no plan open to clutter anything', () => {
    expect(roomLabelsHidden(mapAt(16, 18), null)).toBe(false);
  });
});
