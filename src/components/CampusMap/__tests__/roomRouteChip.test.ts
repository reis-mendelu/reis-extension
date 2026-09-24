import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawRoomRouteChip, chipShown, chipShiftPx } from '../roomRouteChip';
import { EVENTS_PANE, LEAFLET_PANE_Z, REIS_PANE_Z } from '../mapPanes';

const room = () =>
  L.polygon([
    [49.2095, 16.6141],
    [49.2096, 16.6141],
    [49.2096, 16.6143],
    [49.2095, 16.6143],
  ]);

describe('drawRoomRouteChip', () => {
  it('offers the walk at the room the student just picked', () => {
    const layer = L.layerGroup();
    drawRoomRouteChip(layer, room(), 'Najdi cestu', vi.fn());
    expect(layer.getLayers()).toHaveLength(1);
  });

  it('draws nothing when no room is picked', () => {
    const layer = L.layerGroup();
    drawRoomRouteChip(layer, null, 'Najdi cestu', vi.fn());
    expect(layer.getLayers()).toHaveLength(0);
  });

  it('replaces the previous chip rather than stacking one behind it', () => {
    const layer = L.layerGroup();
    drawRoomRouteChip(layer, room(), 'Najdi cestu', vi.fn());
    drawRoomRouteChip(layer, room(), 'Najdi cestu', vi.fn());
    expect(layer.getLayers()).toHaveLength(1);
  });

  it('carries the words, so the chip is not a mystery glyph', () => {
    const layer = L.layerGroup();
    drawRoomRouteChip(layer, room(), 'Najdi cestu', vi.fn());
    const icon = (layer.getLayers()[0] as L.Marker).options.icon as L.DivIcon;
    expect(String(icon.options.html)).toContain('Najdi cestu');
  });

  it('asks for the route when pressed', () => {
    const layer = L.layerGroup();
    const onPress = vi.fn();
    drawRoomRouteChip(layer, room(), 'Najdi cestu', onPress);
    (layer.getLayers()[0] as L.Marker).fire('click');
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('does not let its tap fall through to the map, which clears the selection', () => {
    // The same trap the garden bubbles document: the map's tap-away would
    // close the very selection this chip belongs to, in the gesture that
    // pressed it.
    const layer = L.layerGroup();
    drawRoomRouteChip(layer, room(), 'Najdi cestu', vi.fn());
    expect((layer.getLayers()[0] as L.Marker).options.bubblingMouseEvents).toBe(false);
  });

  it('sits above the room, never over its name', () => {
    // The name is drawn dead centre of the polygon, and a pill anchored there
    // covered it: "now it's not clear what the underlying room's name is".
    // Anchored to the room's northern edge instead, so the label stays legible
    // and the pill reads as pointing at the room rather than labelling it.
    const layer = L.layerGroup();
    const poly = room();
    drawRoomRouteChip(layer, poly, 'Najdi cestu', vi.fn());
    const at = (layer.getLayers()[0] as L.Marker).getLatLng();
    expect(at.lat).toBeCloseTo(poly.getBounds().getNorth(), 6);
    expect(at.lng).toBeCloseTo(poly.getBounds().getCenter().lng, 6);
  });

  it('stays above the event pins — the student just asked for it', () => {
    // The event pins were lifted into their own pane at 640, above Leaflet's
    // marker pane (600). A divIcon marker left in the default pane would sit
    // UNDER any pin near the tapped room, hiding the offer the tap produced.
    // Same decision the walk's time chip made: what the student asked for is
    // drawn above what they did not.
    const layer = L.layerGroup();
    drawRoomRouteChip(layer, room(), 'Najdi cestu', vi.fn());
    expect((layer.getLayers()[0] as L.Marker).options.pane).toBe('tooltipPane');
    expect(LEAFLET_PANE_Z.tooltip).toBeGreaterThan(REIS_PANE_Z[EVENTS_PANE]);
  });
});

describe('chipShown', () => {
  const asked = { buildingName: 'Q', roomLabel: 'Q16' };

  it('offers the walk on a room the timetable sent you to', () => {
    expect(chipShown(asked, 'idle', true)).toBe(true);
  });

  it('says nothing where no walk could be built from', () => {
    // Prague, Špilberk, a park with no mapped path — anywhere the router
    // cannot start. The press would draw nothing at all, and since the
    // sentences are gone that reads as a broken button.
    expect(chipShown(asked, 'idle', false)).toBe(false);
  });

  it('says nothing on a room the student merely tapped', () => {
    expect(chipShown(null, 'idle', true)).toBe(false);
  });

  it('gets out of the way once the walk is on the map', () => {
    // The offer and the answer are different objects, and they were sitting on
    // each other: the pill and the "12 min" chip both land at the destination,
    // and they overlapped at 320, 390 and 430. Once the line is drawn the
    // question has been answered — the pill has nothing left to offer.
    expect(chipShown(asked, 'ready', true)).toBe(false);
    expect(chipShown(asked, 'locating', true)).toBe(false);
    expect(chipShown(asked, 'failed', true)).toBe(false);
  });
});

describe('chipShiftPx', () => {
  it('leaves a pill that already fits alone', () => {
    expect(chipShiftPx(100, 106, 390, 0)).toBe(0);
  });

  it('pulls a pill back onto the map at the right edge', () => {
    // 330 + 106 = 436 against a 390px map: 50 past the edge, plus the 4px pad.
    expect(chipShiftPx(330, 106, 390, 0)).toBe(-50);
  });

  it('keeps clear of the rail, which overlays the map rather than sitting beside it', () => {
    // Measured in phone landscape (844x390): the rail is on screen and the
    // pill was drawn on top of it — the offer floating over the panel. The
    // usable map ends where the rail starts, so that is the width to fit into:
    // 844 - 340 = 504, less the 4px pad, against a pill ending at 666.
    expect(chipShiftPx(560, 106, 844, 340)).toBe(-166);
  });

  it('gives up gracefully when the pill is wider than the space', () => {
    // Pinned to the left edge rather than centring the overflow, which is
    // what tooltipShift already decided for the walk labels.
    expect(chipShiftPx(20, 400, 390, 0)).toBe(-16);
  });
});
