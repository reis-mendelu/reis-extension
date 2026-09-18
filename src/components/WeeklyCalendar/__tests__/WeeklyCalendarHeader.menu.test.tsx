import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyCalendarHeader } from '../WeeklyCalendarHeader';
import { useAppStore } from '../../../store/useAppStore';
import type { DateInfo } from '../../../types/calendarTypes';
import type { OutletMenu } from '../../../types/menuTypes';

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
    <WeeklyCalendarHeader weekDates={WEEK} todayIndex={1} holidaysByDay={[null, null, null, null, null]} />
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
