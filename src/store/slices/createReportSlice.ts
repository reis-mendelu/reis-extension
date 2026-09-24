import type { AppSlice } from '../types';

/** Our own string only — never IS text, which can carry studium=/predmet= data. */
export interface ReportPrefill {
  title: string;
}

export interface ReportSlice {
  reportOpen: boolean;
  reportPrefill: ReportPrefill | null;
  /** Bumps on every open; the host keys the form on it so each open starts fresh. */
  reportSeq: number;
  openReport: (prefill?: ReportPrefill) => void;
  closeReport: () => void;
}

export const createReportSlice: AppSlice<ReportSlice> = (set, get) => ({
  reportOpen: false,
  reportPrefill: null,
  reportSeq: 0,
  openReport: (prefill) => {
    if (get().reportOpen) return;
    set((s) => ({ reportOpen: true, reportPrefill: prefill ?? null, reportSeq: s.reportSeq + 1 }));
  },
  closeReport: () => set({ reportOpen: false, reportPrefill: null }),
});
