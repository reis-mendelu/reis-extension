import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../services/sync/examTermsUnseen', () => ({
  clearUnseenTerms: vi.fn(async () => []),
  readUnseenTerms: vi.fn(async () => []),
}));

import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useMarkExamTermsSeen } from '../ui/useMarkExamTermsSeen';
import { useAppStore } from '../../store/useAppStore';
import { examTermKey } from '../../utils/newExamTerms';
import { clearUnseenTerms } from '../../services/sync/examTermsUnseen';
import type { ExamSubject } from '../../types/exams';

const NOW = new Date(2026, 11, 1, 12, 0);

const vwa: ExamSubject = {
  version: 1,
  id: 'EBC-VWA',
  name: 'Vývoj webových aplikací',
  code: 'EBC-VWA',
  sections: [
    {
      id: 'zk',
      name: 'zkouška',
      type: 'exam',
      status: 'open',
      terms: [{ id: '1', date: '14.12.2026', time: '11:00' }],
    },
  ],
};

describe('a new exam term in Novinky', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      odevzdavarny: [],
      cvicneTests: [],
      language: 'cz',
      zaznamnikNewPoints: {},
      odevzdavarnyNew: [],
      exams: { data: [vwa], status: 'success', error: null },
      examTermsNew: [examTermKey('EBC-VWA', '1')],
      examTermsAcknowledged: [],
      notifications: {
        ...useAppStore.getState().notifications,
        seenDeadlineAlertIds: new Set(),
      },
    } as never);
  });

  it('is a row on both trees, counted by the bell', () => {
    const { result } = renderHook(() => useDeadlineAlerts());
    expect(result.current.alerts.map((a) => [a.type, a.body])).toEqual([
      ['exam-new-term', 'zkouška · 14. 12.'],
    ]);
    expect(result.current.unseenCount).toBe(1);
  });

  it('goes once Zkoušky has been on screen', () => {
    renderHook(() => useMarkExamTermsSeen(true));
    expect(useAppStore.getState().examTermsNew).toEqual([]);
    expect(clearUnseenTerms).toHaveBeenCalledWith([examTermKey('EBC-VWA', '1')]);
  });

  it('stays while Zkoušky is not the screen in front', () => {
    renderHook(() => useMarkExamTermsSeen(false));
    expect(useAppStore.getState().examTermsNew).toHaveLength(1);
  });

  it('stays while the tab is hidden, and goes once it is shown', () => {
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    renderHook(() => useMarkExamTermsSeen(true));
    expect(useAppStore.getState().examTermsNew).toHaveLength(1);
    vis.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(useAppStore.getState().examTermsNew).toEqual([]);
    vis.mockRestore();
  });

  // The Android background check records a new term's key without saving the
  // list it came from. Opening Zkoušky on the older cached list must not clear
  // a date that list does not show: it is news once the fresh list arrives.
  it('keeps a new term the displayed list does not hold, and clears it once it does', () => {
    const shownKey = examTermKey('EBC-VWA', '1');
    const offScreen = examTermKey('EBC-VWA', '2');
    useAppStore.setState({ examTermsNew: [shownKey, offScreen] } as never);
    renderHook(() => useMarkExamTermsSeen(true));
    expect(useAppStore.getState().examTermsNew).toEqual([offScreen]);
    expect(clearUnseenTerms).toHaveBeenLastCalledWith([shownKey]);

    act(() => {
      useAppStore.setState({
        exams: {
          data: [
            {
              ...vwa,
              sections: [
                {
                  ...vwa.sections[0]!,
                  terms: [
                    ...vwa.sections[0]!.terms,
                    { id: '2', date: '17.12.2026', time: '11:00' },
                  ],
                },
              ],
            },
          ],
          status: 'success',
          error: null,
        },
      } as never);
    });
    expect(useAppStore.getState().examTermsNew).toEqual([]);
    expect(clearUnseenTerms).toHaveBeenLastCalledWith([offScreen]);
  });

  // Two dates read, then the first one passes: the row now names one date and
  // has another id, but nothing was added, so the bell stays quiet.
  it('does not light the bell again when a date it showed drops out', () => {
    const two: ExamSubject = {
      ...vwa,
      sections: [
        {
          ...vwa.sections[0]!,
          terms: [
            { id: '1', date: '14.12.2026', time: '11:00' },
            { id: '2', date: '17.12.2026', time: '11:00' },
          ],
        },
      ],
    };
    useAppStore.setState({
      exams: { data: [two], status: 'success', error: null },
      examTermsNew: [examTermKey('EBC-VWA', '1'), examTermKey('EBC-VWA', '2')],
    } as never);
    const first = renderHook(() => useDeadlineAlerts()).result;
    act(() => first.current.markAllSeen(first.current.alerts.map((a) => a.id)));
    useAppStore.setState({ now: new Date(2026, 11, 15, 12, 0) } as never);
    const later = renderHook(() => useDeadlineAlerts()).result;
    expect(later.current.alerts.map((a) => a.body)).toEqual(['zkouška · 17. 12.']);
    expect(later.current.unseenCount).toBe(0);
  });

  // A sync that read the record before Zkoušky cleared it answers with the
  // seen term still in it: it must not come back.
  it('a sync answering from before the acknowledgement does not bring a seen term back', () => {
    const key = examTermKey('EBC-VWA', '1');
    renderHook(() => useMarkExamTermsSeen(true));
    useAppStore.getState().setExamTermsNew([key, examTermKey('EBC-VWA', '2')]);
    expect(useAppStore.getState().examTermsNew).toEqual([examTermKey('EBC-VWA', '2')]);
  });
});
