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

const photoFor = vi.fn<(id: unknown) => string | null>(() => null);
vi.mock('../../../../hooks/data/usePersonPhoto', () => ({
  usePersonPhoto: (id: unknown) => photoFor(id),
}));

/**
 * The student's own face was the one photo the app never showed: `PersonPhoto`
 * was wired up for classmates and teachers, and this sheet rendered initials —
 * or, when `fullName` has not resolved, a generic person glyph. On the iPad
 * that is what a student sees of themselves.
 */
describe("ProfileSheet — the student's own photo", () => {
  beforeEach(() => {
    photoFor.mockReset();
    photoFor.mockReturnValue(null);
    useAppStore.setState({ language: 'cz', fullName: 'Jan Novák', studentId: '120344' });
  });

  it('renders the photo for the signed-in student', () => {
    photoFor.mockImplementation((id) => (id === '120344' ? 'data:image/jpeg;base64,AAA' : null));
    render(<ProfileSheet onClose={() => {}} />);

    const img = screen.getByAltText('Jan Novák') as HTMLImageElement;
    expect(img.src).toBe('data:image/jpeg;base64,AAA');
  });

  it('falls back to initials while the photo is unresolved', () => {
    render(<ProfileSheet onClose={() => {}} />);

    expect(screen.getByText('JN')).toBeInTheDocument();
  });

  // A photo has no id to fetch until loadContext has answered, and asking for
  // `foto.pl?id=` would 200 with an empty body.
  it('asks for no photo before the student id resolves', () => {
    useAppStore.setState({ studentId: null });
    render(<ProfileSheet onClose={() => {}} />);

    expect(photoFor).toHaveBeenCalledWith(null);
  });
});

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
