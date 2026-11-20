import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const open = vi.fn(async () => {});
vi.mock('../../../../mobile/appUpdate', () => ({ openAppUpdate: () => open() }));

import { NotificationsSheet } from '../NotificationsSheet';
import { HeaderActions } from '../../screens/HeaderActions';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * "Nová verze reISu": an outdated phone sees one row at the top of Novinky
 * that says what it is on its own (a society row shows only a title, which
 * has no room to explain), opens the store, and counts once on the bell.
 */
const offer: { id: string; version: string | null } = { id: 'app-update:5.8.0', version: '5.8.0' };

function reset(appUpdate: typeof offer | null, seen: string | null = null) {
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
    appUpdate,
    appUpdateSeenId: seen,
  } as never);
}

describe('Nová verze reISu in Novinky', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset(offer);
  });

  it('leads the sheet with the version and what to do, and opens the store on tap', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    const row = screen.getByRole('button', { name: /Nová verze reISu/ });
    expect(row).toHaveTextContent('5.8.0');
    expect(row).toHaveTextContent('Klepni a aktualizuj');
    fireEvent.click(row);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('is absent when the app is current', () => {
    reset(null);
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.queryByText('Nová verze reISu')).not.toBeInTheDocument();
  });

  it('works without a version name (Android)', () => {
    reset({ id: 'app-update:50800', version: null });
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Nová verze reISu/ })).toBeInTheDocument();
  });

  it('counts once on the bell until Novinky is opened with it in', () => {
    const { unmount } = render(<HeaderActions />);
    expect(screen.getByRole('button', { name: 'Oznámení' })).toHaveTextContent('1');
    unmount();

    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(useAppStore.getState().appUpdateSeenId).toBe('app-update:5.8.0');
  });

  it('does not count a version already seen', () => {
    reset(offer, 'app-update:5.8.0');
    render(<HeaderActions />);
    expect(screen.getByRole('button', { name: 'Oznámení' })).not.toHaveTextContent('1');
  });
});
