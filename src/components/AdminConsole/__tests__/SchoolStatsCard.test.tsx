import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SchoolStatsCard } from '../SchoolStatsCard';
import { schoolStatsText } from '../schoolStatsText';
import type { SchoolStats } from '../../../api/schoolStats';

const STATS: SchoolStats = {
  weekFrom: '2026-10-19',
  weekTo: '2026-10-25',
  regulars: 1990,
  regularsPhone: 1786,
  regularsByFaculty: [
    { key: 'PEF', devices: 1325 },
    { key: 'ZF', devices: -1 },
  ],
  eduroamSince: '2026-09-23',
  eduroamWifi: 455,
  eduroamProfile: 93,
  eduroamByFaculty: [{ key: 'PEF', devices: 236 }],
  eduroamByWeek: [],
  events: { posts: 63, views: 11216, clicks: 850, mapViews: 609 },
  notices: [],
};

const plain = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ');

describe('SchoolStatsCard', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', adminSchoolStats: null } as never));
  afterEach(cleanup);

  it('renders nothing until its own read lands', () => {
    const { container } = render(<SchoolStatsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the headline numbers and hides small groups as under 10', () => {
    useAppStore.setState({ adminSchoolStats: STATS } as never);
    render(<SchoolStatsCard />);

    const card = screen.getByRole('region', { name: 'Pro školu' });
    expect(plain(card.textContent)).toContain('1 990');
    expect(plain(card.textContent)).toContain('455');
    expect(plain(card.textContent)).toContain('11 216');
    expect(screen.getAllByText('< 10').length).toBeGreaterThan(0);
  });

  it('copies the plain-text summary for an email or a one-pager', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    useAppStore.setState({ adminSchoolStats: STATS } as never);
    render(<SchoolStatsCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat jako text' }));

    expect(writeText).toHaveBeenCalledWith(schoolStatsText(STATS));
  });
});
