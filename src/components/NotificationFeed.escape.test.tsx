import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationFeed } from './NotificationFeed';
import { useAppStore } from '../store/useAppStore';
import { useEscapeLayer } from '../hooks/ui/useEscapeLayer';

vi.mock('../mobile/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('../services/spolky', () => ({
  fetchNotifications: vi.fn().mockResolvedValue([]),
  trackNotificationsViewed: vi.fn(),
  trackNotificationClick: vi.fn(),
}));
vi.mock('../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(function (this: Record<string, unknown>) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  })
);

const NOTE = {
  id: '1',
  title: 'Test Notification 1',
  body: 'Body 1',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  priority: 'normal' as const,
  associationId: 'test-assoc',
};

/**
 * The extension's notification dropdown is an Escape layer: it used to listen
 * on `document` on its own, so one press also closed a drawer or dialog under
 * it. Now only the dropdown closes.
 */
describe('NotificationFeed and Escape', () => {
  beforeEach(() => {
    useAppStore.setState({
      notifications: {
        data: [NOTE],
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
        status: 'success',
      },
      mapEvents: [],
      mapEventsLoaded: true,
    } as never);
  });

  it('closes on Escape without closing the layer under it', async () => {
    const under = vi.fn();
    function Under() {
      useEscapeLayer(true, under);
      return null;
    }
    render(
      <>
        <Under />
        <NotificationFeed onShowMap={vi.fn()} />
      </>
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Notifications'));
    });
    await waitFor(() => expect(screen.getByText('Test Notification 1')).toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Test Notification 1')).toBeNull());
    expect(under).not.toHaveBeenCalled();
  });
});
