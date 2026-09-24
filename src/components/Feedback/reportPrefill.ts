import { useAppStore } from '../../store/useAppStore';

/**
 * One key per entry point. Reports are counted per entry point by grouping
 * `suggestions` on the exact title, so every resolved title must be distinct.
 */
export type ReportPrefillKey =
  'examsEmpty' | 'subjectsEmpty' | 'syllabusEmpty' | 'zaznamnikEmpty' | 'examActionFailed';

export const REPORT_TOAST_DURATION_MS = 10_000;

/**
 * Options for a failure toast that offers to report it. The prefill is our own
 * string, never the toast's text: an IS error message can carry student data.
 */
export function reportToastOptions(t: (key: string) => string, prefill: ReportPrefillKey) {
  return {
    duration: REPORT_TOAST_DURATION_MS,
    action: {
      label: t('feedback.reportAction'),
      onClick: () => useAppStore.getState().openReport({ title: t(`feedback.prefill.${prefill}`) }),
    },
  };
}
