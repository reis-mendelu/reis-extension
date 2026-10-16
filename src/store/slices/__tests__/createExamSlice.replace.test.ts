import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

/**
 * An empty exams push normally keeps the list on screen (a failed IS read
 * resolves to [] too). Right after a study switch the list is the previous
 * study's, and "none" is the new study's real answer.
 */
describe('setExams after a study switch', () => {
  beforeEach(() => {
    useAppStore.setState((s) => ({ exams: { ...s.exams, data: [{ code: 'OLD' }] as never } }));
  });

  it('keeps the list over an empty push, as before', () => {
    useAppStore.getState().setExams([]);
    expect(useAppStore.getState().exams.data).toHaveLength(1);
  });

  it('replaces it with an empty list when told to', () => {
    useAppStore.getState().setExams([], { replace: true });
    expect(useAppStore.getState().exams.data).toEqual([]);
  });
});
