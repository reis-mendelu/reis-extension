import { describe, it, expect } from 'vitest';
import { CAMPUS_ENTRANCES, CAMPUS_NETWORK, CAMPUS_WALKS, WALKS_BY_ENTRANCE } from '../pathLayers';

const BUILDINGS = ['A', 'B', 'C', 'E', 'M', 'Q', 'X'];
/** The one gate that is not on the campus: the arboretum's far side, by FRRMS. */
const FAR_GATE = 'Brána u FRRMS';

describe('the committed walks', () => {
  it('runs every walk from an entrance to a lettered building', () => {
    const gates = new Set(CAMPUS_ENTRANCES.map((e) => e.name));
    for (const w of CAMPUS_WALKS) {
      expect(gates.has(w.from)).toBe(true);
      expect(BUILDINGS).toContain(w.to);
      expect(w.coords.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gets you from every gate to every building', () => {
    // The promise the fan makes. If a gate cannot reach a building the map
    // quietly stops answering the question someone walked up with.
    for (const gate of CAMPUS_ENTRANCES) {
      const reached = (WALKS_BY_ENTRANCE.get(gate.name) ?? []).map((w) => w.to).sort();
      expect(reached).toEqual([...BUILDINGS].sort());
    }
  });

  it('keeps every walk from a campus gate plausible for a campus 400 m across', () => {
    for (const w of CAMPUS_WALKS.filter((x) => x.from !== FAR_GATE)) {
      expect(w.lengthM).toBeGreaterThanOrEqual(25);
      expect(w.lengthM).toBeLessThan(900);
    }
  });

  it('keeps the walks from the far gate long, because it is a garden away', () => {
    // Brána u FRRMS is the arboretum's own gate out on Generála Píky, and its
    // walks run the length of the garden to get here. Asserted as a band rather
    // than a ceiling: one of these coming out SHORT would mean the route had
    // stopped somewhere inside the arboretum instead of reaching the campus.
    const far = CAMPUS_WALKS.filter((x) => x.from === FAR_GATE);
    expect(far).toHaveLength(BUILDINGS.length);
    for (const w of far) {
      expect(w.lengthM).toBeGreaterThan(700);
      expect(w.lengthM).toBeLessThan(1300);
    }
  });

  it('marks seven ways in', () => {
    expect(CAMPUS_ENTRANCES).toHaveLength(7);
    for (const e of CAMPUS_ENTRANCES) expect(['gate', 'stop']).toContain(e.kind);
  });

  /** Every segment of a line, as an order-independent key. */
  const edgesOf = (coords: number[][]) => {
    const out: string[] = [];
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1] ?? [];
      const b = coords[i] ?? [];
      out.push([a.join(','), b.join(',')].sort().join('|'));
    }
    return out;
  };

  it('draws every stretch of the network exactly once', () => {
    const edges = CAMPUS_NETWORK.flatMap(edgesOf);
    expect(new Set(edges).size).toBe(edges.length);
  });

  it('covers every stretch the walks run over', () => {
    const drawn = new Set(CAMPUS_NETWORK.flatMap(edgesOf));
    for (const w of CAMPUS_WALKS)
      for (const edge of edgesOf(w.coords)) expect(drawn.has(edge)).toBe(true);
  });
});
