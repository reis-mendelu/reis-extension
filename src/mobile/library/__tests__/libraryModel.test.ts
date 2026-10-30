import { describe, it, expect } from 'vitest';
import { libraryTints, roomsOpenCount, TINT_BLUE, TINT_GREEN, TINT_GREY } from '../libraryModel';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import type { Block } from '../availability';

const DAY = '2026-11-10';
const now = new Date(2026, 10, 10, 6, 0);
const open: Block[] = [{ status: 'free', start: `${DAY}T07:00`, end: `${DAY}T19:00` }];
const [ind1, ind2, team1] = LIBRARY_ROOMS;

describe('libraryTints', () => {
  it('colours individual rooms blue and team rooms green, with short names', () => {
    const blocks = Object.fromEntries(LIBRARY_ROOMS.map((r) => [r.featureId, open]));
    const t = libraryTints(blocks, DAY, now, 'cz');
    expect(t[ind1!.featureId]).toEqual({ fill: TINT_BLUE, label: 'Ind. 1', group: 'main' });
    expect(t[team1!.featureId]).toEqual({ fill: TINT_GREEN, label: 'Tým 1', group: 'main' });
  });
  it('greys a room with no free hour left, and names it in English', () => {
    const blocks = { [ind1!.featureId]: [] as Block[], [ind2!.featureId]: open };
    const t = libraryTints(blocks, DAY, now, 'en');
    expect(t[ind1!.featureId]!.fill).toBe(TINT_GREY);
    expect(t[ind2!.featureId]!.fill).toBe(TINT_BLUE);
  });
  it('keeps the kind colour while availability is unknown', () => {
    const t = libraryTints({}, DAY, now, 'cz');
    expect(t[ind1!.featureId]!.fill).toBe(TINT_BLUE);
  });
});

describe('roomsOpenCount', () => {
  it('counts rooms with at least one bookable hour', () => {
    const blocks = { [ind1!.featureId]: open, [ind2!.featureId]: [] as Block[] };
    expect(roomsOpenCount(blocks, DAY, now)).toBe(1);
  });
});
