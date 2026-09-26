import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { applyTilt, groundAt, screenOf } from '../cameraRig';
import { clampTilt, frameBuilding, mixTilt, type Band } from '../tiltCamera';

const [W, H] = [390, 844];
const PHONE: Band = { top: 110, bottom: 690, width: W, height: H }; // under the search bar, above the sheet

describe('framing', () => {
  const framed = frameBuilding(67, 28.75, 40, 50, PHONE);
  const cam = new PerspectiveCamera(40, W / H, 1, 5000);
  applyTilt(cam, framed, W, H);

  it('puts the building in the middle of the visible band, not the canvas', () => {
    const c = screenOf(cam, new Vector3(0, 28.75 / 2, 0), W, H);
    expect(c.x).toBeCloseTo(W / 2, 0);
    expect(c.y).toBeCloseTo((PHONE.top + PHONE.bottom) / 2, 0);
  });

  it('keeps the whole building inside the band', () => {
    for (const [x, y, z] of [
      [67, 0, 0],
      [-67, 0, 0],
      [0, 0, 67],
      [0, 28.75, -67],
      [0, 28.75, 67],
    ] as const) {
      const s = screenOf(cam, new Vector3(x, y, z), W, H);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(W);
      expect(s.y).toBeGreaterThanOrEqual(PHONE.top);
      expect(s.y).toBeLessThanOrEqual(PHONE.bottom);
    }
  });

  it('frames the same way whatever zoom the flat map was at', () => {
    expect(frameBuilding(67, 28.75, 40, 50, PHONE)).toEqual(framed);
  });
});

describe('limits', () => {
  const framed = frameBuilding(67, 28.75, 40, 50, PHONE);
  it('stops zooming in or out past the limits', () => {
    expect(clampTilt({ ...framed, distance: 1 }, framed, 67).distance).toBeCloseTo(
      framed.distance * 0.4
    );
    expect(clampTilt({ ...framed, distance: 1e6 }, framed, 67).distance).toBeCloseTo(
      framed.distance * 1.5
    );
  });
  it('stops panning the building out of reach', () => {
    const far = clampTilt({ ...framed, target: [1000, 14, 0] }, framed, 67);
    expect(Math.hypot(far.target[0], far.target[2])).toBeCloseTo(67 * 1.5);
  });
  it('never changes pitch or direction', () => {
    const c = clampTilt({ ...framed, distance: 1 }, framed, 67);
    expect(c.pitch).toBe(framed.pitch);
  });
  it('interpolates the handover end to end', () => {
    const a = {
      ...framed,
      target: [10, 4, 10] as [number, number, number],
      distance: 300,
      pitch: 89.9,
      offsetY: 0,
    };
    expect(mixTilt(a, framed, 0)).toEqual(a);
    expect(mixTilt(a, framed, 1)).toEqual(framed);
  });
});

describe('groundAt', () => {
  it('finds the ground under a pixel, and that point projects back to the pixel', () => {
    const framed = frameBuilding(67, 28.75, 40, 50, PHONE);
    const cam = new PerspectiveCamera(40, W / H, 1, 5000);
    applyTilt(cam, framed, W, H);
    const g = groundAt(cam, 120, 400, W, H, 4.57)!;
    expect(g.y).toBeCloseTo(4.57, 6);
    const s = screenOf(cam, g, W, H);
    expect(s.x).toBeCloseTo(120, 3);
    expect(s.y).toBeCloseTo(400, 3);
  });
});
