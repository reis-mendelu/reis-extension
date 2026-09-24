import { describe, it, expect } from 'vitest';
import campusPaths from '../../../data/map/campusPaths.json';
import type { CampusEntrance, CampusPath } from '../../../types/campusMap';

const DATA = campusPaths as unknown as {
  entrances: CampusEntrance[];
  network: number[][][];
  routes: CampusPath[];
};

const BUILDINGS = ['A', 'B', 'C', 'E', 'M', 'Q', 'X'];
/** The one gate that is not on the campus: the arboretum's far side, by FRRMS. */
const FAR_GATE = 'Brána u FRRMS';

/**
 * The gates and their walks, read from the DATASET rather than from a map
 * layer, because that is all they are now.
 *
 * The map used to mark every gate with a dot and ask a two-tap question — pick
 * the gate you came in by, then the building you are going to, and it lit one
 * precomputed walk. The router answers that from the student's actual position
 * now, so the dots and the question are gone. The data stays: the entrances are
 * where the campus can be walked into, which is what the routing graph joins
 * the outside world on, and `routes` is the independent build-time computation
 * that `againstCommittedRoutes` checks the live router against.
 *
 * These assertions are therefore about the data being intact, not about
 * anything being drawn. If a scrape ever drops a gate, this fails here rather
 * than silently shortening a walk somewhere else.
 */
describe('the committed gates and walks, as data', () => {
  it('still carries every way onto the campus', () => {
    const names = DATA.entrances.map((e) => e.name);
    expect(names).toContain('Hlavní brána');
    expect(names).toContain(FAR_GATE);
    expect(DATA.entrances.length).toBeGreaterThanOrEqual(6);
  });

  it('runs every walk from an entrance to a lettered building', () => {
    const gates = new Set(DATA.entrances.map((e) => e.name));
    for (const w of DATA.routes) {
      expect(gates.has(w.from)).toBe(true);
      expect(BUILDINGS).toContain(w.to);
      expect(w.coords.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gets you from every gate to every building', () => {
    for (const gate of DATA.entrances) {
      const reached = DATA.routes
        .filter((w) => w.from === gate.name)
        .map((w) => w.to)
        .sort();
      expect(reached).toEqual([...BUILDINGS].sort());
    }
  });

  it('keeps every walk from a campus gate plausible for a campus 400 m across', () => {
    for (const w of DATA.routes.filter((x) => x.from !== FAR_GATE)) {
      expect(w.lengthM).toBeGreaterThanOrEqual(25);
      expect(w.lengthM).toBeLessThan(900);
    }
  });

  it('draws the network as deduplicated strokes', () => {
    expect(DATA.network.length).toBeGreaterThan(0);
    for (const stroke of DATA.network) expect(stroke.length).toBeGreaterThanOrEqual(2);
  });
});
