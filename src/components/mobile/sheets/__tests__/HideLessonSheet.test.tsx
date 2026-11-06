import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HideLessonSheet } from '../HideLessonSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { info: toastInfo } }));
const seen = vi.hoisted(() => ({ value: false }));
vi.mock('../../../../services/hints/HintService', () => ({
  HintService: {
    isSeen: vi.fn(async () => seen.value),
    markSeen: vi.fn(async () => {
      seen.value = true;
    }),
  },
}));

const seminar = {
  id: 'L1',
  date: '20261029',
  startTime: '09:00',
  endTime: '10:50',
  courseCode: 'EBC-VF1',
  courseName: 'Veřejné finance 1',
  courseNameCs: 'Veřejné finance 1',
  isSeminar: 'true',
  teachers: [],
} as unknown as BlockLesson;

/**
 * Suggestion #43: "I'm only retaking the exam, so I don't attend the seminars,
 * but every seminar option shows in my timetable and I can only rename them."
 * A hold on a lesson opens this sheet with the extension's choices.
 */
describe('HideLessonSheet', () => {
  beforeEach(() => {
    toastInfo.mockReset();
    seen.value = false;
    useAppStore.setState({
      language: 'cz',
      hiddenItems: { courses: [], events: [] },
      mobileSheets: [{ kind: 'hideLesson', lesson: seminar }],
    });
  });

  it('hides this one lesson, recorded under the subject name and its date', async () => {
    const onClose = vi.fn();
    render(<HideLessonSheet lesson={seminar} onClose={onClose} />);
    fireEvent.click(screen.getByText('Skrýt tuto hodinu'));
    await waitFor(() =>
      expect(useAppStore.getState().hiddenItems.events).toEqual([
        { id: 'L1', courseCode: 'EBC-VF1', courseName: 'Veřejné finance 1', date: '20261029' },
      ])
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('hides every seminar of the subject — the #43 case', async () => {
    render(<HideLessonSheet lesson={seminar} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Skrýt všechna cvičení'));
    await waitFor(() =>
      expect(useAppStore.getState().hiddenItems.courses).toEqual([
        { courseCode: 'EBC-VF1', courseName: 'Veřejné finance 1', type: 'seminar' },
      ])
    );
  });

  it('hides every lecture for a lecture, and never offers the whole subject', async () => {
    render(<HideLessonSheet lesson={{ ...seminar, isSeminar: 'false' }} onClose={vi.fn()} />);
    expect(screen.queryByText('Skrýt celý předmět')).toBeNull();
    fireEvent.click(screen.getByText('Skrýt všechny přednášky'));
    await waitFor(() =>
      expect(useAppStore.getState().hiddenItems.courses).toEqual([
        { courseCode: 'EBC-VF1', courseName: 'Veřejné finance 1', type: 'lecture' },
      ])
    );
  });

  // The status is read at the moment of the hide, so a hide right after the
  // sheet opens still gets the hint (PR #638 review).
  it('says once, the first time, where hidden lessons come back from', async () => {
    const { unmount } = render(<HideLessonSheet lesson={seminar} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Skrýt tuto hodinu'));
    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith(
        'Uloženo! Skryté položky lze obnovit v Profil → Nastavení.',
        expect.anything()
      )
    );
    await waitFor(() => expect(seen.value).toBe(true));
    unmount();
    render(<HideLessonSheet lesson={seminar} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Skrýt všechna cvičení'));
    await new Promise((r) => setTimeout(r, 0));
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });
});
