import { describe, expect, it } from 'vitest';
import { coreShapeIds, roomDirections, stairCores } from '../roomDirections';
import type { RoomFeature } from '../../../types/campusMap';

// A 100 × 60 m courtyard building around (0, 0), in metres; converted to degrees.
const LNG0 = 16.6142;
const LAT0 = 49.2096;
const M_LNG = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const M_LAT = 111320;
const at = (x: number, y: number): [number, number] => [LNG0 + x / M_LNG, LAT0 + y / M_LAT];

let nextId = 1;
function feature(
  x: number,
  y: number,
  level: number,
  type: string,
  label: string,
  name = '',
  size = 4
): RoomFeature {
  const ring = [at(x, y), at(x + size, y), at(x + size, y + size), at(x, y + size), at(x, y)];
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      id: nextId++,
      buildingId: 0,
      floorId: level + 10,
      floorLevel: level,
      name,
      nickname: null,
      type,
      category: type === 'classroom' ? 'teaching' : 'structure',
      label,
      passportNumber: null,
      seats: null,
      hasProjector: false,
      hasWhiteboard: false,
      code: null,
    },
  };
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Corner rooms give the building its extent; cores sit west and east. */
function building() {
  const rooms: RoomFeature[] = [];
  for (const level of range(-1, 5)) {
    rooms.push(
      feature(-50, -30, level, 'office', 'Office'),
      feature(46, 26, level, 'office', 'Office')
    );
  }
  for (const level of range(-1, 3)) {
    rooms.push(feature(-44, 10, level, 'stairs', 'Stairs')); // west stairs, -1..3
    rooms.push(feature(-44, 4, level, 'elevator', 'Elevator')); // west lift beside them
  }
  for (const level of range(-1, 5)) rooms.push(feature(40, 0, level, 'stairs', 'Stairs')); // east, -1..5
  for (const level of range(1, 5))
    rooms.push(feature(0, 26, level, 'emergency_stairs', 'Emergency stairs'));
  return rooms;
}
const DOOR = { at: at(50, 2), level: 0 };

describe('stairCores', () => {
  it('stacks a staircase across floors, joins the lift beside it, names the side', () => {
    const cores = stairCores(building());
    const west = cores.find((c) => c.side === 'west');
    expect(west).toMatchObject({ lift: true, levels: range(-1, 3) });
    expect(cores.find((c) => c.side === 'east')).toMatchObject({
      lift: false,
      levels: range(-1, 5),
    });
  });

  // A dog-leg staircase drifts a few metres per landing: it is still one staircase.
  it('keeps a staircase that drifts floor by floor as one', () => {
    const shapes = [0, 1, 2, 3].map((l) => feature(-40 + l * 6, -20, l, 'stairs', 'Stairs'));
    const rooms = [
      ...shapes,
      feature(-50, -30, 0, 'office', 'Office'),
      feature(46, 26, 0, 'office', 'Office'),
    ];
    expect(stairCores(rooms).map((c) => c.levels)).toEqual([[0, 1, 2, 3]]);
  });

  // Drifted 18 m by floor 3: the step and the map use floor 3's own landing.
  it('carries each floor’s own landing of a drifting staircase', () => {
    const shapes = [0, 1, 2, 3].map((l) => feature(-40 + l * 6, -20, l, 'stairs', 'Stairs'));
    const room = feature(-20, -26, 3, 'classroom', 'Classroom', 'Q30', 4);
    const rooms = [
      ...shapes,
      room,
      feature(-50, -30, 0, 'office', 'Office'),
      feature(46, 26, 0, 'office', 'Office'),
    ];
    const core = roomDirections(rooms, room, DOOR)?.find((s) => s.kind === 'core');
    expect(core?.kind).toBe('core');
    if (core?.kind !== 'core') return;
    const floor3 = rooms.filter((f) => f.properties.floorLevel === 3);
    expect(coreShapeIds(floor3, core.at)).toEqual([shapes[3]!.properties.id]);
  });

  it('gives a lift to its nearest staircase only', () => {
    const rooms = [
      feature(-50, -30, 0, 'office', 'Office'),
      feature(46, 26, 0, 'office', 'Office'),
      feature(0, 0, 0, 'stairs', 'Stairs'),
      feature(10, 0, 0, 'stairs', 'Stairs'),
      feature(3, 0, 0, 'elevator', 'Elevator'), // 3 m from the first, 7 m from the second
    ];
    expect(stairCores(rooms).map((c) => c.lift)).toEqual([true, false]);
  });

  it('leaves out the emergency stairs, which are not a way in', () => {
    expect(stairCores(building())).toHaveLength(2);
  });
});

