import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

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
describe("ProfileScreen — the student's own photo", () => {
  beforeEach(() => {
    photoFor.mockReset();
    photoFor.mockReturnValue(null);
    useAppStore.setState({ language: 'cz', fullName: 'Jan Novák', studentId: '120344' });
  });

  it('renders the photo for the signed-in student', () => {
    photoFor.mockImplementation((id) => (id === '120344' ? 'data:image/jpeg;base64,AAA' : null));
    render(<ProfileScreen />);

    const img = screen.getByAltText('Jan Novák') as HTMLImageElement;
    expect(img.src).toBe('data:image/jpeg;base64,AAA');
  });

  it('falls back to initials while the photo is unresolved', () => {
    render(<ProfileScreen />);

    expect(screen.getByText('JN')).toBeInTheDocument();
  });

  // A photo has no id to fetch until loadContext has answered, and asking for
  // `foto.pl?id=` would 200 with an empty body.
  it('asks for no photo before the student id resolves', () => {
    useAppStore.setState({ studentId: null });
    render(<ProfileScreen />);

    expect(photoFor).toHaveBeenCalledWith(null);
  });
});

describe('ProfileScreen', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
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

  it('offers no calendar-sync toggle', () => {
    render(<ProfileScreen />);
    // The Outlook calendar mirror was removed once the phone app covered it.
    // Asserted on the visible label rather than the hook, so the test fails if
    // the control is ever re-rendered from any source.
    expect(screen.queryByText(/Synchronizace kalendáře/i)).toBeNull();
    expect(screen.queryByText(/Rozvrh a zkoušky do Outlooku/i)).toBeNull();
  });

  // Dokumenty used to be the one card left on the Student hub. The hub's IS
  // directory is gone from the phone tree, so the card follows eduroam here.
  it('opens the documents sheet from settings in one tap', () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Dokumenty'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'docs' }]);
  });

  it('opens the eduroam sheet from settings in one tap', () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Eduroam'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'eduroam' }]);
  });

  // Hiding lessons exists only on desktop calendar cards, and storage is per
  // device, so on a phone this list was always empty and never rendered.
  it('has no hidden-items list on the phone', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText('Skryté položky')).toBeNull();
  });

  it('opens Nastavení in one tap, naming what is inside', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Kalendář, jazyk, vzhled')).toBeTruthy();
    fireEvent.click(screen.getByText('Nastavení'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'settings' }]);
  });

  it('groups eduroam and documents under Ve škole, with no Vzhled group', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Ve škole')).toBeTruthy();
    expect(screen.queryByText('Vzhled')).toBeNull();
  });
});
