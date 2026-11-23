import { describe, expect, it } from 'vitest';
import buildingsJson from '../buildings.json';
import plates from '../isoPlates.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { ISO_BUILDINGS } from '../isoBuildings';
import { buildFloorScene } from '../../../components/CampusMap/iso/isoFloorScene';

const buildings = (buildingsJson as BuildingsMeta).buildings;
const P = plates as unknown as Record<string, [number, number][][]>;
// Shoelace area in degrees², scaled to m² at Brno's latitude.
const area = (r: [number, number][]) =>
  Math.abs(
    r.reduce(
      (s, p, i) =>
        s + (r[i - 1] ?? r[r.length - 1]!)[0] * p[1] - p[0] * (r[i - 1] ?? r[r.length - 1]!)[1],
      0
    )
  ) *
  0.5 *
  111_320 *
  111_320 *
  Math.cos((49.2 * Math.PI) / 180);

const shoelace = (r: [number, number][]) =>
  r.reduce(
    (s, p, i) =>
      s + (r[i - 1] ?? r[r.length - 1]!)[0] * p[1] - p[0] * (r[i - 1] ?? r[r.length - 1]!)[1],
    0
  ) / 2;

describe('the real footprint of each cut building', () => {
  it('exists for every building the picture cuts except Q, which is cut along its outline', () => {
    for (const id of Object.keys(ISO_BUILDINGS).map(Number)) {
      expect(id === 0 || (P[String(id)]?.length ?? 0) > 0, `building ${id}`).toBe(true);
    }
    expect(P['0']).toBeUndefined();
  });

  it('is a closed ring of about the outline size: it leaves out courtyards and low wings, not the building', () => {
    for (const b of buildings.filter((x) => P[String(x.id)])) {
      const rings = P[String(b.id)]!;
      rings.forEach((r) => expect(r[0]).toEqual(r[r.length - 1]));
      const share =
        rings.reduce((s, r) => s + area(r), 0) /
        area(b.outline.coordinates[0] as [number, number][]);
      expect(share, b.name).toBeGreaterThan(0.7);
      expect(share, b.name).toBeLessThan(1.15);
    }
  });

  it('is what the floor plate is drawn from, and Q keeps its outline', () => {
    const E = buildings.find((b) => b.name === 'E')!;
    const Q = buildings.find((b) => b.name === 'Q')!;
    const plateE = buildFloorScene(E.id, E.floors.find((f) => f.level === 3)!.id, undefined)!;
    const plateQ = buildFloorScene(0, Q.floors.find((f) => f.level === 3)!.id, undefined)!;
    expect(plateE.deck).toHaveLength(P[String(E.id)]!.length);
    expect(plateE.deck[0]).toHaveLength(P[String(E.id)]![0]!.length);
    expect(plateE.deck[0]!.length).not.toBe(E.outline.coordinates[0]!.length);
    expect(plateQ.deck).toHaveLength(1);
    expect(plateQ.deck[0]).toHaveLength(Q.outline.coordinates[0]!.length);
  });

  // C's strip and rotunda and X's oval stop below their top floors: a plate there would hang in the air.
  it('draws no plate over a low part that the floor is above', () => {
    const deckArea = (name: string, level: number) => {
      const b = buildings.find((x) => x.name === name)!;
      const scene = buildFloorScene(b.id, b.floors.find((f) => f.level === level)!.id, undefined)!;
      return scene.deck.reduce((s, r) => s + Math.abs(shoelace(r)), 0);
    };
    expect(deckArea('C', 6)).toBeLessThan(deckArea('C', 0) * 0.6);
    expect(deckArea('C', 1)).toBeGreaterThan(deckArea('C', 6));
    expect(deckArea('X', 3)).toBeLessThan(deckArea('X', 1) * 0.5);
    // A building with one height keeps one footprint on every floor.
    expect(deckArea('A', 4)).toBeCloseTo(deckArea('A', 0), 0);
  });
});
