/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationFeed } from './NotificationFeed';
import { IndexedDBService } from '../services/storage';
import * as spolkyService from '../services/spolky';

// Mock the services
vi.mock('../services/spolky', () => ({
  fetchNotifications: vi.fn(),
  trackNotificationsViewed: vi.fn(),
  trackNotificationClick: vi.fn(),
  filterNotificationsByFaculty: vi.fn((notifications) => notifications),
  getUserAssociation: vi.fn(),
  useSpolkySettings: vi.fn(() => ({ subscribedAssociations: [] })),
}));

// Mock useSpolkySettings hook
vi.mock('../hooks/useSpolkySettings', () => ({
  useSpolkySettings: vi.fn(() => ({ subscribedAssociations: [] })),
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const observers = new Map<Element, any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIntersectionObserver = vi.fn(function(this: any, callback: IntersectionObserverCallback) {
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
            time: Date.now()
        };
        observer.callback([entry], observer);
    }
};

describe('NotificationFeed', () => {
  const mockNotifications = [
    {
      id: '1',
      title: 'Test Notification 1',
      body: 'Body 1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      priority: 'normal',
      associationId: 'test-assoc',
    },
    {
      id: '2',
      title: 'Test Notification 2',
      body: 'Body 2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      priority: 'normal',
      associationId: 'test-assoc-2',
    }
  ];

// Mock IndexedDBService
vi.mock('../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

  beforeEach(() => {
    vi.clearAllMocks();
    (spolkyService.fetchNotifications as any).mockResolvedValue(mockNotifications);
    (IndexedDBService.get as any).mockResolvedValue(null);
  });

  it('should track views when notification becomes visible', async () => {
    // Mock user has NOT viewed anything yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (IndexedDBService.get as any).mockImplementation((_store: string, key: string) => {
        if (key === 'viewed_notifications_analytics') return Promise.resolve(null);
        return Promise.resolve(null);
    });
    
    render(<NotificationFeed />);
    
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
    // Setup IDB as viewed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (IndexedDBService.get as any).mockImplementation((_store: string, key: string) => {
        if (key === 'viewed_notifications_analytics') return Promise.resolve(['1']);
        return Promise.resolve(null);
    });
    
    render(<NotificationFeed />);
    
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

  it('should track click when a notification is clicked', async () => {
    render(<NotificationFeed />);
    
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
  });
});
