/**
 * Gap guards shared by sync-driven store setters.
 *
 * A transient or failed IS Mendelu fetch can resolve to an empty array / empty
 * record. Writing that straight into the store would wipe whatever is currently
 * on screen, producing a flash of no-data before the next sync repopulates it.
 *
 * `wouldWipePopulated` returns true when the incoming value is empty but the
 * store already holds data — the setter should then skip the update and keep
 * the populated value until real new data arrives to replace it.
 */

type Collection = readonly unknown[] | Record<string, unknown> | null | undefined;

export function isEmptyCollection(value: Collection): boolean {
    if (!value) return true;
    return Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
}

export function wouldWipePopulated(incoming: Collection, current: Collection): boolean {
    return isEmptyCollection(incoming) && !isEmptyCollection(current);
}
