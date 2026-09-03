import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { SubjectsScreen } from '../SubjectsScreen';
import { BottomNav } from '../../nav/BottomNav';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * One header, on every tab.
 *
 * The vývěska, notifications and settings lived on the Calendar screen alone —
 * measured in the dev webapp, Calendar had all three and Exams, Subjects, Map
 * and Student had none, so three of the app's five destinations were reachable
 * from exactly one tab. Search was worse than unreachable: it was a whole
 * bottom-nav tab ("Student") spent on a text field.
 *
 * So the actions move into `ScreenHeader` itself rather than being passed in
 * per screen. A screen cannot render a header without them, which is the point
 * — this is the second time these actions have gone missing from a state that
 * forgot to include them (see CalendarScreen.header.test.tsx for the first).
 *
 * Each screen's OWN control (Subjects' study plan, Exams' registered count)
 * moves to its own row under the title rather than competing with four 40px
 * targets for the same row — at 320px that overflows.
 */

// Three, not four: the profile became a bottom-nav tab, so the avatar left the
// header — see ProfileScreen.test.tsx.
const ACTIONS = ['Rozbalit vývěsku', 'Hledat', 'Oznámení'];

const SYNC_DONE = {
  isSyncing: false,
  lastSync: 1,
  error: null,
  handshakeDone: true,
  handshakeTimedOut: false,
};

describe('the persistent header', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      mobileTab: 'calendar',
      mobileSheets: [],
      keyboardOpen: false,
      fullName: 'Jana Nováková',
      firstSyncSettled: true,
      syncLoaded: { schedule: true, exams: true },
      schedule: { data: [], status: 'success' } as never,
      exams: { data: [], status: 'success', error: null } as never,
      syncStatus: SYNC_DONE,
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('renders all three actions on the calendar', () => {
    render(<CalendarScreen />);
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('renders all three actions on exams', () => {
    render(<ExamsScreen />);
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('renders all three actions on subjects', () => {
    render(<SubjectsScreen />);
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('opens the search sheet from the header', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByLabelText('Hledat'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'search' }]);
  });

  it('opens the search sheet from a tab that is not the calendar', () => {
    render(<SubjectsScreen />);
    fireEvent.click(screen.getByLabelText('Hledat'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'search' }]);
  });

  it('puts search next to the vývěska pin, in that order', () => {
    // "a search icon in the header (next to pin)" — the pin is the anchor, so
    // search reads as a sibling of it rather than being tacked on after the
    // avatar.
    render(<CalendarScreen />);
    const pin = screen.getByLabelText('Rozbalit vývěsku');
    const search = screen.getByLabelText('Hledat');
    expect(pin.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the study plan button reachable on subjects', () => {
    render(<SubjectsScreen />);
    expect(screen.getByRole('button', { name: 'Studijní plán' })).toBeInTheDocument();
  });
});

describe('the bottom nav after the Student tab became the profile', () => {
  beforeEach(() => {
    useAppStore.setState({ mobileTab: 'calendar', language: 'cz', keyboardOpen: false });
  });

  it('renders five nav buttons', () => {
    render(<BottomNav />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('no longer offers a Student tab', () => {
    render(<BottomNav />);
    expect(screen.queryByRole('button', { name: 'Student' })).not.toBeInTheDocument();
  });

  it('offers the four destinations plus the profile', () => {
    render(<BottomNav />);
    for (const name of ['Kalendář', 'Zkoušky', 'Předměty', 'Mapa', 'Profil'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });
});
