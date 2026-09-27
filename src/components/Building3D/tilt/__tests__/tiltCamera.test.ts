import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  cameraPosition,
  clampLabelX,
  clampLabelY,
  flatDistance,
  localMetresPerPixel,
  FLAT_PITCH,
} from '../tiltCamera';

const LAT = 49.2096;

describe('tiltCamera', () => {
  it('matches Leaflet: at zoom 18 in Brno a CSS pixel is ~0.39 m', () => {
    const mpp = localMetresPerPixel(LAT, 18);
    expect(mpp.x).toBeCloseTo(0.3906, 3);
    expect(mpp.y).toBeCloseTo(0.3906, 2);
    expect(localMetresPerPixel(LAT, 19).y).toBeCloseTo(mpp.y / 2, 6);
  });

  it('frames exactly the map a straight-down camera replaces, edge to edge', () => {
    const [w, h, fov] = [390, 844, 40];
    const mpp = localMetresPerPixel(LAT, 18);
    const cam = new PerspectiveCamera(fov, w / h, 1, 5000);
    cam.position.set(...cameraPosition([0, 0], flatDistance(h, mpp.y, fov), 180, FLAT_PITCH));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    // The ground point at the top edge of the viewport: h/2 pixels north (−z).
    const top = new Vector3(0, 0, -(h / 2) * mpp.y).project(cam);
    const right = new Vector3((w / 2) * mpp.x, 0, 0).project(cam);
    expect(top.y).toBeCloseTo(1, 2); // top of the screen
    expect(right.x).toBeCloseTo(1, 2); // right edge: same scale both ways
  });

  it('puts the camera south of the target for bearing 180, so north stays up', () => {
    const [x, y, z] = cameraPosition([10, 20], 100, 180, 45);
    expect(x).toBeCloseTo(10, 6);
    expect(z).toBeGreaterThan(20);
    expect(y).toBeCloseTo(100 * Math.sin(Math.PI / 4), 6);
  });
});

describe('clampLabelX', () => {
  // Q39 sits on Q's west edge: framed on the building, its label ran off screen.
  it('keeps a label whole inside the view, with a gutter', () => {
    expect(clampLabelX(10, 120, 390)).toBe(16 + 60);
    expect(clampLabelX(385, 120, 390)).toBe(390 - 16 - 60);
  });

  it('leaves a label that fits where the scene put it', () => {
    expect(clampLabelX(200, 120, 390)).toBe(200);
  });

  it('centres a label wider than the view', () => {
    expect(clampLabelX(10, 500, 390)).toBe(195);
  });
});

describe('clampLabelY', () => {
  // The pin hangs above its anchor (translate -100%): its top is y − height.
  it('keeps the pin below the top of the view', () => {
    expect(clampLabelY(10, 30, 0)).toBe(16 + 30);
    expect(clampLabelY(10, 30, 60)).toBe(60 + 30);
  });

  it('leaves a pin that fits where the scene put it', () => {
    expect(clampLabelY(300, 30, 60)).toBe(300);
  });
});
