import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { createRef } from 'react';
import { NotificationDropdown } from '../Notifications/NotificationDropdown';
import type { SpolekNotification } from '../../services/spolky';

/**
 * The dropdown renders on the phone (they portal to a full-screen surface under
 * `useIsMobile`), so on Capacitor a raw `window.open` hands the URL to the SYSTEM
 * browser — which holds none of the app's IS session. `openExternal` is the
 * established answer: it validates the URL, routes into the in-app browser on
 * Capacitor, and off Capacitor opens with `noopener,noreferrer` so the opened
 * page never keeps a handle on `window.opener`.
 */
const openExternal = vi.hoisted(() => vi.fn());
vi.mock('../../mobile/openExternal', () => ({ openExternal }));
vi.mock('../../services/spolky', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  trackNotificationClick: vi.fn(),
}));
const notification: SpolekNotification = {
  id: 'n1',
  associationId: 'supef',
  title: 'Zápis do kroužků',
  body: 'Otevřeno do pátku',
  link: 'https://supef.cz/zapis',
  createdAt: '2026-08-01T00:00:00Z',
  expiresAt: '2026-12-01T00:00:00Z',
  priority: 'normal',
};

describe('dropdown external links', () => {
  beforeEach(() => {
    openExternal.mockClear();
    window.open = vi.fn();
  });

  afterEach(cleanup);

  it('opens a notification link through openExternal, not the system browser', async () => {
    // No matching map event, so the row falls back to its link (a matching
    // event would open the card instead — see NotificationDropdownEvents).
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: true } as never);
    render(
      <NotificationDropdown
        notifications={[notification]}
        loading={false}
        onClose={() => {}}
        onVisible={() => {}}
        onShowMap={() => {}}
        dropdownRef={createRef<HTMLDivElement>()}
        deadlineAlerts={[]}
      />
    );
    fireEvent.click(screen.getByText(notification.title));
    await waitFor(() => expect(openExternal).toHaveBeenCalledWith(notification.link));
    expect(window.open).not.toHaveBeenCalled();
  });
});
