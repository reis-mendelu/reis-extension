import type { ViewportSlice, AppSlice } from '../types';

type ViewportPatch = Partial<
  Pick<ViewportSlice, 'isTouch' | 'isNarrow' | 'isPortrait' | 'keyboardOpen' | 'viewportHeight'>
>;

// Seeded synchronously from matchMedia so the very first render already knows
// whether this is a touch/narrow (phone) device — the same queries AppShell
// uses post-paint. Without this, the first frame always renders the desktop
// tree (isTouch/isNarrow default false), mounts its data hooks, paints, then
// throws it away once AppShell's effect runs and flips to MobileApp.
function initialIsTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

function initialIsNarrow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

export const createViewportSlice: AppSlice<ViewportSlice> = (set) => ({
  isTouch: initialIsTouch(),
  isNarrow: initialIsNarrow(),
  isPortrait: true,
  keyboardOpen: false,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  setViewport: (patch: ViewportPatch) =>
    set((s) => {
      // Idempotent: only emit a change if at least one value differs.
      for (const key of Object.keys(patch) as Array<keyof ViewportPatch>) {
        const v = patch[key];
        if (v !== undefined && s[key] !== v) {
          return { ...patch };
        }
      }
      return {};
    }),
});
