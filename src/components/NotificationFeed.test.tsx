/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationFeed } from './NotificationFeed';
import { IndexedDBService } from '../services/storage';
import * as spolkyService from '../services/spolky';
import { useAppStore } from '../store/useAppStore';
import { openExternal } from '../mobile/openExternal';

// The linked branch hands the URL to the system browser; a unit test has none.
vi.mock('../mobile/openExternal', () => ({ openExternal: vi.fn() }));

// Mock the services
vi.mock('../services/spolky', () => ({
  fetchNotifications: vi.fn(),
  trackNotificationsViewed: vi.fn(),
  trackNotificationClick: vi.fn(),
  filterNotificationsByFaculty: vi.fn((notifications) => notifications),
  useSpolkySettings: vi.fn(() => ({ subscribedAssociations: [] })),
}));

// Mock useSpolkySettings hook
vi.mock('../hooks/useSpolkySettings', () => ({
  useSpolkySettings: vi.fn(() => ({ subscribedAssociations: [] })),
}));

// Mock IndexedDBService. This sat inside the `describe` body until vitest 5,
// which errors on a hoisted call written below the top level rather than
// silently lifting it — it always ran here, the indentation just said otherwise.
vi.mock('../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock IntersectionObserver

const observers = new Map<Element, any>();

const mockIntersectionObserver = vi.fn(function (
  this: any,
  callback: IntersectionObserverCallback
) {
  this.callback = callback;
  this.observe = vi.fn((element: Element) => {
    observers.set(element, this);
  });
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});
vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

// Helper to trigger intersection
const triggerIntersection = (element: Element, isIntersecting = true) => {
  const observer = observers.get(element);
  if (observer) {
    // Wrap in simple object matching IntersectionObserverEntry interface needs
    const entry = {
      isIntersecting,
      target: element,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    };
    observer.callback([entry], observer);
  }
};

const realLoadMapEvents = useAppStore.getState().loadMapEvents;

describe('NotificationFeed', () => {
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
    {
      id: '2',
      title: 'Test Notification 2',
      body: 'Body 2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      priority: 'normal' as const,
      associationId: 'test-assoc-2',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (spolkyService.fetchNotifications as any).mockResolvedValue(mockNotifications);
    // A test below stubs the store's loader; put the real one back so the
    // stub cannot leak into later tests through the singleton store.
    useAppStore.setState({ loadMapEvents: realLoadMapEvents });
    (IndexedDBService.get as any).mockResolvedValue(null);
    useAppStore.setState({
      notifications: {
        data: mockNotifications,
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
        status: 'success',
      },
      // Loaded with no events: a click on a linked-but-unmatched row (like
      // 'Test Notification 1') takes the fallback without ever awaiting the
      // real loadMapEvents, which would otherwise reach out from a unit test.
      mapEvents: [],
      mapEventsLoaded: true,
    } as any);
  });

  it('should track views when notification becomes visible', async () => {
    // Mock user has NOT viewed anything yet

    (IndexedDBService.get as any).mockImplementation((_store: string, key: string) => {
      if (key === 'viewed_notifications_analytics') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<NotificationFeed onShowMap={vi.fn()} />);

    // Open dropdown
    const bellButton = screen.getByLabelText('Notifications');
    await act(async () => {
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });

    // Simulate intersection
    const notificationItem = screen.getByText('Test Notification 1').closest('button');
    if (notificationItem) {
      await act(async () => {
        triggerIntersection(notificationItem, true);
      });
    }

    // Check if view tracking was called for item 1
    await waitFor(() => {
      expect(spolkyService.trackNotificationsViewed).toHaveBeenCalledWith(['1']);
    });
  });

  it('should NOT track views again if notifications are locally marked as VIEWED (analytics)', async () => {
    useAppStore.setState({
      notifications: {
        data: mockNotifications,
        readIds: new Set(),
        viewedIds: new Set(['1']),
        seenDeadlineAlertIds: new Set(),
        status: 'success',
      },
    });

    render(<NotificationFeed onShowMap={vi.fn()} />);

    const bellButton = screen.getByLabelText('Notifications');
    await act(async () => {
      fireEvent.click(bellButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });

    const notificationItem = screen.getByText('Test Notification 1').closest('button');
    if (notificationItem) {
      await act(async () => {
        triggerIntersection(notificationItem, true);
      });
    }

    // Should NOT have called trackNotificationsViewed for '1'
    expect(spolkyService.trackNotificationsViewed).not.toHaveBeenCalled();
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
      mapEvents: [{ id: '1' } as any],
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

  it('holds back an event the console still lists as scheduled', async () => {
    // Same window as the map: 14+ days out is "Naplánované — zveřejní se …" in
    // the console, so it must not be in Novinky (or collect views) yet. The
    // phone's NotificationsSheet reads the same useNotificationFeed list.
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    useAppStore.setState({
      notifications: {
        data: [
          ...mockNotifications,
          { ...mockNotifications[1]!, id: '3', title: 'Ples', startsAt: day, expiresAt: day },
        ],
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
        status: 'success',
      },
    });

    render(<NotificationFeed onShowMap={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Notifications'));
    });

    await waitFor(() => {
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Ples')).not.toBeInTheDocument();
  });
});
