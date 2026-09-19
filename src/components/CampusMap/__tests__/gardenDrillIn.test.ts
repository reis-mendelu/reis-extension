import { describe, it, expect } from 'vitest';
import { drilledRemoteId } from '../mapLayers';
import { GARDEN_PLACES, GARDEN_PLACE_ID } from '../gardenBubbleLayer';
import type { MapSelection } from '../../../types/campusMap';

describe('drilledRemoteId', () => {
  it('keeps the garden open while one of its places is selected', () => {
    const sel: MapSelection = { kind: 'gardenPlace', place: GARDEN_PLACES[0]! };
    expect(drilledRemoteId(sel)).toBe(GARDEN_PLACE_ID);
  });

  it('still drills in on the site itself', () => {
    const sel: MapSelection = {
      kind: 'poi',
      poi: {
        id: GARDEN_PLACE_ID,
        name: 'Botanická zahrada',
        type: '',
        url: null,
        phone: null,
        email: null,
      },
      coord: [16.6132, 49.2135],
    };
    expect(drilledRemoteId(sel)).toBe(GARDEN_PLACE_ID);
  });

  it('is closed for nothing at all', () => {
    expect(drilledRemoteId(null)).toBeNull();
  });
});
