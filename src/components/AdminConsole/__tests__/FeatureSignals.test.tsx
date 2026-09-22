import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeatureSignals } from '../FeatureSignals';
import type { FeatureStats } from '../../../api/featureStats';

/**
 * The payload here is the one `feature_stats` actually returned over HTTP in
 * the SQL exercise behind `docs/verify-engagement-signals.md`: one signal that
 * cleared the suppression floor and therefore has a daily series, and one that
 * did not and therefore has none.
 */
const STATS: FeatureStats = {
  byFeature: [
    { feature: 'eduroam_profile_delivered', installs: -1, hits: -1 },
    { feature: 'eduroam_wifi_configured', installs: 6, hits: 6 },
    { feature: 'map_dwell_3s', installs: 7, hits: 14 },
  ],
  daily: [
    { day: '2026-09-20', feature: 'map_dwell_3s', installs: 2 },
    { day: '2026-09-21', feature: 'map_dwell_3s', installs: 3 },
    { day: '2026-09-22', feature: 'map_dwell_3s', installs: 2 },
    { day: '2026-09-22', feature: 'eduroam_wifi_configured', installs: 6 },
  ],
  topEvents: [
    { id: 'ev-1', title: 'Mezinárodní večer', mapViews: 45 },
    { id: 'ev-2', title: 'Deskovky v klubu', mapViews: 12 },
  ],
  eventDaily: [
    { day: '2026-09-20', eventId: 'ev-1', views: 12 },
    { day: '2026-09-21', eventId: 'ev-1', views: 31 },
    { day: '2026-09-22', eventId: 'ev-1', views: 2 },
    { day: '2026-09-22', eventId: 'ev-2', views: 12 },
  ],
};

const seed = (stats: FeatureStats | null = STATS) =>
  useAppStore.setState({ language: 'cz', adminFeatureStats: stats } as never);

describe('FeatureSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22));
    seed(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // Until the RPC answers there is nothing honest to show; a panel of zeros
  // would read as "nobody uses the map".
  it('renders nothing before the stats arrive', () => {
    const { container } = render(<FeatureSignals />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows each signal as a count of installs', () => {
    seed();
    render(<FeatureSignals />);

    expect(screen.getByRole('button', { name: /Mapa aspoň 3 sekundy/ })).toBeInTheDocument();
    expect(screen.getByText(/^7 instalací$/)).toBeInTheDocument();
    expect(screen.getByText(/^6 instalací$/)).toBeInTheDocument();
  });

  // The floor is a privacy claim, not a formatting detail: a group under five
  // installs must never appear as a number, and -1 must never be printed.
  it('renders the suppression floor as words, never as -1', () => {
    seed();
    render(<FeatureSignals />);

    expect(screen.getByText(/^méně než 5 instalací$/)).toBeInTheDocument();
    expect(screen.queryByText(/-1/)).not.toBeInTheDocument();
  });

  it('keeps the two eduroam signals apart', () => {
    seed();
    render(<FeatureSignals />);

    expect(screen.getByText('eduroam nastaven aplikací')).toBeInTheDocument();
    expect(screen.getByText('eduroam profil předán')).toBeInTheDocument();
  });

  it('lists the most-opened events with their counts', () => {
    seed();
    render(<FeatureSignals />);

    expect(screen.getByRole('button', { name: /Mezinárodní večer/ })).toBeInTheDocument();
    expect(screen.getByText(/^45 otevření$/)).toBeInTheDocument();
  });

  it('shows a signal the RPC returned no row for as zero', () => {
    seed({ byFeature: [], daily: [], topEvents: [], eventDaily: [] });
    render(<FeatureSignals />);

    expect(screen.getAllByText(/^0 instalací$/)).toHaveLength(3);
  });

  // The chart must never open on a series whose total was withheld, and never
  // open empty — so the default is the first signal that actually has a shape.
  it('opens on the first signal that has a shape to draw', () => {
    seed();
    render(<FeatureSignals />);

    const selected = screen.getAllByRole('button', { pressed: true });
    expect(selected[0]).toHaveTextContent('Mapa aspoň 3 sekundy');
    expect(
      screen.getByRole('img', { name: /Mapa aspoň 3 sekundy.*celkem 7 instalací/ })
    ).toBeInTheDocument();
  });

  it('draws the signal you pick', () => {
    seed();
    render(<FeatureSignals />);

    fireEvent.click(screen.getByText('eduroam nastaven aplikací'));

    expect(
      screen.getByRole('img', { name: /eduroam nastaven aplikací.*celkem 6 instalací/ })
    ).toBeInTheDocument();
  });

  // Its total was withheld, so its shape is withheld with it — a chart drawn
  // from a day at a time would publish exactly what the floor refused.
  it('says so instead of charting a suppressed signal', () => {
    seed();
    render(<FeatureSignals />);

    fireEvent.click(screen.getByText('eduroam profil předán'));

    expect(screen.getByText(/méně než 5 instalací za 30 dní/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /eduroam profil předán/ })).not.toBeInTheDocument();
  });

  it('opens on the most-opened event and follows the one you pick', () => {
    seed();
    render(<FeatureSignals />);

    expect(
      screen.getByRole('img', { name: /Mezinárodní večer.*celkem 45 otevření/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Deskovky v klubu'));

    expect(
      screen.getByRole('img', { name: /Deskovky v klubu.*celkem 12 otevření/ })
    ).toBeInTheDocument();
  });

  // The RPC omits a day with no activity. If the chart skipped those days too,
  // a quiet fortnight and a busy one would draw the same picture.
  it('spans the whole 30-day window, not just the days with rows', () => {
    seed();
    render(<FeatureSignals />);

    // Both charts span the same window, so both captions say so.
    expect(screen.getAllByText('24.8. – 22.9.')).toHaveLength(2);
  });
});
