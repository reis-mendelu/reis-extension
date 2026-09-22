import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { splitAnchors, RANK, KIND_OF_RANK } from '../campusPlaces.mjs';

const ranks = (pairs: [string, number][]) => new Map(pairs);

describe('splitAnchors', () => {
  it('sends gates and tram stops to the entrances', () => {
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([
        ['n1', 'Hlavní brána'],
        ['n2', 'Zemědělská'],
      ]),
      ranks([
        ['Hlavní brána', RANK.gate],
        ['Zemědělská', RANK.stop],
      ]),
      new Set(['A'])
    );
    expect([...entranceNodes.values()].sort()).toEqual(['Hlavní brána', 'Zemědělská']);
    expect(buildingNodes.size).toBe(0);
  });

  it('sends the lettered buildings to the destinations', () => {
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([['n1', 'Q']]),
      ranks([['Q', RANK.building]]),
      new Set(['Q'])
    );
    expect([...buildingNodes.values()]).toEqual(['Q']);
    expect(entranceNodes.size).toBe(0);
  });

  it('does NOT let a landmark become an entrance', () => {
    // The latent bug this exists for: landmarks are ranked as buildings so they
    // beat a café for a contested node, but they are not lettered buildings —
    // and "not in buildings.json" used to mean "therefore an entrance". One
    // would have shipped with kind: 'building' and taken a pill it must not
    // have. Every landmark is off-network today, so nothing caught it.
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([['n1', 'Koleje JAK Blok A']]),
      ranks([['Koleje JAK Blok A', RANK.building]]),
      new Set(['A', 'Q'])
    );
    expect(entranceNodes.size).toBe(0);
    expect(buildingNodes.size).toBe(0);
  });

  it('does not make a café either end of a walk', () => {
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([['n1', 'Budova O']]),
      ranks([['Budova O', RANK.cafeteria]]),
      new Set(['A'])
    );
    expect(entranceNodes.size).toBe(0);
    expect(buildingNodes.size).toBe(0);
  });

  it('shrugs off a place with no rank at all', () => {
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([['n1', 'Nikde']]),
      ranks([]),
      new Set(['A'])
    );
    expect(entranceNodes.size).toBe(0);
    expect(buildingNodes.size).toBe(0);
  });
});

describe('RANK and KIND_OF_RANK', () => {
  it('stay in step, because one indexes the other', () => {
    // `entrances[].kind` is KIND_OF_RANK[rank]. Adding a rank without adding
    // its kind in the same position silently mislabels every entrance below
    // it — a gate shipping as a cafeteria, with nothing to say so.
    for (const [name, rank] of Object.entries(RANK)) {
      const kind = KIND_OF_RANK[rank as number];
      expect(`${name}@${rank}`).toBe(`${name}@${rank}`);
      expect(kind, `rank ${name} (${rank}) has no kind`).toBeDefined();
    }
    expect(KIND_OF_RANK).toHaveLength(Object.keys(RANK).length);
  });

  it('keeps the kinds the shipped data already uses', () => {
    // campusPaths.json ships `kind: 'gate' | 'stop'`. If these move, every
    // committed entrance is relabelled by a regeneration.
    expect(KIND_OF_RANK[RANK.building]).toBe('building');
    expect(KIND_OF_RANK[RANK.gate]).toBe('gate');
    expect(KIND_OF_RANK[RANK.stop]).toBe('stop');
    expect(KIND_OF_RANK[RANK.cafeteria]).toBe('cafeteria');
  });

  it('gives an off-campus origin the kind the CampusEntrance type already carries', () => {
    expect(KIND_OF_RANK[RANK.origin]).toBe('other');
  });
});

describe('splitAnchors with an off-campus origin', () => {
  it('admits an origin to the entrances, not to the walk ends', () => {
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([
        ['k1', 'FRRMS'],
        ['k2', 'Q'],
      ]),
      new Map([
        ['FRRMS', RANK.origin],
        ['Q', RANK.building],
      ]),
      new Set(['Q'])
    );
    expect([...entranceNodes.values()]).toEqual(['FRRMS']);
    expect([...buildingNodes.values()]).toEqual(['Q']);
  });

  it('still keeps a plain landmark out of both, which is why the rank had to be new', () => {
    // A landmark carries RANK.building so it beats a cafe for a doorway, but
    // it is not a lettered building. Admitting it to the entrances would ship
    // it with kind 'building' and give a building a pill it must never have.
    const { entranceNodes, buildingNodes } = splitAnchors(
      new Map([['k1', 'Koleje JAK Blok A']]),
      new Map([['Koleje JAK Blok A', RANK.building]]),
      new Set()
    );
    expect(entranceNodes.size).toBe(0);
    expect(buildingNodes.size).toBe(0);
  });

  it('lets an origin outrank a tram stop for a contested node', () => {
    expect(RANK.origin).toBeLessThan(RANK.stop);
  });
});
