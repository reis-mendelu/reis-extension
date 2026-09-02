import { useAppStore } from '../src/store/useAppStore';
import { resolveDevPhoneOverride } from '../src/utils/resolveDevPhoneOverride';

// Dev-only phone override. The viewport half of the real rule (`isNarrow`)
// flips when you resize, but the touch half (`pointer: coarse`) never does in a
// desktop browser — resizing is not touch emulation — so the app would stay
// desktop at phone widths. Here we follow the width alone, which is what you
// want from a dev viewport preset.
//
// `?mobile=1` / `?mobile=0` still pin the layout and win over width, both as a
// manual escape hatch and because e2e/serenity/specs/mobile-shell.spec.ts drives
// the phone branch that way.
//
// Guarded by import.meta.env.DEV so it cannot ship.
if (import.meta.env.DEV) {
  const search = new URLSearchParams(window.location.search);
  const param = search.get('mobile');
  const pinned = param === '1' || param === '0';

  // `?welcome=1` forces the first-run welcome. Nothing hydrates `welcomeSeen`
  // on the web host (only the Capacitor boot does), so without this the screen
  // is unreachable here and `verify-ui` could never measure it.
  if (search.get('welcome') === '1') useAppStore.setState({ welcomeSeen: false });

  const apply = (isNarrow: boolean) => {
    useAppStore.getState().setDevPhoneOverride(resolveDevPhoneOverride({ param, isNarrow }));
  };

  let lastIsNarrow = useAppStore.getState().isNarrow;
  apply(lastIsNarrow);

  // The store has no subscribeWithSelector middleware, so this fires on every
  // change; the equality guard is what keeps it from re-entering through
  // setDevPhoneOverride's own set().
  if (!pinned) {
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.isNarrow === lastIsNarrow) return;
      lastIsNarrow = state.isNarrow;
      apply(lastIsNarrow);
    });

    // A side-effect module with no accept handler normally forces a full page
    // reload, which would drop this listener anyway — but disposing explicitly
    // means we don't have to depend on that, and a hot re-eval can't stack a
    // second listener holding a stale `param`.
    import.meta.hot?.dispose(() => unsubscribe());
  }
}
