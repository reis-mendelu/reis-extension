import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { EventsDropdown } from '../Events/EventsDropdown';
import { NotificationDropdown } from '../Notifications/NotificationDropdown';
import type { MendeluEvent } from '../../types/events';
import type { SpolekNotification } from '../../services/spolky';

/**
 * Both dropdowns render on the phone (they portal to a full-screen surface under
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
vi.mock('../StudyJams/StudyJamSuggestions', () => ({ StudyJamSuggestions: () => null }));
// Stubbed, not exercised: its real load is an async IDB read that resolves after
// this test tears down, and the resulting setState lands on an unmounted tree —
// an unhandled error that fails the whole file regardless of assertions.
vi.mock('../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ isSubscribed: () => true, toggleFaculty: vi.fn() }),
}));

const event: MendeluEvent = {
  title: 'Den otevřených dveří',
  url: 'https://mendelu.cz/den-otevrenych-dveri',
  date: '12. 9.',
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
};

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

  it('opens an event through openExternal, not the system browser', () => {
    render(
      <EventsDropdown
        events={[event]}
        loading={false}
        onClose={() => {}}
        dropdownRef={createRef<HTMLDivElement>()}
      />
    );
    fireEvent.click(screen.getByText(event.title));
    expect(openExternal).toHaveBeenCalledWith(event.url);
    expect(window.open).not.toHaveBeenCalled();
  });

  it('opens a notification link through openExternal, not the system browser', () => {
    render(
      <NotificationDropdown
        notifications={[notification]}
        loading={false}
        onClose={() => {}}
        onVisible={() => {}}
        dropdownRef={createRef<HTMLDivElement>()}
        deadlineAlerts={[]}
      />
    );
    fireEvent.click(screen.getByText(notification.title));
    expect(openExternal).toHaveBeenCalledWith(notification.link);
    expect(window.open).not.toHaveBeenCalled();
  });
});
