import { z } from 'zod';

// Runtime schema for the 'meta' IndexedDB store (was z.any()).
//
// Unlike every other store, 'meta' is a genuine heterogeneous key-value bucket:
// dozens of unrelated call sites (feature flags, sync timestamps, UI hints,
// tokens, caches, dismissal flags, arrays of ids...) each own a single key and
// store a value of whatever shape suits them — there is no single TS type for
// "a meta value". Enumerating every key's shape here would be both huge and
// fragile: any site not accounted for would have its legitimate value dropped
// by IndexedDBService.validate() (fail-closed).
//
// So the tightening that's actually safe here is structural at the JSON-value
// level, not per-key: accept any value the structured-clone/IDB round-trip can
// legitimately hold (string/number/boolean/null/array/plain object, arbitrarily
// nested), and reject only genuine corruption — undefined, functions, symbols,
// or other values that were never valid to store in the first place.
const MetaValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(MetaValueSchema),
    z.record(z.string(), MetaValueSchema),
  ])
);

export const MetaSchema = MetaValueSchema;
