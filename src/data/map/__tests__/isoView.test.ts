import { describe, expect, it } from 'vitest';
import { ISO_START } from '../isoMap';
import { isoMinZoom, isoOpeningView, isoPointFromLatLng } from '../isoView';

// Building Q's centre in the campus data (src/data/map/buildings.json).
const Q = { lat: 49.209592, lng: 16.614247 };

describe('where a place is on the isometric image', () => {
  it('puts building Q on the campus start point, within a few metres', () => {
    const p = isoPointFromLatLng(Q.lat, Q.lng)!;
    // 1 viewport unit is 11535 px of 0.2 m: 0.001 is 2.5 m.
    expect(Math.abs(p.x - ISO_START.x)).toBeLessThan(0.004);
    expect(Math.abs(p.y - ISO_START.y)).toBeLessThan(0.008);
  });

  it('puts north above and east to the right, the way the picture is drawn', () => {
    const q = isoPointFromLatLng(Q.lat, Q.lng)!;
    expect(isoPointFromLatLng(Q.lat + 0.001, Q.lng)!.y).toBeLessThan(q.y);
    expect(isoPointFromLatLng(Q.lat, Q.lng + 0.001)!.x).toBeGreaterThan(q.x);
  });

  it('says nothing for a place the picture does not cover', () => {
    expect(isoPointFromLatLng(50.0755, 14.4378)).toBeNull(); // Prague
    expect(isoPointFromLatLng(49.2, 16.6)).toBeNull(); // Brno, but off the rendered square's south-west
  });
});

describe('how far out you may zoom', () => {
  it('never shows empty space: the picture always covers the screen', () => {
    // Landscape: the picture's width is the limit.
    expect(isoMinZoom(1440, 900)).toBe(1);
    // Portrait phone: its height is, so the limit is much closer in.
    const phone = isoMinZoom(390, 844);
    expect(phone).toBeGreaterThan(2.5);
    // At that zoom the visible height equals the picture's height (8517 / 11535 wide).
    expect(844 / 390 / phone).toBeCloseTo(8517 / 11535, 3);
  });
});

describe('where the isometric map opens', () => {
  it('opens on the campus when there is no 2D map to follow', () => {
    expect(isoOpeningView(null, 390)).toEqual(ISO_START);
  });

  it('opens on the campus when the 2D map is looking somewhere the picture does not cover', () => {
    expect(isoOpeningView({ lat: 50.0755, lng: 14.4378, zoom: 17 }, 390)).toEqual(ISO_START);
  });

  it('opens on what the 2D map is looking at, at a comparable scale', () => {
    const v = isoOpeningView({ lat: Q.lat, lng: Q.lng, zoom: 17 }, 390);
    expect(Math.abs(v.x - ISO_START.x)).toBeLessThan(0.004);
    // Zoom 17 is ~0.78 m per px, which wants a closer picture than we open at: it is capped at the campus-wide scale.
    expect(v.zoom).toBe(ISO_START.zoom);
    // A 2D map zoomed far OUT opens as far out as allowed, not further.
    expect(isoOpeningView({ lat: Q.lat, lng: Q.lng, zoom: 13 }, 390).zoom).toBe(3);
  });

  it('does not open absurdly close when the 2D map is on a floor plan', () => {
    expect(isoOpeningView({ lat: Q.lat, lng: Q.lng, zoom: 21 }, 390).zoom).toBeLessThanOrEqual(
      ISO_START.zoom
    );
  });
});
