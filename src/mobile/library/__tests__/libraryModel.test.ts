import { describe, it, expect } from 'vitest';
import { libraryTints, TINT_FREE, TINT_FULL, TINT_PENDING } from '../libraryModel';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import type { Block } from '../availability';

const DAY = '2026-11-10';
const now = new Date(2026, 10, 10, 6, 0);
const open: Block[] = [{ status: 'free', start: `${DAY}T07:00`, end: `${DAY}T19:00` }];
const [ind1, ind2, team1] = LIBRARY_ROOMS;

describe('libraryTints', () => {
  it('colours a room by whether it has an hour, and labels it with its one name', () => {
    const blocks = Object.fromEntries(LIBRARY_ROOMS.map((r) => [r.featureId, open]));
    const t = libraryTints(blocks, DAY, now, 'cz');
    expect(t[ind1!.featureId]).toEqual({ fill: TINT_FREE, label: 'Individuální 1' });
    expect(t[team1!.featureId]).toEqual({ fill: TINT_FREE, label: 'Týmová 1' });
  });
  it('greys a room with no free hour left, and names it in English', () => {
    const blocks = { [ind1!.featureId]: [] as Block[], [ind2!.featureId]: open };
    const t = libraryTints(blocks, DAY, now, 'en');
    expect(t[ind1!.featureId]).toEqual({ fill: TINT_FULL, label: 'Individual 1' });
    expect(t[ind2!.featureId]!.fill).toBe(TINT_FREE);
  });
  it('never draws a room as free before the library has answered', () => {
    const t = libraryTints({ [ind2!.featureId]: null }, DAY, now, 'cz');
    expect(t[ind1!.featureId]).toEqual({
      fill: TINT_PENDING,
      label: 'Individuální 1',
      pending: true,
    });
    expect(t[ind2!.featureId]!.pending).toBe(true);
  });
});
