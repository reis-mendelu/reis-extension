import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { DailyActivityChart } from '../DailyActivityChart';

const DAILY = [
  { day: '2026-09-13', active: 94, newDevices: 83, returningDevices: 11 },
  { day: '2026-09-14', active: 330, newDevices: 283, returningDevices: 47 },
  { day: '2026-09-15', active: 86, newDevices: 21, returningDevices: 65 },
];

describe('DailyActivityChart', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));

  it('picks the day that was clicked', () => {
    const onPick = vi.fn();
    render(<DailyActivityChart daily={DAILY} selectedDay={null} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: /^14\.9\./ }));

    expect(onPick).toHaveBeenCalledWith('2026-09-14');
  });

  it('marks the selected day, defaulting to the last one', () => {
    const { rerender } = render(
      <DailyActivityChart daily={DAILY} selectedDay={null} onPick={() => {}} />
    );
    expect(screen.getByRole('button', { name: /^15\.9\./ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    rerender(<DailyActivityChart daily={DAILY} selectedDay="2026-09-13" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /^13\.9\./ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  // The whole point of the split is that it is checkable by eye, so the label a
  // screen reader gets has to carry all three numbers, not just the total.
  it('names each bar with its total and its split', () => {
    render(<DailyActivityChart daily={DAILY} selectedDay={null} onPick={() => {}} />);
    expect(
      screen.getByRole('button', {
        name: '14.9. — 330 aktivních zařízení, 283 noví, 47 vracející se',
      })
    ).toBeInTheDocument();
  });

  // A quiet day next to a launch day is a few pixels tall on a linear scale,
  // and the scale stays linear on purpose. The numbers therefore have to be
  // readable without picking the day first.
  it('carries its numbers in a hover readout, not only in the day detail', () => {
    render(<DailyActivityChart daily={DAILY} selectedDay={null} onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /^13\.9\./ })).toHaveAttribute(
      'title',
      '13.9. — 94 aktivních zařízení, 83 noví, 11 vracející se'
    );
  });

  // A quiet day is data. Rendering it as nothing would make the day
  // unclickable and read as a gap in the series rather than a zero.
  it('renders a zero day as a clickable bar with no segments', () => {
    const withZero = [{ day: '2026-09-16', active: 0, newDevices: 0, returningDevices: 0 }];
    const { container } = render(
      <DailyActivityChart daily={withZero} selectedDay={null} onPick={() => {}} />
    );
    expect(screen.getByRole('button', { name: /^16\.9\./ })).toBeInTheDocument();
    const spans = container.querySelectorAll('button span');
    expect(Array.from(spans).every((s) => (s as HTMLElement).style.height === '0px')).toBe(true);
  });

  // A three-device day against a 330-device peak rounds to under a pixel.
  // Flooring non-zero segments keeps small days visible and clickable.
  it('keeps a tiny day visible next to a large one', () => {
    const daily = [
      { day: '2026-09-14', active: 330, newDevices: 283, returningDevices: 47 },
      { day: '2026-09-15', active: 3, newDevices: 2, returningDevices: 1 },
    ];
    const { container } = render(
      <DailyActivityChart daily={daily} selectedDay={null} onPick={() => {}} />
    );
    const tiny = container.querySelectorAll('li')[1]!.querySelectorAll('span');
    expect(parseInt((tiny[0] as HTMLElement).style.height, 10)).toBeGreaterThanOrEqual(2);
  });

  it('says so when the window holds no days at all', () => {
    render(<DailyActivityChart daily={[]} selectedDay={null} onPick={() => {}} />);
    expect(screen.getByText('Zatím žádná data.')).toBeInTheDocument();
  });
});
