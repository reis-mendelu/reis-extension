import { listMyPosts, type SpolkyEventRow } from '../../../api/societyPosts';

/** What loadSocietyPosts needs from the slice: reading the active society (twice —
 *  once before each network call resolves, to guard against a stale response —
 *  see below), and writing what a load produces. */
interface LoadSocietyPostsAccess {
  activeAssociationId: () => string | null;
  setPosts: (posts: SpolkyEventRow[]) => void;
  /** MapSlice's own rebuild — societyMapEvents is derived from societyPosts. */
  refreshSocietyMapEvents: () => void;
}

/**
 * Pull the active society's own events.
 *
 * No society picked: clear the posts and still rebuild societyMapEvents (to
 * empty), rather than leaving a stale list of another society's events on
 * screen.
 *
 * Two picker changes in quick succession can resolve out of order. Without the
 * guard below the slower, older response wins and the console shows one
 * society's events under another's name — and delete/edit act on THOSE rows,
 * so the damage is to a society nobody is looking at.
 *
 * The guard is a generation AND the id. The id alone let an A → B → A switch
 * apply the first A request over the second; the generation alone would let a
 * load still pending when the society was cleared repopulate the list.
 *
 * A failed read keeps what is on screen: after a publish, a blip must not wipe
 * the list. A society SWITCH clears the rows up front (setActiveAssociation),
 * so a failure there leaves an empty list, never the previous society's.
 */
let generation = 0;

export async function loadSocietyPosts(access: LoadSocietyPostsAccess): Promise<void> {
  const mine = ++generation;
  const associationId = access.activeAssociationId();
  if (!associationId) {
    access.setPosts([]);
    access.refreshSocietyMapEvents();
    return;
  }
  const current = () => mine === generation && access.activeAssociationId() === associationId;
  const posts = await listMyPosts(associationId);
  if (posts === null || !current()) return;
  access.setPosts(posts);
  access.refreshSocietyMapEvents();
}
