import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * The desktop drawer outlives a close, and so did its tab. Opening subject B
 * while the tab left over from A was Záznamník told the seen-hook B's
 * Záznamník was on screen for one commit, which cleared B's "Nové body"
 * before the tab reset. The tab must belong to the opening it is shown for.
 */
const { seenCalls } = vi.hoisted(() => ({
  seenCalls: [] as [string | undefined, string, boolean][],
}));
// Records on commit, as the real hook acts: a render React throws away (the
// tab reset restarts one) never reaches an effect.
vi.mock('../../../hooks/ui/useMarkZaznamnikSeen', async () => {
  const { useEffect } = await import('react');
  return {
    useMarkZaznamnikSeen: (code: string | undefined, tab: string, open: boolean) =>
      useEffect(() => void seenCalls.push([code, tab, open])),
  };
});
vi.mock('../../../hooks/data', () => ({
  useSchedule: () => ({ schedule: [] }),
  useFiles: () => ({ files: [], isLoading: false }),
  useSyncStatus: () => ({ isSyncing: false }),
  useSyllabus: () => ({}),
  useSubjects: () => ({ getSubject: () => ({ subjectId: '1' }) }),
  useClassmates: () => undefined,
}));
vi.mock('../useDragSelection', () => ({ useDragSelection: () => ({}) }));

import { useSubjectFileDrawerState } from '../useSubjectFileDrawerState';

const A = {
  courseCode: 'A',
  courseName: 'A',
  courseId: '1',
  id: 'a',
  initialTab: 'zaznamnik' as const,
};
const B = { courseCode: 'B', courseName: 'B', courseId: '2', id: 'b' };

describe('useSubjectFileDrawerState: the tab belongs to its opening', () => {
  beforeEach(() => void (seenCalls.length = 0));

  it('opening another subject without a tab never reports its Záznamník as shown', () => {
    const { rerender } = renderHook(
      ({ lesson, open }) => useSubjectFileDrawerState(lesson as never, open),
      { initialProps: { lesson: A as object, open: true } }
    );
    expect(seenCalls).toContainEqual(['A', 'zaznamnik', true]);

    rerender({ lesson: A, open: false });
    seenCalls.length = 0;
    rerender({ lesson: B, open: true });

    expect(seenCalls).not.toContainEqual(['B', 'zaznamnik', true]);
  });
});
