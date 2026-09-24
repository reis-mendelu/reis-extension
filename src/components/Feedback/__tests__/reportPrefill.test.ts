import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../store/useAppStore';
import { translate } from '../../../i18n/translate';
import { reportToastOptions, REPORT_TOAST_DURATION_MS } from '../reportPrefill';

const t = (key: string) => translate('en', key);

beforeEach(() => useAppStore.setState({ reportOpen: false, reportPrefill: null }));

describe('reportToastOptions', () => {
  it('keeps the toast up long enough to press Report', () => {
    expect(reportToastOptions(t, 'examActionFailed').duration).toBe(REPORT_TOAST_DURATION_MS);
    expect(REPORT_TOAST_DURATION_MS).toBe(10_000);
  });

  it('labels the action and opens the form with our own title', () => {
    const { action } = reportToastOptions(t, 'examActionFailed');
    expect(action.label).toBe('Report');
    action.onClick();
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Exams: action failed' });
  });
});
