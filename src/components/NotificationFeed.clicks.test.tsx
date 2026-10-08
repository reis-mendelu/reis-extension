/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationFeed } from './NotificationFeed';
import * as spolkyService from '../services/spolky';
import { useAppStore } from '../store/useAppStore';
import { openExternal } from '../mobile/openExternal';
import { MOCK_MAP_EVENTS } from './CampusMap/__tests__/fixtures/mockMapEvents';
import { localTodayIso } from './CampusMap/eventWindow';

// What a tap on a Novinky row does: the event's card when it is on the map,
// its link otherwise, the link straight away for an academic row. Split from
// NotificationFeed.test.tsx (view tracking), which holds the rest of the feed.

// The linked branch hands the URL to the system browser; a unit test has none.
vi.mock('../mobile/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('../services/spolky', () => ({
  fetchNotifications: vi.fn(),
  trackNotificationsViewed: vi.fn(),
  trackNotificationClick: vi.fn(),
}));
vi.mock('../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
// The rows register for view tracking; these tests never scroll one into view.
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(function (this: Record<string, unknown>) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  })
);

const mockNotifications = [
  {
    id: '1',
    title: 'Test Notification 1',
    body: 'Body 1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    priority: 'normal' as const,
    associationId: 'test-assoc',
    link: 'https://example.com',
  },
];

// The singleton store outlives each test; a test below stubs the loader.
const realLoadMapEvents = useAppStore.getState().loadMapEvents;

describe('NotificationFeed row taps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spolkyService.fetchNotifications).mockResolvedValue(mockNotifications);
    useAppStore.setState({
      loadMapEvents: realLoadMapEvents,
      mapSelection: null,
      notifications: {
        data: mockNotifications,
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
        status: 'success',
      },
      // Loaded with no events: a click on a linked-but-unmatched row takes
      // the fallback without awaiting the real loadMapEvents.
      mapEvents: [],
      mapEventsLoaded: true,
    } as any);
  });

  it('should track click and fall back to the link when no map event matches', async () => {
    // 'Test Notification 1' has a link but its id ('1') is not in mapEvents
    // (empty, loaded — see beforeEach), so the tap falls back to the link
    // rather than opening a card that does not exist.
    render(<NotificationFeed onShowMap={vi.fn()} />);

    const bellButton = screen.getByLabelText('Notifications');
    await act(async () => {
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });

    const notificationItem = screen.getByText('Test Notification 1');
    await act(async () => {
      fireEvent.click(notificationItem);
    });

    expect(spolkyService.trackNotificationClick).toHaveBeenCalledWith('1');
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('opens the card, not the link, when the linked notification is on the map', async () => {
    useAppStore.setState({
      // A real, near event: focusEventById buckets it by date, and a dateless
      // stub would only pass by weekSections tolerating NaN.
      mapEvents: [{ ...MOCK_MAP_EVENTS[0]!, id: '1', date: localTodayIso(), endDate: null }],
      mapEventsLoaded: true,
    } as any);
    render(<NotificationFeed onShowMap={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Notifications'));
    });
    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Notification 1'));
    });

    expect(useAppStore.getState().mapSelection).toMatchObject({
      kind: 'event',
      event: { id: '1' },
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('opens the link immediately for an academic row, without tracking', async () => {
    const academicNotification = {
      ...mockNotifications[0]!,
      id: 'a1',
      associationId: 'academic_deadline',
      link: 'https://is.mendelu.cz/dp',
    };
    useAppStore.setState({
      notifications: {
        data: [academicNotification],
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
        status: 'success',
      },
      mapEvents: [],
      mapEventsLoaded: false,
    } as any);
    render(<NotificationFeed onShowMap={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Notifications'));
    });
    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Notification 1'));
    });

    expect(openExternal).toHaveBeenCalledWith('https://is.mendelu.cz/dp');
    expect(spolkyService.trackNotificationClick).not.toHaveBeenCalled();
  });

  it('falls back to the link once the map feed loads with no matching event', async () => {
    const loadMapEvents = vi.fn(async () => {
      useAppStore.setState({ mapEvents: [], mapEventsLoaded: true } as any);
    });
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: false, loadMapEvents } as any);
    render(<NotificationFeed onShowMap={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Notifications'));
    });
    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Test Notification 1'));
    });

    expect(loadMapEvents).toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });
});
