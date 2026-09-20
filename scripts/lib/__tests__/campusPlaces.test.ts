import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { splitAnchors, RANK } from '../campusPlaces.mjs';

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
