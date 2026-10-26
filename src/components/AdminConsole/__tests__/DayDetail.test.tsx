import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { DayDetail } from '../DayDetail';

const DETAIL = {
  day: '2026-09-14',
  active: 1,
  newDevices: 1,
  returningDevices: 0,
  byPlatform: [],
};

// "1 aktivních zařízení" declined the label wrongly for every count but a few;
// "label: n" is correct for any number, as the new/returning counts read (#516).
describe('DayDetail', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));

  it('reads the active count as "label: n"', () => {
    render(<DayDetail detail={DETAIL} />);
    expect(screen.getByText('aktivní zařízení: 1')).toBeInTheDocument();
  });
});
