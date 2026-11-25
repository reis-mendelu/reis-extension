import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RoomShape } from '../../components/CampusMap/iso/RoomShape';
import type { RoomFeature } from '../../types/campusMap';

/** A lift is a plain beige box in the floor plan; it carries an up-and-down arrow so it does not read as an empty room. */

const feature = (type: string, category: string) =>
  ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[]] },
    properties: { id: 1, type, category, name: '' },
  }) as unknown as RoomFeature;
const ring: [number, number][] = [
  [100, 100],
  [130, 100],
  [130, 130],
  [100, 130],
];
const draw = (f: RoomFeature, selected = false) =>
  render(
    <svg>
      <RoomShape f={f} ring={ring} selected={selected} />
    </svg>
  );

describe('lift icon in the isometric floor', () => {
  it('draws an arrow in a lift, between its top and bottom edges', () => {
    const { getByTestId } = draw(feature('elevator', 'circulation'));
    const d = getByTestId('iso-lift').getAttribute('d')!;
    const ys = (d.match(/-?\d+(\.\d+)?/g) ?? []).filter((_, i) => i % 2 === 1).map(Number);
    expect(Math.min(...ys)).toBeGreaterThan(100);
    expect(Math.max(...ys)).toBeLessThan(130);
  });

  it('draws nothing in a classroom or a stairwell', () => {
    expect(draw(feature('classroom', 'teaching')).queryByTestId('iso-lift')).toBeNull();
    expect(draw(feature('stairs', 'circulation')).queryByTestId('iso-lift')).toBeNull();
  });
});