describe('roomDirections', () => {
  it('goes to the room’s floor first, by the core nearest the room that reaches it', () => {
    const rooms = building();
    const q39 = feature(-48, 14, 3, 'classroom', 'Classroom', 'Q39', 6);
    const steps = roomDirections([...rooms, q39], q39, DOOR);
    expect(steps).toEqual([
      { kind: 'enter', side: 'east', level: 0 },
      { kind: 'core', side: 'west', lift: true, direction: 'up', level: 3, at: expect.any(Array) },
      { kind: 'arrive', name: 'Q39', level: 3, byCore: true },
    ]);
  });

  it('takes only a core that reaches both the entrance floor and the room’s floor', () => {
    const rooms = building();
    const top = feature(-48, 14, 5, 'classroom', 'Classroom', 'Q55', 6); // west core stops at 3
    const core = roomDirections([...rooms, top], top, DOOR)?.find((s) => s.kind === 'core');
    expect(core).toMatchObject({ side: 'east', direction: 'up', level: 5 });
  });

  // A wing whose stairs do not reach the entrance floor (they start on floor 1):
  // nearer, but not a way from the door, so the core that does reach it is taken.
  it('passes over a nearer staircase that misses the entrance floor', () => {
    const rooms = building();
    for (const level of range(1, 3)) rooms.push(feature(-10, -24, level, 'stairs', 'Stairs'));
    const room = feature(-12, -26, 3, 'classroom', 'Classroom', 'Q33', 6);
    const core = roomDirections([...rooms, room], room, DOOR)?.find((s) => s.kind === 'core');
    expect(core).toMatchObject({ side: 'west', level: 3 });
  });

  it('goes down to a basement room', () => {
    const rooms = building();
    const low = feature(30, -20, -1, 'classroom', 'Classroom', 'Q01.09', 6);
    const core = roomDirections([...rooms, low], low, DOOR)?.find((s) => s.kind === 'core');
    expect(core).toMatchObject({ direction: 'down', level: -1 });
  });

  it('skips the stairs for a room on the entrance floor', () => {
    const rooms = building();
    const q07 = feature(-20, 0, 0, 'classroom', 'Classroom', 'Q07', 6);
    expect(roomDirections([...rooms, q07], q07, DOOR)?.map((s) => s.kind)).toEqual([
      'enter',
      'arrive',
    ]);
  });

  it('gives no directions when no core reaches the room’s floor', () => {
    const rooms = building();
    const attic = feature(-48, 14, 7, 'classroom', 'Classroom', 'Q71', 6);
    expect(roomDirections([...rooms, attic], attic, DOOR)).toBeNull();
  });
});

describe('coreShapeIds', () => {
  it('finds the staircase and its lift on a floor, to light them as the route', () => {
    const rooms = building();
    const west = stairCores(rooms).find((c) => c.side === 'west')!;
    const onFloor = rooms.filter((f) => f.properties.floorLevel === 0);
    const ids = coreShapeIds(onFloor, west.at);
    const types = onFloor
      .filter((f) => ids.includes(f.properties.id))
      .map((f) => f.properties.type);
    expect(types.sort()).toEqual(['elevator', 'stairs']);
  });

  it('lights only its own staircase, not a second one a few metres off', () => {
    const rooms = building();
    rooms.push(feature(-44, 20, 0, 'stairs', 'Stairs')); // another staircase 10 m north
    const west = stairCores(rooms).find((c) => c.side === 'west' && c.lift)!;
    const onFloor = rooms.filter((f) => f.properties.floorLevel === 0);
    const lit = onFloor.filter((f) => coreShapeIds(onFloor, west.at).includes(f.properties.id));
    expect(lit.filter((f) => f.properties.type === 'stairs')).toHaveLength(1);
  });

  it('lights nothing on a floor the staircase does not reach', () => {
    const rooms = building();
    const west = stairCores(rooms).find((c) => c.side === 'west')!;
    expect(
      coreShapeIds(
        rooms.filter((f) => f.properties.floorLevel === 5),
        west.at
      )
    ).toEqual([]);
  });
});
