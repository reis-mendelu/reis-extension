import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * A box that was not there at the previous sync: a row in the same section as
 * "Nové body", and a tap opens the subject on Záznamník, where boxes live.
 */
describe('NotificationsSheet: new odevzdávárna', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
      exams: { data: [] },
      cvicneTests: [],
      now: new Date(2026, 9, 29, 12, 0),
      courseNicknames: {},
      subjects: { data: { 'EBC-MAT': { nameCs: 'Matematika', subjectId: '164074' } } },
      zaznamnikNewPoints: {},
      odevzdavarny: [
        {
          courseId: '164074',
          courseNameCs: 'Matematika',
          courseNameEn: 'Mathematics',
          name: 'Build MATLAB Proficiency',
          type: '',
          deadline: '20.12.2026 23:59',
          odevzdavarnaId: '9001',
          fileCount: 0,
          uploadUrl: 'https://is.mendelu.cz/x',
          section: 'open',
          isOpen: true,
        },
      ],
      odevzdavarnyNew: ['9001'],
      mobileSheets: [{ kind: 'notifications' }],
    } as never);
  });

  it('lists the subject, the box and its deadline under Záznamník', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByText('Záznamník')).toBeInTheDocument();
    expect(screen.getByText('Matematika')).toBeInTheDocument();
    expect(
      screen.getByText(/Build MATLAB Proficiency · do .*20\. ?12\. 23:59/)
    ).toBeInTheDocument();
    expect(screen.getByText('Nová odevzdávárna')).toBeInTheDocument();
  });

  it('a tap opens the subject on Záznamník', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Matematika/ }));
    expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({
      kind: 'subjectDrawer',
      courseCode: 'EBC-MAT',
      courseName: 'Matematika',
      courseId: '164074',
      initialTab: 'zaznamnik',
    });
  });

  it('opening the sheet marks the row seen, so the bell stops counting it', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(useAppStore.getState().notifications.seenDeadlineAlertIds.has('odev-new-9001')).toBe(
      true
    );
  });
});
