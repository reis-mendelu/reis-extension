import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileSheet } from '../ProfileSheet';
import { useAppStore } from '../../../../store/useAppStore';

const outlookToggle = vi.fn();
const driveConnect = vi.fn();
const driveDisconnect = vi.fn();

vi.mock('../../../../hooks/data/useOutlookSync', () => ({
  useOutlookSync: () => ({
    isEnabled: false,
    isLoading: false,
    toggle: outlookToggle,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));

describe('ProfileSheet', () => {
  beforeEach(() => {
    outlookToggle.mockClear();
    driveConnect.mockClear();
    driveDisconnect.mockClear();
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu-dark',
      isThemeLoading: false,
      fullName: 'Kryštof Janda',
      studyPlanDual: null,
      hiddenItems: {
        courses: [],
        events: [{ id: 'ev1', courseCode: 'ALG', courseName: 'Algoritmizace', date: '20260401' }],
      },
    } as never);
  });

  it('flips the theme between mendelu-dark and mendelu', async () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    const themeToggle = screen.getByRole('checkbox', { name: /Tmavý režim/i });
    expect(themeToggle).toBeChecked();

    fireEvent.click(themeToggle);

    await waitFor(() => expect(useAppStore.getState().theme).toBe('mendelu'));
  });

  it('switches the language', async () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('English'));
    await waitFor(() => expect(useAppStore.getState().language).toBe('en'));
  });

  it('calls the Outlook hook toggle', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Synchronizace kalendáře/i }));
    expect(outlookToggle).toHaveBeenCalledTimes(1);
  });

  /**
   * Drive backup is non-functional on mobile on every axis (issue #168), so the
   * toggle only ever promised something the app could not deliver. Pinned as an
   * absence rather than deleted, so restoring it is a deliberate act.
   */
  it('offers no Google Drive backup toggle', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    expect(screen.queryByRole('checkbox', { name: /Záloha na Google Disk/i })).toBeNull();
    expect(driveConnect).not.toHaveBeenCalled();
  });

  it('opens the eduroam sheet from settings in one tap', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Eduroam'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'eduroam' }]);
  });

  it('shows a hidden event and restores it, removing it from the hidden list', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    // HiddenItemsSection starts collapsed - expand it first.
    fireEvent.click(screen.getByText('Skryté položky'));
    fireEvent.click(screen.getByTitle('Obnovit'));
    expect(useAppStore.getState().hiddenItems.events).toEqual([]);
  });
});
