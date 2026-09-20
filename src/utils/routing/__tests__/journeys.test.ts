import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import campusPaths from '../../../data/map/campusPaths.json';
import type { CampusGraph } from '../../../types/campusMap';
import { snapToGraph } from '../snapToGraph';
import { shortestWalk } from '../shortestWalk';
import { isGateOpen } from '../gateHours';
const g = (campusPaths as unknown as { graph: CampusGraph }).graph;
const weekday = new Date('2026-09-21T10:00:00');
const weekend = new Date('2026-09-26T10:00:00');
const open = (d: Date) => (gate: string) => isGateOpen(gate, d);
const places: [string, [number, number]][] = [
  ['FRRMS', [16.614118, 49.218161]],
  ['JAK Blok A', [16.630584, 49.216233]],
  ['mid-campus', [16.6155, 49.2106]],
  ['main gate', [16.617241, 49.210133]],
];
const report: Record<string, unknown>[] = [];
afterAll(() => {
  mkdirSync('.verify', { recursive: true });
  writeFileSync('.verify/journeys.json', JSON.stringify(report, null, 2) + '\n');
});

describe('real journeys over the committed graph', () => {
  it.each(places)('routes from %s to Q on a weekday', (name, at) => {
    const s = snapToGraph(g, at);
    expect(s, `${name} should snap`).not.toBeNull();
    const w = shortestWalk(g, s!, g.buildings.Q, open(weekday));
    expect(w, `${name} should reach Q`).not.toBeNull();
    report.push({ from: name, to: 'Q', m: Math.round(w!.lengthM), min: Math.max(1, Math.round(w!.lengthM / 100)), gates: w!.gates });
  });
  it('FRRMS uses the garden on a weekday', () => {
    const s = snapToGraph(g, [16.614118, 49.218161])!;
    expect(shortestWalk(g, s, g.buildings.Q, open(weekday))!.gates).toContain('garden');
  });
  it('FRRMS on a weekend', () => {
    const s = snapToGraph(g, [16.614118, 49.218161])!;
    const w = shortestWalk(g, s, g.buildings.Q, open(weekend));
    report.push({ from: 'FRRMS (weekend)', to: 'Q', m: w ? Math.round(w.lengthM) : null, min: w ? Math.max(1, Math.round(w.lengthM / 100)) : null, gates: w?.gates ?? [] });
  });
  it('JAK does not need the garden', () => {
    const s = snapToGraph(g, [16.630584, 49.216233])!;
    expect(shortestWalk(g, s, g.buildings.Q, open(weekend))).not.toBeNull();
  });
});
