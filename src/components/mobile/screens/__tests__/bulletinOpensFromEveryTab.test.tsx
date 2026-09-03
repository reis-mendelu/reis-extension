import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { SubjectsScreen } from '../SubjectsScreen';
import { ExamsScreen } from '../ExamsScreen';
import { ProfileScreen } from '../ProfileScreen';
import { SheetHost } from '../../sheets/SheetHost';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The vývěska opens from whichever tab the student is on.
 *
 * Reported as "clicking the vyveska anywhere else than the calendar tab fails
 * to open it", and reproduced in the browser: on `subjects-screen` the pin is
 * there, the tap does nothing, and no portal appears — while the identical tap
 * on `calendar-screen` opens it.
 *
 * The button lives in `HeaderActions`, which `ScreenHeader` renders on all five
 * screens. The surface it opened was mounted in `CalendarScreen` alone. So four
 * tabs set a store flag that nothing on screen was listening to.
 *
 * `headerSurvivesGates.test.tsx` is the near miss: it asserts this exact button
 * is REACHABLE on Exams and Subjects, through every loading and error gate, and
 * never that pressing it does anything.
 *
 * The fix is not to mount the overlay five times. The vývěska is now a sheet in
 * the shared stack, which `SheetHost` renders once for the whole app — the same
 * route every other sheet takes, and the reason none of them has ever had this
 * bug. It also makes it a slidedown, with the drag-to-dismiss every other sheet
 * has.
 */
const PIN = 'Rozbalit vývěsku';

/**
 * Every screen that HAS the button. The map deliberately does not: "on the map
 * let's actually omit the header, it doesn't fit there, it should stay on the
 * other tabs though" — so it is absent by request, not by this bug.
 */
const SCREENS: [string, () => React.ReactElement][] = [
  ['calendar', () => <CalendarScreen />],
  ['subjects', () => <SubjectsScreen />],
  ['exams', () => <ExamsScreen />],
  ['profile', () => <ProfileScreen />],
];

describe('the vývěska opens from every tab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      mobileSheets: [],
      hiddenItems: { events: [], courses: [] },
      fullName: 'Jana Nováková',
      studentId: '123456',
      keyboardOpen: false,
      bulletinPosts: [{ title: 'Prodám skripta z matematiky', categories: ['Prodám'], url: 'x' }],
      bulletinLoading: false,
      bulletinError: false,
      bulletinHydrated: true,
      firstSyncSettled: false,
      syncLoaded: {},
      exams: { data: [], status: 'loading', error: null },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
      studyPlanDual: null,
      studyStats: null,
      studyComparison: null,
      gradeHistory: null,
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it.each(SCREENS)('opens from the %s tab', (_name, Screen) => {
    render(
      <>
        {Screen()}
        <SheetHost />
      </>
    );
    fireEvent.click(screen.getByLabelText(PIN));
    // The sheet itself, not the flag: a store flag was exactly what four tabs
    // were already setting successfully while nothing appeared.
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument();
    expect(screen.getByText('Prodám skripta z matematiky')).toBeInTheDocument();
  });

  it('goes through the shared stack, so back unwinds it like any other sheet', () => {
    render(
      <>
        <SubjectsScreen />
        <SheetHost />
      </>
    );
    fireEvent.click(screen.getByLabelText(PIN));
    // One entry in the stack the Android back button already knows how to pop.
    // It used to be a portal outside the stack, which is why `handleBackPress`
    // needed a special case for it at all.
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'bulletin' }]);
  });
});
