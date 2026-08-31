import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { trackNotificationClick } from '../../../../services/spolky';
import type { SpolekNotification } from '../../../../services/spolky';

// Only the click counter is faked: the rest of the module backs the feed's own
// faculty filter, and a real RPC here would reach Supabase from a unit test.
vi.mock('../../../../services/spolky', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../services/spolky')>()),
  trackNotificationClick: vi.fn(),
}));

// 'admin' bypasses the spolky-subscription filter (always shown), keeping these
// independent of useSpolkySettings' async IDB-backed state.
const notification: SpolekNotification = {
  id: 'n1',
  associationId: 'admin',
  title: 'ESN party tonight',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  link: 'https://example.com/party',
} as SpolekNotification;

beforeEach(() => {
  vi.mocked(trackNotificationClick).mockClear();
  useAppStore.setState({
    language: 'cz',
    exams: { data: [] },
    odevzdavarny: [],
    cvicneTests: [],
    now: new Date(),
  } as never);
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
      mapEventsLoaded: true,
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

  // Inert has to mean inert to a KEYBOARD too: an enabled button that ignores
  // its own activation is still a focus stop that announces itself as a control.
  it('leaves the row inert when nothing would open', () => {
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: true } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    const row = screen.getByText('ESN party tonight').closest('button');
    expect(row?.className).toContain('cursor-default');
    expect(row).toBeDisabled();
  });

  /**
   * The map feed loads on its own schedule and sets `mapEventsLoaded` only on
   * SUCCESS, so before it lands — or forever, if it failed — every linkless
   * notification looked inert and the tap returned without acting. That is the
   * exact dead tap this fix exists to remove, reachable through a race.
   */
  it('loads the map feed on tap rather than treating the row as dead', async () => {
    const loadMapEvents = vi.fn(async () => {
      useAppStore.setState({ mapEvents: [event], mapEventsLoaded: true } as never);
    });
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: false, loadMapEvents } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('ESN party tonight'));
    await waitFor(() => expect(useAppStore.getState().mobileTab).toBe('map'));
    expect(loadMapEvents).toHaveBeenCalled();
    expect(useAppStore.getState().mapSelection).toMatchObject({
      kind: 'event',
      event: { id: 'n1' },
    });
  });

  // And it must not LOOK dead while that load is still outstanding.
  it('renders the row as interactive while the map feed is still loading', () => {
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: false } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    expect(screen.getByText('ESN party tonight').closest('button')?.className).toContain(
      'cursor-pointer'
    );
  });

  /**
   * Waiting on the load opened a window the synchronous version never had. Two
   * taps inside it ran two handlers: two undeduplicated fetches (loadMapEvents
   * guards on "already loaded", not on "already loading") and two
   * increment_post_click RPCs for ONE intent — a click counter that overstates
   * the row a student had to tap twice because it was slow.
   */
  it('counts one click and loads once when tapped twice during the load', async () => {
    let release!: () => void;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    const loadMapEvents = vi.fn(async () => {
      await pending;
      useAppStore.setState({ mapEvents: [event], mapEventsLoaded: true } as never);
    });
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: false, loadMapEvents } as never);

    render(<NotificationsSheet onClose={vi.fn()} />);
    const row = screen.getByText('ESN party tonight');
    fireEvent.click(row);
    fireEvent.click(row);
    release();

    await waitFor(() => expect(useAppStore.getState().mobileTab).toBe('map'));
    expect(loadMapEvents).toHaveBeenCalledTimes(1);
    expect(trackNotificationClick).toHaveBeenCalledTimes(1);
  });

  // The guard spans the in-flight load only — it must not wedge the row shut.
  it('still opens on a later tap once an earlier one has settled', async () => {
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('ESN party tonight'));
    await waitFor(() => expect(useAppStore.getState().mobileTab).toBe('map'));

    useAppStore.setState({ mobileTab: 'calendar', mapSelection: null } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByText('ESN party tonight')[0]!);
    await waitFor(() => expect(useAppStore.getState().mobileTab).toBe('map'));
  });

  // A notification the map has no row for (a far-future event the public feed
  // filters out) must not leave the student on a map with nothing selected.
  it('leaves the map alone when no event matches', () => {
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: true } as never);
    render(<NotificationsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('ESN party tonight'));
    const state = useAppStore.getState();
    expect(state.mobileTab).toBe('calendar');
    expect(state.mapSelection).toBeNull();
  });
});
