import { describe, expect, it } from 'vitest';
import { cutTarget, type RoomTarget } from '../roomTarget';

const q39: RoomTarget = { buildingId: 0, floorLevel: 3, roomId: 171, label: 'Q39' };

describe('cutTarget', () => {
  it('cuts at the floor the floor column shows, and lights the room on it', () => {
    expect(cutTarget(q39, 0, 3)).toEqual({ level: 3, room: q39 });
  });

  // Tapping another floor while tilted clears the selection's floor match, not
  // the cut: the view follows the column instead of falling back to no cut.
  it('follows a floor tap and lights nothing on a floor without the room', () => {
    expect(cutTarget(q39, 0, 1)).toEqual({ level: 1, room: null });
    expect(cutTarget(null, 0, 1)).toEqual({ level: 1, room: null });
  });

  it('ignores a room in another building', () => {
    expect(cutTarget({ ...q39, buildingId: 5 }, 0, 3)).toEqual({ level: 3, room: null });
  });

  it("falls back to the room's own floor when the column has none", () => {
    expect(cutTarget(q39, 0, null)).toEqual({ level: 3, room: q39 });
  });
});
