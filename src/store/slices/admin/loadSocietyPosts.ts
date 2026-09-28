import { listMyPosts, type SpolkyEventRow } from '../../../api/societyPosts';
import { fetchEventRsvps } from '../../../api/eventRsvp';
import type { RsvpCounts } from '../createRsvpSlice';

/** What loadSocietyPosts needs from the slice: reading the active society (twice —
 *  once before each network call resolves, to guard against a stale response —
 *  see below), and writing the two things a load produces. */
interface LoadSocietyPostsAccess {
  activeAssociationId: () => string | null;
  setPosts: (posts: SpolkyEventRow[]) => void;
  setRsvpCounts: (counts: Record<string, RsvpCounts>) => void;
  /** MapSlice's own rebuild — societyMapEvents is derived from societyPosts. */
  refreshSocietyMapEvents: () => void;
}

/**
 * Pull the active society's own events, then their public interest counts.
 *
 * No society picked: clear the posts and still rebuild societyMapEvents (to
 * empty), rather than leaving a stale list of another society's events on
 * screen.
 *
 * Two picker changes in quick succession can resolve out of order. Without the
 * guard below the slower, older response wins and the console shows one
 * society's events under another's name — and delete/edit act on THOSE rows,
 * so the damage is to a society nobody is looking at. The same guard covers
 * the RSVP counts fetched afterwards, which race the same way.
 */
export async function loadSocietyPosts(access: LoadSocietyPostsAccess): Promise<void> {
  const associationId = access.activeAssociationId();
  if (!associationId) {
    access.setPosts([]);
    access.refreshSocietyMapEvents();
    return;
  }
  const posts = await listMyPosts(associationId);
  if (access.activeAssociationId() !== associationId) return;
  access.setPosts(posts);
  access.refreshSocietyMapEvents();
  // Interest per event, from the same public aggregate RPC the student card
  // uses — no new data flow. Not attendance: RSVPs count installs, and free
  // events see many no-shows, which is why the label says "v reIS".
  const { counts, ok } = await fetchEventRsvps(posts.map((p) => p.id));
  if (ok && access.activeAssociationId() === associationId) access.setRsvpCounts(counts);
}
