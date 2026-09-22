import { IndexedDBService } from '../src/services/storage';
import { loadRealDataSnapshot } from '../src/services/loadRealDataSnapshot';

/**
 * Give the dev webapp a `reis_user_params` so the snapshot's assignments and
 * practice tests can land.
 *
 * `useAppLogic`'s `REIS_SYNC_UPDATE` handler keys `odevzdavarny` and
 * `cvicneTests` by `${studium}_${obdobi}`, and skips both branches outright
 * when there are no params. Inside the extension those come off the live IS
 * page; at `localhost:3000` the same fetch is blocked by CORS, so the store
 * held **zero** assignments and zero practice tests however good the snapshot
 * was — silently, since the screens that read them have empty states.
 *
 * That made two surfaces unverifiable rather than merely unpopulated: the
 * calendar's deadline strip and the Novinky sheet's whole first group, both of
 * which are built entirely from `useDeadlineAlerts`. `dev/fixtures/notificationFeed.json`
 * exists to fill them, and could not.
 *
 * The values are only IDB key material here — nothing in the dev webapp can
 * reach IS with them — so a synthetic pair is enough, and it is written only
 * when there is genuinely nothing there, so a session that DID get real params
 * keeps them.
 *
 * Reloading the snapshot afterwards is the point: the app has already posted it
 * once, before this write landed. `loadRealDataSnapshot` just re-posts the same
 * message through the same production handler, and every branch it feeds is a
 * keyed `set`, so a second pass writes the same rows to the same keys.
 *
 * DEV-gated and in `dev/`, so it cannot reach the extension or the app.
 */
if (import.meta.env.DEV) {
  void (async () => {
    try {
      const existing = (await IndexedDBService.get('meta', 'reis_user_params')) ?? {};
      // Field by field, never wholesale. The guard used to be "bail if studium
      // and obdobi are set", which meant a profile created by an earlier
      // session — before this file seeded anything else — could never gain a
      // field added later: the record existed, so the whole write was skipped.
      // Filling only what is absent keeps the original promise (a session that
      // got REAL params keeps every one of them) without freezing the seed at
      // whatever the first run happened to write.
      const defaults: Record<string, unknown> = {
        studium: 'dev-studium',
        obdobi: 'dev-obdobi',
      };
      const missing = Object.entries(defaults).filter(
        ([key]) => (existing as Record<string, unknown>)[key] == null
      );
      if (missing.length === 0) return;
      await IndexedDBService.set('meta', 'reis_user_params', {
        ...existing,
        ...Object.fromEntries(missing),
      });
      await loadRealDataSnapshot();
    } catch {
      // A dev convenience: if IDB is unavailable the app still boots, just
      // without assignments — exactly the state this file was added to fix.
    }
  })();
}
