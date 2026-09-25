import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { NotificationDropdown } from '../NotificationDropdown';
import { useAppStore } from '../../../store/useAppStore';
import { openExternal } from '../../../mobile/openExternal';
import type { SpolekNotification } from '../../../services/spolky';

vi.mock('../../../services/spolky', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/spolky')>()),
  trackNotificationClick: vi.fn(),
}));
vi.mock('../../../mobile/openExternal', () => ({ openExternal: vi.fn() }));

const notification = {
  id: 'n1',
  associationId: 'admin',
  title: 'City Game',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
} as SpolekNotification;

const event = {
  id: 'n1',
  title: 'City Game',
  url: '',
  date: '2026-09-24',
  endDate: null,
  time: '18:00',
  location: 'Náměstí Svobody',
  imageUrl: null,
  organizerKey: 'esn',
  societyId: 'esn',
  coord: [16.61, 49.21] as [number, number],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
};

function renderDropdown(n: SpolekNotification, extra: { onClose?: () => void } = {}) {
  const onShowMap = vi.fn();
  const onClose = extra.onClose ?? vi.fn();
  render(
    <NotificationDropdown
      notifications={[n]}
      loading={false}
      onClose={onClose}
      onVisible={vi.fn()}
      onShowMap={onShowMap}
      dropdownRef={createRef<HTMLDivElement>()}
      deadlineAlerts={[]}
    />
  );
  return { onShowMap, onClose };
}

/**
 * The extension's dropdown gated the whole click on `link`, the event's
 * optional URL — which most society events do not set. So a notification the
 * phone opens on the map was, in the extension, a disabled row with no chevron:
 * #254 fixed the phone's sheet and left this surface as it was.
 */
describe('NotificationDropdown event notifications', () => {
  beforeEach(() => {
    vi.mocked(openExternal).mockClear();
    useAppStore.setState({
      language: 'cz',
      mapEvents: [event],
      mapEventsLoaded: true,
      mapSelection: null,
      adminConsoleOpen: false,
    } as never);
  });

  it('renders a linkless event as interactive', () => {
    renderDropdown(notification);
    const row = screen.getByText('City Game').closest('button');
    expect(row).not.toBeDisabled();
    expect(row?.className).toContain('cursor-pointer');
  });

  it('opens a linkless event on the map and closes the dropdown', () => {
    const { onShowMap, onClose } = renderDropdown(notification);
    fireEvent.click(screen.getByText('City Game'));
    expect(onShowMap).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(useAppStore.getState().mapSelection).toMatchObject({
      kind: 'event',
      event: { id: 'n1' },
    });
  });

  it('waits for the map feed rather than treating the row as dead', async () => {
    const loadMapEvents = vi.fn(async () => {
      useAppStore.setState({ mapEvents: [event], mapEventsLoaded: true } as never);
    });
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: false, loadMapEvents } as never);
    const { onShowMap } = renderDropdown(notification);
    fireEvent.click(screen.getByText('City Game'));
    await waitFor(() => expect(onShowMap).toHaveBeenCalled());
    expect(loadMapEvents).toHaveBeenCalled();
  });

  it('still prefers the link where the author set one', () => {
    const { onShowMap } = renderDropdown({ ...notification, link: 'https://example.com/game' });
    fireEvent.click(screen.getByText('City Game'));
    expect(openExternal).toHaveBeenCalledWith('https://example.com/game');
    expect(onShowMap).not.toHaveBeenCalled();
  });

  it('stays inert when neither a link nor a map event exists', () => {
    useAppStore.setState({ mapEvents: [], mapEventsLoaded: true } as never);
    const { onShowMap } = renderDropdown(notification);
    const row = screen.getByText('City Game').closest('button');
    expect(row).toBeDisabled();
    fireEvent.click(screen.getByText('City Game'));
    expect(onShowMap).not.toHaveBeenCalled();
  });
});
