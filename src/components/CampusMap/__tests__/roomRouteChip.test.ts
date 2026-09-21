import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawRoomRouteChip } from '../roomRouteChip';

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
});
