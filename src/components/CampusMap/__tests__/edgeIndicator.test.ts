import { describe, it, expect } from 'vitest';
import { edgeAnchor, clusterLandmarks, type LandmarkPoint } from '../edgeIndicator';

const rect = { width: 400, height: 300 };
const center = { x: 200, y: 150 };

describe('edgeAnchor', () => {
  it('returns null when the target is on-screen', () => {
    expect(edgeAnchor(center, { x: 210, y: 160 }, rect, 20)).toBeNull();
  });

  it('clamps an off-screen target to the padded edge (east)', () => {
    const a = edgeAnchor(center, { x: 9999, y: 150 }, rect, 20);
    expect(a).not.toBeNull();
    expect(a!.x).toBeCloseTo(380, 5);          // width - pad
    expect(a!.y).toBeCloseTo(150, 5);          // same row as center
    expect(a!.angle).toBeCloseTo(0, 5);        // due east
  });

  it('clamps a target to the north edge', () => {
    const a = edgeAnchor(center, { x: 200, y: -9999 }, rect, 20);
    expect(a).not.toBeNull();
    expect(a!.y).toBeCloseTo(20, 5);           // pad from top
    expect(a!.x).toBeCloseTo(200, 5);
    expect(a!.angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('keeps a corner target inside the padded box', () => {
    const a = edgeAnchor(center, { x: 9999, y: -9999 }, rect, 20);
    expect(a).not.toBeNull();
    expect(a!.x).toBeLessThanOrEqual(380);
    expect(a!.x).toBeGreaterThanOrEqual(20);
    expect(a!.y).toBeLessThanOrEqual(280);
    expect(a!.y).toBeGreaterThanOrEqual(20);
  });
});

describe('clusterLandmarks', () => {
  // 4 JAK blocks within ~150 m of each other; Tauferovy ~3 km west, alone.
  const points: LandmarkPoint[] = [
    { id: 1569, name: 'Koleje JAK Blok A', lat: 49.216233, lon: 16.630584 },
    { id: 1585, name: 'Koleje JAK Blok B', lat: 49.215418, lon: 16.630844 },
    { id: 1611, name: 'Koleje JAK Blok C', lat: 49.216166, lon: 16.631388 },
    { id: 1582, name: 'Koleje JAK Blok D', lat: 49.215601, lon: 16.630004 },
    { id: 1588, name: 'Tauferovy koleje', lat: 49.214599, lon: 16.588826 },
  ];

  it('collapses the 4 JAK blocks into one cluster', () => {
    const clusters = clusterLandmarks(points, 150);
    const jak = clusters.find((c) => c.ids.includes(1569))!;
    expect(jak.ids.sort()).toEqual([1569, 1582, 1585, 1611]);
  });

  it('keeps the far Tauferovy block in its own cluster', () => {
    const clusters = clusterLandmarks(points, 150);
    const tauf = clusters.find((c) => c.ids.includes(1588))!;
    expect(tauf.ids).toEqual([1588]);
    expect(tauf.label).toBe('Tauferovy koleje');
  });

  it('labels the JAK cluster with the shared prefix', () => {
    const clusters = clusterLandmarks(points, 150);
    const jak = clusters.find((c) => c.ids.includes(1569))!;
    expect(jak.label).toContain('Koleje JAK');
  });
});
