import { describe, it, expect } from 'vitest';
import { RoomsCollectionSchema } from '../mapRooms.schema';
import type { RoomsCollection } from '../../campusMap';

const realData: RoomsCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [16.6, 49.2],
            [16.61, 49.2],
            [16.61, 49.21],
            [16.6, 49.2],
          ],
        ],
      },
      properties: {
        id: 1,
        buildingId: 10,
        floorId: 100,
        floorLevel: 1,
        name: 'Q01',
        type: 'lecture-hall',
        category: 'teaching',
        label: 'Q01',
        passportNumber: '123',
        seats: 80,
        hasProjector: true,
        hasWhiteboard: true,
        code: 1,
      },
    },
  ],
};

describe('RoomsCollectionSchema', () => {
  it('accepts a representative real rooms collection (never drops valid data)', () => {
    expect(RoomsCollectionSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = {
      ...realData,
      futureField: 'x',
      features: [{ ...realData.features[0], brandNewFlag: true }],
    };
    expect(RoomsCollectionSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected category value (widened to string, no drift-drop)', () => {
    const drift = {
      ...realData,
      features: [
        {
          ...realData.features[0],
          properties: { ...realData.features[0]!.properties, category: 'new_kind' }, // safe: fixed literal
        },
      ],
    };
    expect(RoomsCollectionSchema.safeParse(drift).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(RoomsCollectionSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: features is not an array', () => {
    expect(RoomsCollectionSchema.safeParse({ ...realData, features: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: feature missing properties.id', () => {
    const { id: _id, ...noId } = realData.features[0]!.properties; // safe: fixed literal
    const corrupted = { ...realData, features: [{ ...realData.features[0], properties: noId }] };
    expect(RoomsCollectionSchema.safeParse(corrupted).success).toBe(false);
  });
});
