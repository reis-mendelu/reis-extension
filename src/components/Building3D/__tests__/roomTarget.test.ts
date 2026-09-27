import { describe, expect, it } from 'vitest';
import { cutTarget, nextTiltEntry, type RoomTarget } from '../roomTarget';

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

describe('nextTiltEntry', () => {
  it('remembers the scene an entry started with', () => {
    expect(nextTiltEntry(null, true, '3:171')).toEqual({ key: '3:171', moved: false });
  });

  // Back on the entry floor after a floor tap, the scene is rebuilt — and must
  // appear tilted, not replay the glide from the flat map.
  it('stays moved once the scene has changed, even back on the entry floor', () => {
    const moved = nextTiltEntry({ key: '3:171', moved: false }, true, '1:null');
    expect(moved).toEqual({ key: '3:171', moved: true });
    expect(nextTiltEntry(moved, true, '3:171')).toEqual({ key: '3:171', moved: true });
  });

  it('forgets the entry once the map is flat again', () => {
    expect(nextTiltEntry({ key: '3:171', moved: true }, false, '3:171')).toBeNull();
  });
});
