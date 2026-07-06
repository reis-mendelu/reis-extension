import { z } from 'zod';
import type { RoomsCollection } from '../campusMap';

// Runtime schema for the 'map_rooms' IndexedDB store (was a `z.custom` no-op).
//
// Design: validate STRUCTURE, not domain. IndexedDBService.validate() is
// fail-closed (a parse failure drops the value on write / hides it on read),
// so the schema must never reject genuine data. Therefore:
//  - only structural anchors are required (type, features array, each
//    feature's geometry/coordinates and properties.id/buildingId/name);
//  - `.passthrough()` keeps unknown/future fields from failing a parse;
//  - `category` (a closed TS union today) is widened to z.string() so a new
//    scraper-introduced category can't drop the whole room.
// It still catches real corruption: null/non-object roots or a non-array
// `features`.

const RoomPropertiesSchema = z
  .object({
    id: z.number(),
    buildingId: z.number(),
    floorId: z.number(),
    floorLevel: z.number().nullable(),
    name: z.string(),
    type: z.string(),
    category: z.string(),
    label: z.string(),
    passportNumber: z.string().nullable(),
    seats: z.number().nullable(),
    hasProjector: z.boolean(),
    hasWhiteboard: z.boolean(),
    code: z.number().nullable(),
  })
  .passthrough();

const RoomFeatureSchema = z
  .object({
    type: z.literal('Feature'),
    geometry: z
      .object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
      })
      .passthrough(),
    properties: RoomPropertiesSchema,
  })
  .passthrough();

export const RoomsCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(RoomFeatureSchema),
  })
  .passthrough() as unknown as z.ZodType<RoomsCollection>;
