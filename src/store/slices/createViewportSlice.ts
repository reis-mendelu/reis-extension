import type { ViewportSlice, AppSlice } from '../types';

type ViewportPatch = Partial<Pick<ViewportSlice,
    'isTouch' | 'isNarrow' | 'isPortrait' | 'keyboardOpen' | 'viewportHeight'>>;

export const createViewportSlice: AppSlice<ViewportSlice> = (set) => ({
    isTouch: false,
    isNarrow: false,
    isPortrait: true,
    keyboardOpen: false,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    setViewport: (patch: ViewportPatch) => set((s) => {
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
