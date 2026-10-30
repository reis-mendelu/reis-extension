import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SchoolStatsCard } from '../SchoolStatsCard';
import type { SchoolStats } from '../../../api/schoolStats';

const STATS: SchoolStats = {
  weekFrom: '2026-10-19',
  weekTo: '2026-10-25',
  regulars: 1990,
  regularsPhone: 1786,
  regularsByFaculty: [
    { key: 'PEF', devices: 1325 },
    { key: 'ZF', devices: -1 },
    { key: 'AF', devices: -2 },
  ],
  eduroamSince: '2026-09-23',
  eduroamTotal: 540,
  eduroamWifi: 455,
  eduroamProfile: 93,
  eduroamByFaculty: [{ key: 'PEF', devices: 236 }],
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
    expect(plain(card.textContent)).toContain('540');
    expect(plain(card.textContent)).toContain('455');
    expect(plain(card.textContent)).toContain('11 216');
    expect(screen.getAllByText('< 10').length).toBeGreaterThan(0);
    // A neighbour hidden to protect a smaller group is not "under 10".
    expect(screen.getByText('skryto')).toBeTruthy();
  });

  it('drops the phone/laptop split when the pair is hidden, and shows notices in the admin language', () => {
    useAppStore.setState({
      language: 'en',
      adminSchoolStats: {
        ...STATS,
        eduroamWifi: -1,
        eduroamProfile: -1,
        notices: [
          {
            id: 'q1',
            promptCz: 'Česky',
            promptEn: 'In English',
            startsAt: '2026-10-24T00:00:00+00:00',
            endsAt: '2026-11-07T00:00:00+00:00',
            seen: 711,
          },
        ],
      },
    } as never);
    render(<SchoolStatsCard />);

    const card = screen.getByRole('region', { name: 'For the school' });
    expect(card.textContent).not.toContain('laptops:');
    expect(card.textContent).toContain('since 23. 9. 2026');
    expect(screen.getByText('In English')).toBeTruthy();
  });
});
