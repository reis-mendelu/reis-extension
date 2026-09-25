import { describe, it, expect, afterEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

afterEach(() => {
  useAppStore.setState({ reportOpen: false, reportPrefill: null });
});

describe('createReportSlice', () => {
  it('starts closed with no prefill', () => {
    expect(useAppStore.getState()).toMatchObject({ reportOpen: false, reportPrefill: null });
  });

  it('openReport opens with the prefill and bumps the sequence', () => {
    const before = useAppStore.getState().reportSeq;
    useAppStore.getState().openReport({ title: 'Zkoušky: prázdný seznam' });
    expect(useAppStore.getState()).toMatchObject({
      reportOpen: true,
      reportPrefill: { title: 'Zkoušky: prázdný seznam' },
      reportSeq: before + 1,
    });
  });

  it('a plain openReport has no prefill', () => {
    useAppStore.getState().openReport();
    expect(useAppStore.getState().reportPrefill).toBeNull();
  });

  // A toast's "Nahlásit" sits above the modal's backdrop. Pressing it while the
  // form is open must not remount the form and wipe what the student typed.
  it('is a no-op while the form is already open', () => {
    useAppStore.getState().openReport({ title: 'A' });
    const seq = useAppStore.getState().reportSeq;
    useAppStore.getState().openReport({ title: 'B' });
    expect(useAppStore.getState().reportSeq).toBe(seq);
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'A' });
  });

  it('closeReport closes and clears the prefill', () => {
    useAppStore.getState().openReport({ title: 'A' });
    useAppStore.getState().closeReport();
    expect(useAppStore.getState()).toMatchObject({ reportOpen: false, reportPrefill: null });
  });
});
