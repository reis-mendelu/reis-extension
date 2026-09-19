import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawGardenBubbles, GARDEN_PLACES, bubblesHidden } from '../gardenBubbleLayer';
import type { GardenPlace } from '../../../types/campusMap';

/** A place that HAS a photograph, so it draws as a bubble rather than a dot. */
const PHOTOGRAPHED: GardenPlace[] = [
  {
    id: 'rokle',
    number: '2.6',
    section: 2,
    name: { cz: 'Rokle', en: 'The ravine' },
    why: { cz: 'Zarostlý zářez.', en: 'An overgrown cut.' },
    lon: 16.6123,
    lat: 49.2141,
    photo: 'rokle.8f3a1c.webp',
  },
];

describe('drawGardenBubbles', () => {
  it('adds one marker per photographed garden place', () => {
    const layer = L.layerGroup();
    const withPhoto = GARDEN_PLACES.filter((p) => p.photo).length;
    const n = drawGardenBubbles(layer, { touch: false, onSelect: () => {} });
    expect(n).toBe(withPhoto);
    expect(layer.getLayers()).toHaveLength(withPhoto);
  });

  it('hands the clicked place to onSelect', () => {
    const layer = L.layerGroup();
    const onSelect = vi.fn();
    drawGardenBubbles(layer, { lang: 'cz', touch: false, onSelect });
    (layer.getLayers()[0] as L.Marker).fire('click');
    expect(onSelect).toHaveBeenCalledWith(GARDEN_PLACES[0]);
  });

  it('draws nothing at all for a place whose photograph has not arrived yet', () => {
    const layer = L.layerGroup();
    const noPhoto = { ...PHOTOGRAPHED[0]!, id: 'vodni-kaskada', photo: undefined };
    drawGardenBubbles(layer, { touch: false, onSelect: () => {} }, [
      PHOTOGRAPHED[0]!,
      noPhoto,
    ]);
    // A pin with no picture behind it promises something the tap cannot give.
    expect(layer.getLayers()).toHaveLength(1);
  });

  it('rests bigger on a touch device, where there is no hover to grow it', () => {
    const mouse = L.layerGroup();
    const touch = L.layerGroup();
    drawGardenBubbles(mouse, { touch: false, onSelect: () => {} }, PHOTOGRAPHED);
    drawGardenBubbles(touch, { touch: true, onSelect: () => {} }, PHOTOGRAPHED);
    const size = (g: L.LayerGroup) =>
      ((g.getLayers()[0] as L.Marker).options.icon as L.DivIcon).options.iconSize as L.PointTuple;
    expect(size(touch)[0]).toBeGreaterThan(size(mouse)[0]);
    expect(size(touch)[0]).toBeGreaterThanOrEqual(44);
  });

  it('puts no words on the map at all — no tooltip, no title', () => {
    const layer = L.layerGroup();
    drawGardenBubbles(layer, { touch: false, onSelect: () => {} }, PHOTOGRAPHED);
    const marker = layer.getLayers()[0] as L.Marker;
    expect(marker.getTooltip()).toBeUndefined();
    // Leaflet defaults `title` to '' rather than leaving it unset.
    expect(marker.options.title).toBeFalsy();
  });
});

describe('bubblesHidden', () => {
  const bounds = L.latLngBounds([49.2108, 16.6098], [49.2163, 16.6166]);
  /** Only the two methods bubblesHidden asks for. */
  const mapAt = (zoom: number, fitZoom: number) =>
    ({ getZoom: () => zoom, getBoundsZoom: () => fitZoom }) as unknown as L.Map;

  it('shows the bubbles once the garden fills the screen', () => {
    expect(bubblesHidden(mapAt(16, 16), bounds)).toBe(false);
    expect(bubblesHidden(mapAt(18, 16), bounds)).toBe(false);
  });

  it('hides them when the garden is drawn smaller than that', () => {
    expect(bubblesHidden(mapAt(15, 16), bounds)).toBe(true);
  });

  it('follows the viewport, not a fixed zoom', () => {
    // A 375px phone fits the garden at 15, where a desktop pane fits it at 16.
    // A hardcoded floor of 16 hid every bubble on the phone — the bug this
    // function exists to prevent.
    expect(bubblesHidden(mapAt(15, 15), bounds)).toBe(false);
  });
});
