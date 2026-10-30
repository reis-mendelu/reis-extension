import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekMenuButton } from '../WeekMenuButton';
import { useAppStore } from '../../../../../store/useAppStore';
import type { OutletMenu } from '../../../../../types/menuTypes';

// Mon 12 – Fri 16 October 2026. Monday and Wednesday serve; Tuesday does not.
const MENU: OutletMenu[] = [
  {
    outlet: 'X',
    days: [
      { date: 'Pondělí 12. 10. 2026', soup: 'Hrachová', mainDishes: ['Guláš'] },
      { date: 'Úterý 13. 10. 2026', soup: null, mainDishes: [] },
      { date: 'Středa 14. 10. 2026', soup: null, mainDishes: ['Rizoto'] },
    ],
  },
];
const WEEK = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

const hat = () => screen.queryByRole('button', { name: 'Jídelníček' });
const opened = () => useAppStore.getState().mobileSheets;

describe('WeekMenuButton', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: MENU,
      mobileCalendarView: 'week',
      mobileSheets: [],
    } as never);
  });

  // The hat opens the menu of the week on screen — no day has to be picked
  // first, which is what made the first version confusing.
  it('opens the shown week’s menu on its first serving day', () => {
    render(<WeekMenuButton days={WEEK} todayIso="2026-10-07" />);
    fireEvent.click(hat()!);
    expect(opened()).toEqual([{ kind: 'menu', dayIso: '2026-10-12', week: WEEK }]);
  });

  it('opens on today in the current week', () => {
    render(<WeekMenuButton days={WEEK} todayIso="2026-10-14" />);
    fireEvent.click(hat()!);
    expect(opened()).toEqual([{ kind: 'menu', dayIso: '2026-10-14', week: WEEK }]);
  });

  // Tuesday serves nothing, so the menu opens on Wednesday, not on a blank day.
  it('skips today when it does not serve, to the next day that does', () => {
    render(<WeekMenuButton days={WEEK} todayIso="2026-10-13" />);
    fireEvent.click(hat()!);
    expect(opened()).toEqual([{ kind: 'menu', dayIso: '2026-10-14', week: WEEK }]);
  });

  // Lunch that has already happened is no answer: late in this week with
  // nothing left to serve, the hat waits for the next week.
  it('is not shown when the rest of this week serves nothing', () => {
    render(<WeekMenuButton days={WEEK} todayIso="2026-10-15" />);
    expect(hat()).toBeNull();
  });

  // Den has the menu card under the day's lessons.
  it('is not shown in the day view', () => {
    useAppStore.setState({ mobileCalendarView: 'day' } as never);
    render(<WeekMenuButton days={WEEK} todayIso="2026-10-07" />);
    expect(hat()).toBeNull();
  });

  // Like the extension's hat: no menu, no control.
  it('is not shown for a week nothing serves', () => {
    render(<WeekMenuButton days={['2026-10-19', '2026-10-20']} todayIso="2026-10-07" />);
    expect(hat()).toBeNull();
    useAppStore.setState({ menu: null } as never);
    render(<WeekMenuButton days={WEEK} todayIso="2026-10-07" />);
    expect(hat()).toBeNull();
  });
});
