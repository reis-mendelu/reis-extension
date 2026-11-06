import { describe, it, expect } from 'vitest';
import { dimsOtherRooms } from '../dimsOtherRooms';
import type { RoomProperties } from '../../../types/campusMap';

const tints = { 7: { fill: '#000', label: 'x', group: 'a' } };
const room = (id: number) => ({ kind: 'room', room: { id } as RoomProperties }) as const;

describe('dimsOtherRooms', () => {
  it('quietens the floor while the tinted rooms are the question', () => {
    expect(dimsOtherRooms({ kind: 'library', group: 'main' }, tints)).toBe(true);
    expect(dimsOtherRooms(room(7), tints)).toBe(true);
  });
  it('leaves an ordinary floor alone', () => {
    expect(dimsOtherRooms(room(8), tints)).toBe(false);
    expect(dimsOtherRooms(null, tints)).toBe(false);
    expect(dimsOtherRooms({ kind: 'library' }, {})).toBe(false);
  });
});
