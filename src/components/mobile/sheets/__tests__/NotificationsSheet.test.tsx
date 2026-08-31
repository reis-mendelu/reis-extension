import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { SpolekNotification } from '../../../../services/spolky';

// 'admin' notifications bypass the spolky-subscription filter (always shown),
// keeping this test independent of useSpolkySettings' async IDB-backed state.
const notification: SpolekNotification = {
  id: 'n1',
  associationId: 'admin',
  title: 'ESN party tonight',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  link: 'https://example.com/party',
} as SpolekNotification;

describe('NotificationsSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      notifications: {
        data: [notification],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
      exams: { data: [] },
      odevzdavarny: [],
      cvicneTests: [],
      now: new Date(),
    } as never);
  });

  it('shows the title and a notification from the feed', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByText('Novinky')).toBeInTheDocument();
    expect(screen.getByText('ESN party tonight')).toBeInTheDocument();
  });

  it('shows the empty state when there is nothing to show', () => {
    useAppStore.setState({
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
    } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByText('Žádné nové novinky')).toBeInTheDocument();
  });

  it('closes via the header close button', () => {
    const onClose = vi.fn();
    render(<NotificationsSheet onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Zavřít'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * A notification IS a `spolky_events` row — `fetchNotifications` reads that
 * table and maps `url` to `link`, which most events simply do not have. The
 * click handler was gated entirely on that link, so tapping a society event in
 * Novinky did nothing at all: the one surface that announces an event could not
 * open it.
 *
 * The notification's id is the map event's id (same `toMapEvent` id space), so
 * the event the student tapped is the one the map already knows how to show.
 */
describe('NotificationsSheet event notifications', () => {
  const event = {
    id: 'n1',
    title: 'ESN party tonight',
    url: '',
    date: '2026-09-01',
    endDate: null,
    time: '19:00',
    location: 'Klub',
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'esn',
    coord: [16.61, 49.21] as [number, number],
    roomCode: null,
    venueKind: 'offcampus',
    category: 'party',
  };

  const linklessNotification = { ...notification, link: undefined };

  beforeEach(() => {
    useAppStore.setState({
      notifications: {
        data: [linklessNotification],
        status: 'success',
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
      },
      mapEvents: [event],
      mapSelection: null,
      mobileTab: 'calendar',
      adminConsoleOpen: false,
    } as never);
  });

  it('opens the tapped event on the map', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('ESN party tonight'));
    const state = useAppStore.getState();
    expect(state.mobileTab).toBe('map');
    expect(state.mapSelection).toMatchObject({ kind: 'event', event: { id: 'n1' } });
  });

  it('closes the sheet so the map it switched to is actually visible', () => {
    const onClose = vi.fn();
    render(<NotificationsSheet onClose={onClose} />);
    fireEvent.click(screen.getByText('ESN party tonight'));
    expect(onClose).toHaveBeenCalled();
  });

  // A row that acts has to look like it does: the affordance followed the
  // link alone, so a linkless event now opens the map while still rendering
  // as inert.
  it('renders the row as interactive when it opens something', () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    const row = screen.getByText('ESN party tonight').closest('button');
    expect(row?.className).toContain('cursor-pointer');
  });

  it('leaves the row inert when nothing would open', () => {
    useAppStore.setState({ mapEvents: [] } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    const row = screen.getByText('ESN party tonight').closest('button');
    expect(row?.className).toContain('cursor-default');
  });

  // A notification the map has no row for (a far-future event the public feed
  // filters out) must not leave the student on a map with nothing selected.
  it('leaves the map alone when no event matches', () => {
    useAppStore.setState({ mapEvents: [] } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('ESN party tonight'));
    const state = useAppStore.getState();
    expect(state.mobileTab).toBe('calendar');
    expect(state.mapSelection).toBeNull();
  });
});
