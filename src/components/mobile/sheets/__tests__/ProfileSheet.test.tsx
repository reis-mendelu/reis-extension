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

vi.mock('../../../../hooks/data/useDriveBackup', () => ({
  useDriveBackup: () => ({
    connected: false,
    rootLink: null,
    folderLink: null,
    lastSync: 0,
    failingSince: null,
    syncing: false,
    fileCount: 0,
    quarantined: 0,
    accountEmail: null,
    busy: false,
    connect: driveConnect,
    disconnect: driveDisconnect,
    backupNow: vi.fn(),
    refresh: vi.fn(),
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

  it('calls the Drive hook connect', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Záloha na Google Disk/i }));
    expect(driveConnect).toHaveBeenCalledTimes(1);
  });

  it('shows a hidden event and restores it, removing it from the hidden list', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    // HiddenItemsSection starts collapsed - expand it first.
    fireEvent.click(screen.getByText('Skryté položky'));
    fireEvent.click(screen.getByTitle('Obnovit'));
    expect(useAppStore.getState().hiddenItems.events).toEqual([]);
  });
});
