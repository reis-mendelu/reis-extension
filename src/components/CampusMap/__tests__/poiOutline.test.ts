import { describe, it, expect } from 'vitest';
import isRoomPlacesJson from '../../../data/map/isRoomPlaces.json';
import poisJson from '../../../data/map/pois.json';
import type { MapSelection, PoiFeature } from '../../../types/campusMap';
import type { RoomPlaceEntry } from '../../../utils/rooms/lookupRoomPlace';
import { POI_OUTLINES, outlineForSelection } from '../poiOutline';

const POIS = (poisJson as unknown as { features: PoiFeature[] }).features;
const poiSel = (id: number, forRoom?: string): MapSelection => {
  const f = POIS.find((p) => p.properties.id === id)!;
  return { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates, forRoom };
};

describe('outlineForSelection', () => {
  it('outlines building D when D05 flew there', () => {
    const ring = outlineForSelection(poiSel(1592, 'D05'), null);
    expect(ring?.length).toBeGreaterThan(3);
  });

  it('outlines the building picked straight from search, with no room', () => {
    expect(outlineForSelection(poiSel(1572), null)).not.toBeNull();
  });

  it('draws nothing inside a floor plan — the room is highlighted there', () => {
    expect(outlineForSelection(poiSel(1592, 'D05'), 54678)).toBeNull();
  });

  it('draws nothing for a point with no outline (a tram stop) or no selection', () => {
    const stop = POIS.find((p) => p.properties.type === 'transportation_stop')!;
    expect(outlineForSelection(poiSel(stop.properties.id), null)).toBeNull();
    expect(outlineForSelection(null, null)).toBeNull();
  });
});

describe('POI outlines', () => {
  it('every building an IS room is placed on has an outline to highlight', () => {
    const targets = new Set(
      (isRoomPlacesJson as RoomPlaceEntry[]).filter((e) => e.kind === 'poi').map((e) => e.id)
    );
    const outlined = new Set(POI_OUTLINES.keys());
    expect([...targets].filter((id) => !outlined.has(id))).toEqual([]);
  });

  it('each outline is closed and sits on its own POI (centroid within 60 m)', () => {
    for (const [id, ring] of POI_OUTLINES) {
      expect(ring[0], `${id} closed`).toEqual(ring[ring.length - 1]);
      const poi = POIS.find((p) => p.properties.id === id)!;
      const [lon, lat] = poi.geometry.coordinates;
      const cx = ring.reduce((s, c) => s + c[0]!, 0) / ring.length;
      const cy = ring.reduce((s, c) => s + c[1]!, 0) / ring.length;
      const metres = Math.hypot((cx - lon) * 72_900, (cy - lat) * 111_200);
      expect(metres, poi.properties.name).toBeLessThan(60);
    }
  });
});
