import type { FollowSlice } from '../createFollowSlice';
import { IndexedDBService } from '../../../services/storage';
import { STORAGE_KEY, CHOSEN_KEY } from './loadFollows';
import { ensureLoaded, persistField } from './followLoadState';

type SetFollows = (patch: Partial<FollowSlice>) => void;
type GetFollows = () => FollowSlice;

/**
 * `createFollowSlice`'s `toggleFollow`, here to keep the slice under 200 lines.
 *
 * Computes from what disk holds, never from a `[]` that only stands in for
 * it. `ensureLoaded` covers the cold boot; `followsListRead` covers a load
 * whose read of the saved list FAILED, which leaves `followed` at `[]` while
 * disk still holds the student's list. Persisting a toggle computed from that
 * would replace their follows with one society. So: one retry of the read,
 * and if it fails again the change is kept for this session only.
 */
export async function toggleFollowAction(
  id: string,
  set: SetFollows,
  get: GetFollows
): Promise<void> {
  await ensureLoaded(get);
  if (!get().followsListRead) await get().loadFollows();

  const current = get().followed;
  const followed = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];

  if (!get().followsListRead) {
    // Memory only: no `persistField`, so no version bump, and not resolved.
    // Either would let a later load take this `[]`-based list for an answer
    // (and the next toggle persist it). A later load that reads disk replaces
    // it with the saved list; one whose read fails leaves it alone.
    set({ followed });
    get().replanNotifications();
    return;
  }

  // A hand-made choice is a resolved list, whatever the load came back with.
  set({ followed, followsResolved: true });
  await persistField('followed', 'Follows.toggle', async () => {
    // CHOSEN_KEY first, deliberately. There are two writes and no transaction
    // across them, so one of the two orders has to be safe: marking "chosen"
    // before the list means a crash between them leaves the OLD list marked
    // as settled, which is merely stale. The other order leaves the new list
    // unmarked — and if that list is empty, the next boot treats the
    // student's deliberate choice as an unresolved lookup and undoes it.
    await IndexedDBService.set('meta', CHOSEN_KEY, true);
    await IndexedDBService.set('meta', STORAGE_KEY, followed);
  });
  get().replanNotifications();
}
