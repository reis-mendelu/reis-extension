import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { WeeklyCalendarHeader } from '../WeeklyCalendarHeader';
import { useAppStore } from '../../../store/useAppStore';
import type { DateInfo } from '../../../types/calendarTypes';
import type { OutletMenu } from '../../../types/menuTypes';
import { venueRowToPin } from '../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../test/fixtures/sklubVenueRow';

/** Mon 7.9.2026 – Fri 11.9.2026, the shape useCalendarData hands the header. */
const WEEK: DateInfo[] = [7, 8, 9, 10, 11].map((d) => ({
  weekday: '',
  day: String(d),
  month: '9',
  year: '2026',
  full: `${d}. 9. 2026`,
}));

const MENU: OutletMenu[] = [
  {
    outlet: 'X',
    days: [{ date: '8. 9. 2026', soup: 'Kuřecí vývar', mainDishes: ['Svíčková'] }],
  },
];

function renderHeader() {
  return render(
    <WeeklyCalendarHeader
      weekDates={WEEK}
      todayIndex={1}
      holidaysByDay={[null, null, null, null, null]}
      dayCount={5}
    />
  );
}

describe('WeeklyCalendarHeader — the jídelníček', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: MENU,
      menuLoading: false,
      menuError: false,
      fetchMenu: vi.fn(),
    } as never);
  });

  it('shows the day’s dishes from the store', () => {
    renderHeader();
    fireEvent.click(screen.getByTitle('Jídelníček'));
    expect(screen.getByText('Svíčková')).toBeInTheDocument();
    expect(screen.getByText('Kuřecí vývar')).toBeInTheDocument();
  });

  // The Iron Rule: no useEffect for data fetching. `initializeStore` asks for
  // the menu at boot and both language handlers ask again, so neither the
  // header nor the popover it opens is allowed to reach for the network —
  // they read `menu` synchronously and render whatever is there.
  it('never fetches: not the header, and not the popover it opens', () => {
    const fetchMenu = vi.fn();
    useAppStore.setState({ menu: null, menuLoading: false, menuError: false, fetchMenu } as never);
    renderHeader();
    expect(fetchMenu).not.toHaveBeenCalled();

    // And with data present, opening the popover must not fetch either.
    useAppStore.setState({ menu: MENU } as never);
    renderHeader();
    fireEvent.click(screen.getAllByTitle('Jídelníček')[0]!);
    expect(fetchMenu).not.toHaveBeenCalled();
  });
});

/**
 * The S-klub tab in the extension's popover — mockup "reIS venues S-klub
 * Pixie", page 6. FRRMS students only (Dominik, 1 November 2026).
 */
describe('WeeklyCalendarHeader — S-klub', () => {
  const SKLUB = venueRowToPin(SKLUB_VENUE_ROW)!;
  const FULL: OutletMenu[] = ['X', 'KA', 'JAK'].map((outlet) => ({
    outlet,
    days: [{ date: '8. 9. 2026', soup: null, mainDishes: [`Jídlo ${outlet}`] }],
  }));

  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: FULL,
      menuLoading: false,
      menuError: false,
      // Tuesday 8 September 2026, 10:00 in Prague.
      now: new Date('2026-09-08T08:00:00Z'),
      userFaculty: 'FRRMS',
      venuePins: [SKLUB],
    } as never);
  });

  const tabs = () =>
    within(screen.getByRole('group', { name: 'Výdejna' }))
      .getAllByRole('button')
      .map((b) => b.textContent);

  it('FRRMS sees KA, S-klub, X, JAK; everyone else X, JAK, KA, S-klub', () => {
    const { unmount } = renderHeader();
    fireEvent.click(screen.getByTitle('Jídelníček'));
    expect(tabs()).toEqual(['KA', 'S-klub', 'X', 'JAK']);
    unmount();
    useAppStore.setState({ userFaculty: null } as never);
    renderHeader();
    fireEvent.click(screen.getByTitle('Jídelníček'));
    expect(tabs()).toEqual(['X', 'JAK', 'KA', 'S-klub']);
  });

  // cubic and CodeRabbit on #660: the pick is by key, so S-klub arriving
  // (inserted before X) does not move it.
  it('keeps the picked canteen when S-klub arrives later', () => {
    useAppStore.setState({ venuePins: [] } as never);
    renderHeader();
    fireEvent.click(screen.getByTitle('Jídelníček'));
    fireEvent.click(screen.getByRole('button', { name: 'X' }));
    act(() => useAppStore.setState({ venuePins: [SKLUB] } as never));
    expect(screen.getByRole('button', { name: 'X' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Jídlo X')).toBeInTheDocument();
  });

  it('shows the lunch offer and the place, and opens the venue on the map', () => {
    const focusSocietyPin = vi.fn();
    useAppStore.setState({ focusSocietyPin } as never);
    renderHeader();
    fireEvent.click(screen.getByTitle('Jídelníček'));
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    const panel = screen.getByTestId('menu-venue');
    expect(within(panel).getByText('Denní menu s polévkou')).toBeInTheDocument();
    expect(within(panel).getByText('189 Kč')).toBeInTheDocument();
    expect(within(panel).getByText(/Budova Z, přízemí/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Celé menu a ceny na mapě/ }));
    expect(focusSocietyPin).toHaveBeenCalledWith(SKLUB);
    // The popover closes behind the jump.
    expect(screen.queryByTestId('menu-venue')).not.toBeInTheDocument();
  });

  it('clicking the place ("Budova Z, přízemí") shows the venue on the map', () => {
    const focusSocietyPin = vi.fn();
    useAppStore.setState({ focusSocietyPin } as never);
    renderHeader();
    fireEvent.click(screen.getByTitle('Jídelníček'));
    fireEvent.click(screen.getByRole('button', { name: 'S-klub' }));
    fireEvent.click(screen.getByRole('button', { name: /Budova Z, přízemí.*Ukázat na mapě/ }));
    expect(focusSocietyPin).toHaveBeenCalledWith(SKLUB);
    expect(screen.queryByTestId('menu-venue')).not.toBeInTheDocument();
  });
});
