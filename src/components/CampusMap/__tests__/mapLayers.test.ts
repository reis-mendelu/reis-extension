import { describe, it, expect, afterEach } from 'vitest';
import L from 'leaflet';
import { initLeafletMap } from '../mapLayers';

// Návrhy #27 (Android, 2026-10): "rozmazaná obrazovka při přiblížení". Measured
// on a Pixel 9a: OSM serves nothing deeper than z19, so the map's z22 stretched
// one z19 tile 8× — the street label in budova Q's courtyard became a grey smear
// while the vector floor plan above it stayed sharp. The basemap now stops one
// level past its deepest tile; the map itself still zooms to 22, because that is
// where the small rooms of E, X and C become big enough to tap.
describe('initLeafletMap zoom ceilings', () => {
  let map: L.Map | null = null;
  afterEach(() => {
    map?.remove();
    map = null;
  });

  const init = () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    map = initLeafletMap(el, [
      [49.209, 16.613],
      [49.212, 16.619],
    ]);
    let tiles: L.TileLayer | null = null;
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) tiles = l;
    });
    expect(tiles).not.toBeNull();
    return { map, tiles: tiles! as L.TileLayer };
  };

  it('never stretches a basemap tile more than 2×', () => {
    const { tiles } = init();
    const { maxZoom, maxNativeZoom } = tiles.options;
    expect(maxNativeZoom).toBe(19); // OSM's deepest level
    expect(maxZoom! - maxNativeZoom!).toBeLessThanOrEqual(1);
  });

  it('keeps zooming past the basemap so small rooms stay tappable', () => {
    const { map: m, tiles } = init();
    expect(m.getMaxZoom()).toBe(22);
    expect(m.getMaxZoom()).toBeGreaterThan(tiles.options.maxZoom!);
  });
});
