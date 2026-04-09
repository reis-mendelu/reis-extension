import type { PulseSlice, AppSlice } from '../types';

export const createPulseSlice: AppSlice<PulseSlice> = (set) => ({
    now: new Date(),
    updatePulse: () => {
        set({ now: new Date() });
    },
});
