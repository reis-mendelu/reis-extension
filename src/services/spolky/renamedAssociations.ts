/**
 * Societies that have been renamed, old id → new id.
 *
 * A student's subscriptions persist as bare ids in IndexedDB
 * (`reis_subscribed_associations`), so renaming a society in the catalog
 * orphans everyone already subscribed to it: the stored id matches no profile,
 * its checkbox reads unchecked, and its events are filtered out of Novinky.
 * Silent, and it lands on exactly the students the rename is for — the same
 * shape of failure the CHOSEN_KEY comment in `useSpolkySettings` documents.
 *
 * So entries here are permanent. An id stays in this map for as long as any
 * install might still hold it, which in practice means forever: removing one
 * re-orphans every student who has not opened reIS since the rename.
 *
 * 2026-09-15: 'af' (AF Spolek) became 'usaf' (USAF).
 */
export const RENAMED_ASSOCIATION_IDS: Record<string, string> = {
  af: 'usaf',
};

/**
 * Apply the renames to a saved subscription list.
 *
 * Returns the SAME array instance when nothing changed, which is what lets the
 * caller skip an IndexedDB write on every boot for the students — the large
 * majority — who hold no renamed id.
 */
export function migrateAssociationIds(saved: string[]): string[] {
  let changed = false;
  const migrated: string[] = [];

  for (const id of saved) {
    const renamed = RENAMED_ASSOCIATION_IDS[id];
    if (renamed) changed = true;
    const next = renamed ?? id;
    // A student holding both spellings must come out with one entry: the list
    // feeds `includes` checks and a keyed render, so a duplicate would show the
    // society twice and untick both rows on a single toggle.
    if (migrated.includes(next)) changed = true;
    else migrated.push(next);
  }

  return changed ? migrated : saved;
}
