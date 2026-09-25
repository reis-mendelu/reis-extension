import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { MOCK_MAP_EVENTS } from '../../components/CampusMap/__tests__/fixtures/mockMapEvents';

const addListener = vi.fn();
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { addListener: (...args: unknown[]) => addListener(...args) },
}));

import { installReminderTapHandler, openRemindedEvent } from '../reminderTap';

const EVENT = MOCK_MAP_EVENTS[1]!;
const realLoad = useAppStore.getState().loadMapEvents;

function tapped(extra: unknown) {
  return { actionId: 'tap', notification: { id: 1, title: '', body: '', extra } };
}

beforeEach(() => {
  addListener.mockReset();
  useAppStore.setState({
    mapEvents: [],
    mapEventsLoaded: false,
    mapSelection: null,
    mobileTab: 'calendar',
    adminConsoleOpen: false,
    loadMapEvents: realLoad,
  });
});

describe('openRemindedEvent', () => {
  it('opens the event on the map tab when the feed is already loaded', async () => {
    useAppStore.setState({ mapEvents: MOCK_MAP_EVENTS, mapEventsLoaded: true });

    await openRemindedEvent(EVENT.id);

    const s = useAppStore.getState();
    expect(s.mobileTab).toBe('map');
    expect(s.mapSelection).toMatchObject({ kind: 'event', event: { id: EVENT.id } });
  });

  // The cold start: the tap launched the app, so the listener fires before the
  // boot load of the map feed has landed. Reading the store at that moment
  // finds nothing, and the tap would be the very dead tap this exists to fix.
  it('waits for the map feed on a cold start, then opens the event', async () => {
    const load = vi.fn(async () => {
      useAppStore.setState({ mapEvents: MOCK_MAP_EVENTS, mapEventsLoaded: true });
    });
    useAppStore.setState({ loadMapEvents: load });

    await openRemindedEvent(EVENT.id);

    expect(load).toHaveBeenCalledOnce();
    expect(useAppStore.getState().mobileTab).toBe('map');
    expect(useAppStore.getState().mapSelection).toMatchObject({ event: { id: EVENT.id } });
  });

  // An event that has ended since the reminder was posted drops out of the
  // feed. Switching to a map with nothing selected is not "opening the event".
  it('changes nothing when the event is not in the feed', async () => {
    useAppStore.setState({ mapEvents: MOCK_MAP_EVENTS, mapEventsLoaded: true });

    await openRemindedEvent('gone-since');

    expect(useAppStore.getState().mobileTab).toBe('calendar');
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('changes nothing when the feed fails to load', async () => {
    useAppStore.setState({ loadMapEvents: vi.fn(async () => {}) });

    await openRemindedEvent(EVENT.id);

    expect(useAppStore.getState().mobileTab).toBe('calendar');
  });

  // `extra` is whatever the OS hands back, including notifications posted by
  // an older build or by nothing of ours at all.
  it.each([undefined, null, '', 42, {}])('ignores an unusable event id (%j)', async (id) => {
    const load = vi.fn(async () => {});
    useAppStore.setState({ loadMapEvents: load });

    await openRemindedEvent(id);

    expect(load).not.toHaveBeenCalled();
    expect(useAppStore.getState().mobileTab).toBe('calendar');
  });

  // Two taps while the feed is still loading: the later one is the student's
  // current intent, and the earlier one must not land on top of it.
  it('lets a later tap supersede one still waiting on the feed', async () => {
    // Both taps start a load (neither sees the feed yet). The EARLIER one's
    // settles last, which is the order that lets a stale tap win without a guard.
    const pending: (() => void)[] = [];
    const load = vi.fn(() => new Promise<void>((resolve) => pending.push(resolve)));
    useAppStore.setState({ loadMapEvents: load });

    const first = openRemindedEvent(MOCK_MAP_EVENTS[0]!.id);
    const second = openRemindedEvent(EVENT.id);
    useAppStore.setState({ mapEvents: MOCK_MAP_EVENTS, mapEventsLoaded: true });
    pending.reverse().forEach((resolve) => resolve());
    await Promise.all([first, second]);

    expect(useAppStore.getState().mapSelection).toMatchObject({ event: { id: EVENT.id } });
  });
});

describe('installReminderTapHandler', () => {
  it('opens the event whose id the tapped reminder carries', async () => {
    useAppStore.setState({ mapEvents: MOCK_MAP_EVENTS, mapEventsLoaded: true });

    installReminderTapHandler();

    expect(addListener).toHaveBeenCalledWith(
      'localNotificationActionPerformed',
      expect.any(Function)
    );
    const onTap = addListener.mock.calls[0]![1] as (a: unknown) => Promise<void> | void;
    await onTap(tapped({ eventId: EVENT.id }));

    expect(useAppStore.getState().mobileTab).toBe('map');
    expect(useAppStore.getState().mapSelection).toMatchObject({ event: { id: EVENT.id } });
  });

  it('survives a notification with no extra at all', async () => {
    installReminderTapHandler();
    const onTap = addListener.mock.calls[0]![1] as (a: unknown) => Promise<void> | void;

    await onTap(tapped(undefined));

    expect(useAppStore.getState().mobileTab).toBe('calendar');
  });
});
