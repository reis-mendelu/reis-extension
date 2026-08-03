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
  const param = new URLSearchParams(window.location.search).get('mobile');
  const pinned = param === '1' || param === '0';

  const apply = (isNarrow: boolean) => {
    useAppStore.getState().setDevPhoneOverride(resolveDevPhoneOverride({ param, isNarrow }));
  };

  let lastIsNarrow = useAppStore.getState().isNarrow;
  apply(lastIsNarrow);

  // The store has no subscribeWithSelector middleware, so this fires on every
  // change; the equality guard is what keeps it from re-entering through
  // setDevPhoneOverride's own set().
  if (!pinned) {
    useAppStore.subscribe((state) => {
      if (state.isNarrow === lastIsNarrow) return;
      lastIsNarrow = state.isNarrow;
      apply(lastIsNarrow);
    });
  }
}
