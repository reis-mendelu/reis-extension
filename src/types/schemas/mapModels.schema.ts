import { z } from 'zod';
import type { BuildingModel } from '../buildingModel';

// Runtime schema for the 'map_models' IndexedDB store. Same stance as
// mapRooms.schema.ts: structure, not domain — validation is fail-closed, so a
// schema too strict here would silently throw away a good model.
//
// The glb is an ArrayBuffer. `instanceof` alone is unsafe across realms (a
// buffer cloned out of IndexedDB can come from a different global in tests),
// so the tag check backs it up.
const ArrayBufferSchema = z.custom<ArrayBuffer>(
  (v) => v instanceof ArrayBuffer || Object.prototype.toString.call(v) === '[object ArrayBuffer]'
);

const StoreySchema = z
  .object({ level: z.number(), elevation: z.number(), height: z.number() })
  .passthrough();

const MetaSchema = z
  .object({
    buildingId: z.number(),
    name: z.string(),
    anchor: z.tuple([z.number(), z.number()]),
    baseElevation: z.number(),
    storeys: z.array(StoreySchema),
    ground: z.object({ a: z.number(), b: z.number(), c: z.number() }),
    radius: z.number(),
    height: z.number(),
    defaultAzimuthDeg: z.number(),
    attribution: z.string(),
  })
  .passthrough();

export const BuildingModelSchema = z
  .object({ glb: ArrayBufferSchema, meta: MetaSchema, fetchedAt: z.number() })
  .passthrough() as unknown as z.ZodType<BuildingModel>;
