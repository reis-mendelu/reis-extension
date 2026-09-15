import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminStatsPanel } from '../AdminStatsPanel';

const STATS = {
  today: 86,
  d7: 420,
  d30: 426,
  daily: [
    { day: '2026-09-14', active: 330, newDevices: 283, returningDevices: 47 },
    { day: '2026-09-15', active: 86, newDevices: 21, returningDevices: 65 },
  ],
  byPlatform: [
    { key: 'ios', devices: 349 },
    { key: 'unknown', devices: 7 },
  ],
  byFaculty: [
    { key: 'PEF', devices: 224 },
    { key: 'ICV', devices: -1 },
  ],
  day: {
    day: '2026-09-15',
    active: 86,
    newDevices: 21,
    returningDevices: 65,
    byPlatform: [{ key: 'ios', devices: 77 }],
  },
};

describe('AdminStatsPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      adminStatsLoading: false,
      adminStatsDay: null,
      adminStats: STATS,
      selectAdminStatsDay: vi.fn(async () => {}),
    } as never);
  });

  it('shows the three totals and says it counts devices, not people', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('86')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('426')).toBeInTheDocument();
    expect(screen.getByText(/Aktivní zařízení, ne lidé/)).toBeInTheDocument();
  });

  it('renders a suppressed group as "under 5" rather than a number', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('méně než 5')).toBeInTheDocument();
    expect(screen.queryByText('-1')).not.toBeInTheDocument();
  });

  // GA4's "(not set)" convention: a dimension that was added after launch has
  // legitimately-unknown rows, and they stay a labelled bar rather than being
  // dropped from the denominator — bars that do not sum to the total are a lie.
  it('labels the unknown bucket instead of hiding it', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('neuvedeno')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders the picked day with its split and platform breakdown', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('2026-09-15')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
  });

  // "76 %" is the share of one day's actives that are not new. Calling that
  // "retention" would claim an earlier cohort came back, which it does not
  // measure — hence the deliberately flatter label.
  it('labels the returning share as a composition, not as retention', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('76 %')).toBeInTheDocument();
    expect(screen.getByText('z toho vracející se')).toBeInTheDocument();
    expect(screen.queryByText(/[Nn]ávratnost/)).not.toBeInTheDocument();
  });

  // The contrast fix lives in the theme tokens (index.css) —
  // --color-warning-content is #111827 (8.26:1 on --color-warning) in both
  // themes — so the semantic alert-warning class alone carries readable text.
  it('keeps the load-failed alert readable — no white-on-amber', () => {
    useAppStore.setState({ adminStats: null, adminStatsLoading: false } as never);
    render(<AdminStatsPanel />);
    expect(screen.getByText('Statistiky se nepodařilo načíst.').className).toContain(
      'alert-warning'
    );
  });

  it('renders an empty window without crashing or claiming a failure', () => {
    useAppStore.setState({
      adminStats: { ...STATS, daily: [], byPlatform: [], byFaculty: [], day: null },
    } as never);
    render(<AdminStatsPanel />);
    expect(screen.getByText('Zatím žádná data.')).toBeInTheDocument();
    expect(screen.queryByText('Statistiky se nepodařilo načíst.')).not.toBeInTheDocument();
  });

  // The refresh button's only content is the "↻" glyph, unreadable to a
  // screen reader without a real label.
  it('labels the refresh button for screen readers', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByRole('button', { name: 'Obnovit' })).toBeInTheDocument();
  });
});
