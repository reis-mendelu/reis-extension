import type { RoomCategory, RoomFeature, RoomsCollection } from '../../types/campusMap';

/**
 * Rooms the floor plan draws in pieces or mislabels, and what each really is.
 *
 * Building X's ground floor (buildingId 465899) splits its north row into
 * partitions typed `office`, plus a corridor strip. IS schedules AF and ZF
 * into them as X01, X02 and X03 (77 lessons, ZS 2026/2027), so a timetable room
 * had no polygon to point at. The two partitions below X01 (N1004A/B) are the
 * west end of Studovna X (N1004), and N1015, typed a balcony, is the MENDELU
 * Shop — a relabel, one member and no new outline.
 *
 * Evidence: Dominik's annotated floor plan (2026-09-24) circles exactly these
 * groups, and the estate codes agree — the A–D suffixes are subdivisions of
 * N1001/N1002/N1003/N1004. The kept member is always listed first. Each merged room keeps a real member's code and
 * feature id, so nothing here invents an identifier; `rooms-index.json` carries
 * the matching entry (guarded in `__tests__/mergedRooms.test.ts`).
 *
 * `ring` is the union of the members' outlines, computed once offline (shapely,
 * 6 dp, a 0.03 m² gap between X03's pieces filled) — the app has no polygon
 * union and should not grow one for four rooms. No `ring` keeps the member's own.
 */
export interface MergedRoom {
  /** Feature id and estate code taken from the first member. */
  id: number;
  name: string;
  nickname: string;
  type: string;
  category: RoomCategory;
  label: string;
  members: readonly string[];
  ring?: number[][];
}

const classroom = {
  type: 'classroom_and_laboratory',
  category: 'teaching',
  label: 'Classroom / lab',
} as const;

// Studovna X grown west over N1004A/B: 325 m² → 382 m², no overlap with any
// neighbour (checked against every building X ground-floor polygon).
const RING_STUDOVNA: number[][] = [
  [16.614535, 49.210324],
  [16.614471, 49.210402],
  [16.614878, 49.210547],
  [16.614881, 49.210544],
  [16.614894, 49.210549],
  [16.614951, 49.21048],
  [16.61495, 49.21048],
  [16.61495, 49.210479],
  [16.614949, 49.210479],
  [16.614949, 49.210476],
  [16.61495, 49.210476],
  [16.614951, 49.210475],
  [16.614955, 49.210475],
  [16.614973, 49.210454],
  [16.61478, 49.210385],
  [16.61476, 49.210409],
  [16.614719, 49.210394],
  [16.614722, 49.210391],
  [16.614675, 49.210374],
  [16.614535, 49.210324],
];

export const MERGED_ROOMS: readonly MergedRoom[] = [
  {
    ...classroom,
    id: 476030,
    name: 'BA25N1001',
    nickname: 'X01',
    members: ['BA25N1001', 'BA25N1001A', 'BA25N1001B', 'BA25N1001C', 'BA25N1001D'],
    ring: [
      [16.614475, 49.210406],
      [16.614442, 49.210446],
      [16.614416, 49.210477],
      [16.614497, 49.210506],
      [16.61455, 49.210524],
      [16.614598, 49.210467],
      [16.61461, 49.210452],
      [16.614587, 49.210444],
      [16.614586, 49.210445],
      [16.61454, 49.210429],
      [16.614475, 49.210406],
    ],
  },
  {
    ...classroom,
    id: 476021,
    name: 'BA25N1002A',
    nickname: 'X02',
    members: ['BA25N1002A', 'BA25N1002B', 'BA25N1002C', 'BA25N1002D'],
    ring: [
      [16.614607, 49.210467],
      [16.614558, 49.210527],
      [16.614603, 49.210543],
      [16.614689, 49.210574],
      [16.614738, 49.210515],
      [16.614747, 49.210503],
      [16.61464, 49.210464],
      [16.614641, 49.210463],
      [16.614617, 49.210455],
      [16.614607, 49.210467],
    ],
  },
  {
    ...classroom,
    id: 476027,
    name: 'BA25N1003A',
    nickname: 'X03',
    members: ['BA25N1003A', 'BA25N1003B', 'BA25N1003C'],
    ring: [
      [16.614744, 49.21052],
      [16.614697, 49.210577],
      [16.614774, 49.210604],
      [16.614827, 49.210623],
      [16.614886, 49.210552],
      [16.614832, 49.210533],
      [16.614779, 49.210514],
      [16.61478, 49.210513],
      [16.614757, 49.210505],
      [16.614744, 49.21052],
    ],
  },
  {
    ...classroom,
    id: 475906,
    name: 'BA25N1004',
    nickname: 'Studovna X',
    members: ['BA25N1004', 'BA25N1004A', 'BA25N1004B'],
    ring: RING_STUDOVNA,
  },
  {
    // A shop is not a teaching room; `other` is what the API gives its one
    // other shop (the wine shop), so it draws like every non-room space.
    id: 475900,
    name: 'BA25N1015',
    nickname: 'MENDELU Shop',
    type: 'shop',
    category: 'other',
    label: 'Shop',
    members: ['BA25N1015'],
  },
];

function mergedFeature(room: MergedRoom, template: RoomFeature): RoomFeature {
  return {
    type: 'Feature',
    geometry: room.ring ? { type: 'Polygon', coordinates: [room.ring] } : template.geometry,
    properties: {
      ...template.properties,
      id: room.id,
      name: room.name,
      nickname: room.nickname,
      passportNumber: room.name,
      type: room.type,
      category: room.category,
      label: room.label,
    },
  };
}

/**
 * Swaps each group's pieces for its one merged room, in place of the first piece.
 *
 * Applied on the way OUT of the API, like `dropSuppressedRooms`: the geometry is
 * CDN data cached for 30 days, so filtering what is returned is what reaches a
 * device that already holds building X. A collection with none of the pieces —
 * another building, or one already merged — comes back as the same object.
 */
export function mergeRoomGroups(rooms: RoomsCollection): RoomsCollection {
  let features = rooms.features;
  for (const room of MERGED_ROOMS) {
    const members = new Set(room.members);
    const present = features.filter((f) => members.has(f.properties.name));
    // Nothing to do: another building, or the one merged room is already here.
    if (present.length === 0) continue;
    if (present.length === 1 && present[0]!.properties.nickname === room.nickname) continue;
    const first = features.indexOf(present[0]!);
    const kept = present.find((f) => f.properties.name === room.name) ?? present[0]!;
    const merged = mergedFeature(room, kept);
    features = features.flatMap((f, i) =>
      i === first ? [merged] : members.has(f.properties.name) ? [] : [f]
    );
  }
  return features === rooms.features ? rooms : { ...rooms, features };
}
