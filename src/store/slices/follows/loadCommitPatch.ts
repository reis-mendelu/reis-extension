import type { FollowSlice } from '../createFollowSlice';
import { FOLLOWS_READ_FAILED } from './loadFollows';
import { NOTIFY_READ_FAILED, type loadNotifySettings } from './loadNotifySettings';
import { isUnchangedSince, type FollowVersionField } from './followLoadState';

/**
 * What one `loadFollows()` commits, given what its two reads returned and the
 * versions it snapshotted before they started. Out of `createFollowSlice` to
 * keep it under 200 lines.
 *
 * A field a mutation touched since the snapshot (or is still persisting) is
 * left out, so the load does not revert it. A read that FAILED commits nothing
 * of its own either — neither its values nor the `*Read`/`followsResolved`
 * flags — so a transient failure never undoes a good earlier read, and the
 * defaults it stands for never look like the student's answer.
 */
export function loadCommitPatch(
  list: string[] | null | typeof FOLLOWS_READ_FAILED,
  notify: Awaited<ReturnType<typeof loadNotifySettings>>,
  versionsAtStart: Record<FollowVersionField, number>
): Partial<FollowSlice> {
  const patch: Partial<FollowSlice> = { followsLoaded: true };
  // A failed read says nothing about `followed`: it, `followsResolved` and
  // `followsListRead` stay as they were, so a transient failure neither
  // undoes a good earlier read nor makes its `[]` look like an answer.
  if (list !== FOLLOWS_READ_FAILED) {
    const followedUnchanged = isUnchangedSince('followed', versionsAtStart);
    patch.followsListRead = true;
    // `null` means loadFollowedList could not resolve anything this time
    // (getUserParams() came back empty — the boot race) rather than that
    // this student genuinely follows nothing. A toggle that landed on
    // `followed` during this load is just as much a resolved answer — it
    // is a hand-made choice, already persisted with CHOSEN_KEY — so it
    // must not leave a later `retryFollowsIfUnresolved()` blocked
    // forever waiting for a list that will never come.
    patch.followsResolved = list !== null || !followedUnchanged;
    if (followedUnchanged) patch.followed = list ?? [];
  }
  // Likewise a failed settings read: memory keeps what it has.
  if (notify !== NOTIFY_READ_FAILED) {
    patch.notifySettingsRead = true;
    if (isUnchangedSince('muted', versionsAtStart)) patch.muted = notify.muted;
    if (isUnchangedSince('notifyPrefs', versionsAtStart)) patch.notifyPrefs = notify.prefs;
    if (isUnchangedSince('permissionAsked', versionsAtStart)) {
      patch.permissionAsked = notify.asked;
    }
  }

  return patch;
}
