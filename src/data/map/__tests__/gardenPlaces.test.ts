import { describe, it, expect } from 'vitest';
import gardenPlaces from '../gardenPlaces.json';
import remotePlaces from '../remotePlaces.json';
import { pointInRing } from './pointInRing';
import type { GardenPlace, RemotePlace } from '../../../types/campusMap';

const PLACES = (gardenPlaces as { places: GardenPlace[] }).places;
const GARDEN = (remotePlaces as { places: RemotePlace[] }).places.find((p) => p.id === -101)!;
const RING = GARDEN.area!.coordinates[0]!;

describe('gardenPlaces.json', () => {
  it('gives every place a unique id and both languages', () => {
    const ids = new Set<string>();
    for (const p of PLACES) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.name.cz.length).toBeGreaterThan(0);
      expect(p.name.en.length).toBeGreaterThan(0);
    }
  });

  it('numbers a place per the official plan, when it is on the plan at all', () => {
    for (const p of PLACES) {
      if (p.number === undefined) {
        // Not on the plan (the minotaur, the ponds, the little wood): then it
        // must not claim a section either.
        expect(p.section).toBeUndefined();
        continue;
      }
      expect(p.number).toMatch(/^[1-5]\.\d{1,2}$/);
      expect(p.section).toBe(Number(p.number.split('.')[0]));
    }
  });

  it('places every point inside the garden', () => {
    for (const p of PLACES) {
      expect(pointInRing([p.lon, p.lat], RING), `${p.id} is outside the garden`).toBe(true);
    }
  });

  it('never lists a place as both a bubble and a dot', () => {
    const dotNames = new Set((GARDEN.pois ?? []).map((d) => d.name));
    for (const p of PLACES) {
      expect(dotNames.has(p.name.cz), `${p.name.cz} is both a bubble and a dot`).toBe(false);
    }
  });

  it('names a bundled photo file, since nothing is fetched', () => {
    for (const p of PLACES) {
      if (p.photo !== undefined) expect(p.photo).toMatch(/^[a-z0-9-]+-full\.jpg$/);
    }
  });

  it('keeps a surveyed place even before its photograph arrives', () => {
    // A place without `photo` draws nothing at all — but its coordinate stays
    // here, so adding the photo later is one field, not another survey.
    expect(PLACES.some((p) => p.photo === undefined)).toBe(true);
  });
});
