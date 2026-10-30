import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HalloweenHeaderBats } from '../HalloweenHeaderBats';
import { HalloweenDayEnd } from '../../mobile/screens/calendar/HalloweenDayEnd';
import { ReisLogo } from '../../ReisLogo';
import { ScreenHeader } from '../../mobile/screens/calendar/ScreenHeader';

const IN_WEEK = new Date(2026, 10, 2, 10, 0);
const BEFORE = new Date(2026, 9, 29, 10, 0); // the Thursday before it starts
const AFTER = new Date(2026, 10, 7, 0, 0); // the first moment the week is over
const realNow = useAppStore.getState().now;

afterEach(() => useAppStore.setState({ now: realNow }));

// Both trees get the week: the desktop's top bar and the phone's day view.
describe('Halloween decorations', () => {
  it.each([
    ['before', BEFORE],
    ['after', AFTER],
  ])('draws nothing %s the week, on either tree', (_, now) => {
    useAppStore.setState({ now });
    render(
      <>
        <HalloweenHeaderBats />
        <HalloweenDayEnd />
      </>
    );
    expect(screen.queryByTestId('halloween-header')).toBeNull();
    expect(screen.queryByTestId('halloween-day-end')).toBeNull();
  });

  it('draws the bats on the desktop and the day end on the phone during the week', () => {
    useAppStore.setState({ now: IN_WEEK });
    render(
      <>
        <HalloweenHeaderBats />
        <HalloweenDayEnd />
      </>
    );
    expect(screen.getByTestId('halloween-header')).toBeTruthy();
    expect(screen.getByTestId('halloween-day-end')).toBeTruthy();
  });

  // The date title turns into "back to today" once you leave today, so a
  // pumpkin beside it read as one more thing to tap (Dominik, 2026-10-30).
  // The pumpkins moved into the day's end and the week grid.
  it('puts no pumpkin on any title', () => {
    useAppStore.setState({ now: IN_WEEK });
    const pumpkins = (c: HTMLElement) => c.querySelectorAll('ellipse[fill="#f97316"]').length;
    const away = render(
      <ScreenHeader title="Út 3. listopadu" titleAction={{ label: 'Dnes', onClick: () => {} }} />
    );
    expect(pumpkins(away.container)).toBe(0);
  });

  it("puts a pumpkin at the day's end in Den", () => {
    useAppStore.setState({ now: IN_WEEK });
    render(<HalloweenDayEnd />);
    const end = screen.getByTestId('halloween-day-end');
    expect(end.querySelectorAll('ellipse[fill="#f97316"]').length).toBeGreaterThan(0);
  });

  it('swaps the logo dot for a pumpkin only during the week', () => {
    useAppStore.setState({ now: BEFORE });
    const { container, rerender } = render(<ReisLogo />);
    expect(container.querySelector('circle[fill="#79be15"]')).not.toBeNull();

    useAppStore.setState({ now: IN_WEEK });
    rerender(<ReisLogo />);
    expect(container.querySelector('circle[fill="#79be15"]')).toBeNull();
    expect(container.querySelector('ellipse[fill="#f97316"]')).not.toBeNull();
  });
});
