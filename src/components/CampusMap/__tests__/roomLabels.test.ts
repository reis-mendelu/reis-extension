import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { roomLabelsHidden, READABLE_PLAN_PX } from '../roomLabels';
import { PLAN_FOCUS_MAX_ZOOM } from '../focusBounds';

describe('roomLabelsHidden', () => {
  const building = L.latLngBounds([49.2091, 16.6136], [49.2101, 16.615]);
  // Real footprints from buildings.json, so the pixel sizes are the ones the
  // map draws: Q is the biggest plan, E the smallest, M the densest.
  const Q = L.latLngBounds([49.209106, 16.613585], [49.210065, 16.614972]);
  const E = L.latLngBounds([49.210686, 16.618515], [49.211045, 16.619034]);
  const M = L.latLngBounds([49.209975, 16.613191], [49.210777, 16.614291]);
  /** The three methods the rule asks for; the projection is Leaflet's own. */
  const mapAt = (zoom: number, fitZoom: number) =>
    ({
      getZoom: () => zoom,
      getBoundsZoom: () => fitZoom,
      project: (ll: L.LatLngExpression, z: number) => L.CRS.EPSG3857.latLngToPoint(L.latLng(ll), z),
    }) as unknown as L.Map;

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

  describe('a window much bigger than the building', () => {
    // On a 1782x919 Mac window Q only "fills the screen" at zoom 20, so its
    // names appeared two levels after a phone shows them. At 18 Q is 274px
    // across: the very size a 390px phone opens it at, names and all.
    it('shows the names at the size a phone opens the plan at', () => {
      expect(roomLabelsHidden(mapAt(18, 20), Q)).toBe(false);
    });

    it('still hides them one level further out, where they pile up', () => {
      // 137px: 85% of Q's names overlap another one (measured, all floors).
      expect(roomLabelsHidden(mapAt(17, 20), Q)).toBe(true);
    });

    it('waits a level longer for a building too dense to read at that size', () => {
      // M at 18 is 229px and 61% of its names overlap; at 19 it is 3%.
      expect(roomLabelsHidden(mapAt(18, 20), M)).toBe(true);
      expect(roomLabelsHidden(mapAt(19, 20), M)).toBe(false);
    });

    it('shows a small building at the closest view a plan ever opens at', () => {
      // E never reaches READABLE_PLAN_PX at that zoom (204px), but a building
      // fit never opens closer than PLAN_FOCUS_MAX_ZOOM, so "smaller than the
      // view it opens at" cannot ask for more. None of E's names overlap there.
      expect(roomLabelsHidden(mapAt(PLAN_FOCUS_MAX_ZOOM, 21), E)).toBe(false);
      expect(roomLabelsHidden(mapAt(PLAN_FOCUS_MAX_ZOOM - 1, 21), E)).toBe(true);
    });
  });

  it('leaves a phone exactly where it was', () => {
    // A phone (portrait-locked, at most 430px) is narrower than twice
    // READABLE_PLAN_PX, so a building big enough to pass the size test could
    // not fit one level closer: it is already at its fit zoom.
    expect(READABLE_PLAN_PX * 2).toBeGreaterThan(430);
    expect(roomLabelsHidden(mapAt(18, 18), Q)).toBe(false);
    expect(roomLabelsHidden(mapAt(17, 18), Q)).toBe(true);
    expect(roomLabelsHidden(mapAt(17, 17), Q)).toBe(false);
  });
});
