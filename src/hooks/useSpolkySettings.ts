import { useAppStore } from '../store/useAppStore';

/**
 * A student's followed societies, read from the store.
 *
 * The loading and auto-follow logic (faculty defaults, ESN for Erasmus, the
 * one-time retry of an empty unchosen list, renamed-id migration) lives in
 * `createFollowSlice`/`loadFollows` now, triggered once at boot. This hook is
 * a thin reader over that state, kept for its existing callers' shape —
 * `subscribedAssociations`, `toggleAssociation`, `isSubscribed`, `isLoading`.
 * The store notifies every subscriber on a change, so there is no
 * `reis-spolky-settings-changed` event to listen for any more.
 */
export function useSpolkySettings() {
  const followed = useAppStore((s) => s.followed);
  const loaded = useAppStore((s) => s.followsLoaded);
  const toggleFollow = useAppStore((s) => s.toggleFollow);

  return {
    subscribedAssociations: followed,
    toggleAssociation: toggleFollow,
    isSubscribed: (id: string) => followed.includes(id),
    isLoading: !loaded,
  };
}
