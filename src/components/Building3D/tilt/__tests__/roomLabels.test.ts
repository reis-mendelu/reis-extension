import { describe, expect, it } from 'vitest';
import { labelAnchors, placeLabels } from '../roomLabels';
import { makeProjector } from '../../projection';
import type { RoomFeature } from '../../../../types/campusMap';

const ANCHOR: [number, number] = [16.6142, 49.2096];
const room = (
  id: number,
  name: string,
  d: number,
  lng = 16.6142,
  category: RoomFeature['properties']['category'] = 'teaching'
): RoomFeature => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [lng, 49.2096],
        [lng + d, 49.2096],
        [lng + d, 49.2096 + d],
        [lng, 49.2096 + d],
        [lng, 49.2096],
      ],
    ],
  },
  properties: {
    id,
    buildingId: 0,
    floorId: 2,
    floorLevel: 3,
    name,
    nickname: null,
    type: 'classroom',
    category,
    label: 'Classroom',
    passportNumber: null,
    seats: null,
    hasProjector: false,
    hasWhiteboard: false,
    code: null,
  },
});

describe('labelAnchors', () => {
  const project = makeProjector(ANCHOR);
  it('labels the named rooms big enough to carry one, as the flat plan does', () => {
    const a = labelAnchors([room(1, 'Q38', 0.0002), room(2, 'Q-WC', 0.00005)], project, 18.8, 99);
    expect(a.map((x) => x.text)).toEqual(['Q38']);
  });

  it('skips the lit room, which the pin already names, and unnamed rooms', () => {
    const a = labelAnchors([room(1, 'Q39', 0.0002), room(2, '', 0.0002)], project, 18.8, 1);
    expect(a).toEqual([]);
  });

  it('never labels a structural shape, which the flat plan does not either', () => {
    expect(labelAnchors([room(1, 'Zeď', 0.0002, 16.6142, 'structure')], project, 18.8, 99)).toEqual(
      []
    );
  });

  // Leaflet's tooltip sits at the polygon's area centroid; for an L-shaped room
  // the bounding box's centre can fall outside the room altogether.
  it('sits at the room’s centroid, as the flat plan’s label does', () => {
    const d = 0.0003;
    const L: RoomFeature = {
      ...room(1, 'Q-L', d),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [16.6142, 49.2096],
            [16.6142 + d, 49.2096],
            [16.6142 + d, 49.2096 + d / 3],
            [16.6142 + d / 3, 49.2096 + d / 3],
            [16.6142 + d / 3, 49.2096 + d],
            [16.6142, 49.2096 + d],
            [16.6142, 49.2096],
          ],
        ],
      },
    };
    const [a] = labelAnchors([L], project, 18.8, 99);
    const [bx] = project([16.6142 + d / 2, 49.2096]);
    expect(a!.x).toBeLessThan(bx); // pulled toward the L's corner, off the box centre
  });

  it('sits on the floor, at the room’s centre', () => {
    const [a] = labelAnchors([room(1, 'Q38', 0.0002)], project, 18.8, 99);
    expect(a!.y).toBeGreaterThan(18.8);
    expect(a!.x).toBeGreaterThan(0);
    expect(a!.z).toBeLessThan(0); // north of the anchor is −z
  });
});

describe('placeLabels', () => {
  const box = (x: number, y: number) => ({ x, y, w: 30, h: 12 });
  it('drops a label that would overlap one already placed', () => {
    expect(placeLabels([box(100, 100), box(110, 102), box(200, 100)], 390, 800, [])).toEqual([
      0, 2,
    ]);
  });

  it('drops labels under the pin and outside the view', () => {
    const pin = { x: 90, y: 90, w: 60, h: 30 };
    expect(placeLabels([box(100, 100), box(-20, 50), box(300, 300)], 390, 800, [pin])).toEqual([2]);
  });
});
