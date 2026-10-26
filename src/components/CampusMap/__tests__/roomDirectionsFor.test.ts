import { afterEach, describe, expect, it, vi } from 'vitest';
import { directionsFor } from '../roomDirectionsFor';
import type { RoomsCollection } from '../../../types/campusMap';
import { q39Plan } from '../../../test/fixtures/q39Plan';

const { q39, rooms: plan } = q39Plan();
const rooms: Record<number, RoomsCollection> = { 0: plan };
const sel = { kind: 'room' as const, room: q39.properties };

afterEach(() => vi.unstubAllEnvs());

describe('directionsFor', () => {
  it('is off with the 3D flag, so no shell changes', () => {
    expect(directionsFor(sel, rooms)).toBeNull();
  });

  it('gives Q39 its steps with the flag on', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    const d = directionsFor(sel, rooms);
    expect(d?.label).toBe('Q39');
    expect(d?.level).toBe(3);
    expect(d?.steps.map((s) => s.kind)).toEqual(['enter', 'core', 'arrive']);
  });

  it('covers only the buildings on the entrance list', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    const other = { kind: 'room' as const, room: { ...q39.properties, buildingId: 3 } };
    expect(directionsFor(other, { 3: rooms[0]! })).toBeNull();
  });

  it('waits for the building’s plan', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    expect(directionsFor(sel, {})).toBeNull();
  });
});
