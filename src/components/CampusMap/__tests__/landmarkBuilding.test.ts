import { describe, it, expect } from 'vitest';
import buildingsJson from '../../../data/map/buildings.json';
import landmarksJson from '../../../data/map/landmarks.json';
import { buildingSharingOutline } from '../landmarkBuilding';
import type { BuildingsMeta, Landmark } from '../../../types/campusMap';

const B = (buildingsJson as BuildingsMeta).buildings;
const L = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const byId = (id: number) => L.find((l) => l.id === id)!;

describe('buildingSharingOutline', () => {
  it('FRRMS (1587) and Kolej Akademie (1616) share budova Z', () => {
    expect(buildingSharingOutline(byId(1587), B)?.name).toBe('Z');
    expect(buildingSharingOutline(byId(1616), B)?.name).toBe('Z');
  });

  it('every other landmark is its own place', () => {
    const shared = L.filter((l) => buildingSharingOutline(l, B))
      .map((l) => l.id)
      .sort((a, b) => a - b);
    expect(shared).toEqual([1587, 1616]);
  });
});
