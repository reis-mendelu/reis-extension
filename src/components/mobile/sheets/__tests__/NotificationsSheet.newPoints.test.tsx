import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * "Nové body" lives in Novinky, like every message in reIS: its own section
 * above the deadlines, counted by the bell, and a tap opens the subject on
 * Záznamník (where opening it clears the row).
 */
describe('NotificationsSheet: new záznamník points', () => {
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
      odevzdavarny: [],
      cvicneTests: [],
      now: new Date(),
      subjects: { data: { 'EBC-PS': { nameCs: 'Počítačové sítě', subjectId: '164074' } } },
      zaznamnikNewPoints: { 'EBC-PS': [{ label: 'IPv4-subnt-NAOPAK', value: '9' }] },
      mobileSheets: [{ kind: 'notifications' }],
    } as never);
  });

  it('lists the subject and what was added, under Záznamník', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByText('Záznamník')).toBeInTheDocument();
    expect(screen.getByText('Počítačové sítě')).toBeInTheDocument();
    expect(screen.getByText('IPv4-subnt-NAOPAK: 9')).toBeInTheDocument();
  });

  it('a tap opens the subject on Záznamník', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Počítačové sítě/ }));
    expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({
      kind: 'subjectDrawer',
      courseCode: 'EBC-PS',
      courseName: 'Počítačové sítě',
      courseId: '164074',
      initialTab: 'zaznamnik',
    });
  });

  it('opening the sheet marks the row seen, so the bell stops counting it', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    const seen = useAppStore.getState().notifications.seenDeadlineAlertIds;
    expect([...seen].some((id) => id.startsWith('zaznamnik-EBC-PS-'))).toBe(true);
  });
});
