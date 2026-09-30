import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import type { MapEvent } from '../../../types/events';
import type { NotifyPermission } from '../../../store/slices/createFollowSlice';

const askNotificationPermission = vi.fn();
vi.mock('../../../services/eventReminders/sync', () => ({
  askNotificationPermission: (...a: unknown[]) => askNotificationPermission(...a),
}));

import { NotifySoftAsk } from '../NotifySoftAsk';

// A single "soon" event (inside the 14-day horizon) for the given society.
let counter = 0;
function soonEvent(societyId: string): MapEvent {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  counter += 1;
  return {
    id: `e-${societyId}-${counter}`,
    title: `Event ${counter}`,
    url: 'https://www.instagram.com/x/',
    date: d.toISOString().slice(0, 10),
    endDate: null,
    time: '18:00',
    location: null,
    imageUrl: null,
    organizerKey: 'mendelu',
    societyId,
    coord: null,
    roomCode: null,
    venueKind: 'campus',
    category: 'party',
  };
}

const markPermissionAsked = vi.fn();
const setNotifyPermission = vi.fn();
const replanNotifications = vi.fn();

function seed(opts: {
  notifyPermission: NotifyPermission;
  permissionAsked: boolean;
  followed: string[];
  muted?: string[];
  mapEvents: MapEvent[];
}) {
  useAppStore.setState({
    notifyPermission: opts.notifyPermission,
    permissionAsked: opts.permissionAsked,
    followed: opts.followed,
    muted: opts.muted ?? [],
    mapEvents: opts.mapEvents,
    markPermissionAsked,
    setNotifyPermission,
    replanNotifications,
  });
}

beforeEach(() => {
  counter = 0;
  askNotificationPermission.mockReset().mockResolvedValue('granted');
  markPermissionAsked.mockReset().mockResolvedValue(undefined);
  setNotifyPermission.mockReset();
  replanNotifications.mockReset();
});

afterEach(cleanup);

describe('NotifySoftAsk', () => {
  it('shows one society’s count and copy', () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: ['esn'],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    render(<NotifySoftAsk />);

    expect(
      screen.getByText('ESN má 5 akcí v příštích 14 dnech. Chceš večer předem připomínku?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapnout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teď ne' })).toBeInTheDocument();
  });

  // The same CLDR forms as every other count in reIS (`utils/plural.ts`).
  it.each([
    [1, 'ESN má 1 akci v příštích 14 dnech. Chceš večer předem připomínku?'],
    [2, 'ESN má 2 akce v příštích 14 dnech. Chceš večer předem připomínku?'],
    [22, 'ESN má 22 akcí v příštích 14 dnech. Chceš večer předem připomínku?'],
  ])('%i events read "%s"', (n, text) => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: ['esn'],
      mapEvents: Array.from({ length: n }, () => soonEvent('esn')),
    });

    render(<NotifySoftAsk />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('also shows the card for the post-refusal "prompt-with-rationale" state', () => {
    seed({
      notifyPermission: 'prompt-with-rationale',
      permissionAsked: false,
      followed: ['esn'],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    render(<NotifySoftAsk />);

    expect(screen.getByRole('button', { name: 'Zapnout' })).toBeInTheDocument();
  });

  it('shows the many-societies copy when more than one society qualifies', () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: ['esn', 'supef'],
      mapEvents: [
        ...Array.from({ length: 5 }, () => soonEvent('esn')),
        ...Array.from({ length: 2 }, () => soonEvent('supef')),
      ],
    });

    render(<NotifySoftAsk />);

    expect(
      screen.getByText(
        'Tvoje spolky mají 7 akcí v příštích 14 dnech. Chceš večer předem připomínku?'
      )
    ).toBeInTheDocument();
  });

  it('Zapnout asks permission, then marks asked, sets granted and replans', async () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: ['esn'],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    render(<NotifySoftAsk />);
    fireEvent.click(screen.getByRole('button', { name: 'Zapnout' }));

    await Promise.resolve();
    await Promise.resolve();

    expect(askNotificationPermission).toHaveBeenCalledTimes(1);
    expect(markPermissionAsked).toHaveBeenCalledTimes(1);
    expect(setNotifyPermission).toHaveBeenCalledWith('granted');
    expect(replanNotifications).toHaveBeenCalledTimes(1);

    const askOrder = askNotificationPermission.mock.invocationCallOrder[0]!;
    const markOrder = markPermissionAsked.mock.invocationCallOrder[0]!;
    const setOrder = setNotifyPermission.mock.invocationCallOrder[0]!;
    const replanOrder = replanNotifications.mock.invocationCallOrder[0]!;
    expect(askOrder).toBeLessThan(markOrder);
    expect(markOrder).toBeLessThan(setOrder);
    expect(setOrder).toBeLessThan(replanOrder);
  });

  // A refusal is an answer too: without recording it, the store kept saying
  // 'prompt' and Profile went on offering a Turn-on button the OS would
  // silently ignore until the next resume read.
  it.each<NotifyPermission>(['denied', 'prompt-with-rationale', 'unsupported'])(
    'Zapnout records a %s answer and does not replan',
    async (answer) => {
      askNotificationPermission.mockResolvedValue(answer);
      seed({
        notifyPermission: 'prompt',
        permissionAsked: false,
        followed: ['esn'],
        mapEvents: [soonEvent('esn')],
      });

      render(<NotifySoftAsk />);
      fireEvent.click(screen.getByRole('button', { name: 'Zapnout' }));
      await Promise.resolve();
      await Promise.resolve();

      expect(markPermissionAsked).toHaveBeenCalledTimes(1);
      expect(setNotifyPermission).toHaveBeenCalledWith(answer);
      expect(replanNotifications).not.toHaveBeenCalled();
    }
  );

  it('Teď ne only marks the permission as asked', () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: ['esn'],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    render(<NotifySoftAsk />);
    fireEvent.click(screen.getByRole('button', { name: 'Teď ne' }));

    expect(markPermissionAsked).toHaveBeenCalledTimes(1);
    expect(askNotificationPermission).not.toHaveBeenCalled();
    expect(setNotifyPermission).not.toHaveBeenCalled();
    expect(replanNotifications).not.toHaveBeenCalled();
  });

  it.each<NotifyPermission>(['granted', 'denied', 'unsupported', null])(
    'renders nothing when the permission is %s',
    (permission) => {
      seed({
        notifyPermission: permission,
        permissionAsked: false,
        followed: ['esn'],
        mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
      });

      const { container } = render(<NotifySoftAsk />);
      expect(container).toBeEmptyDOMElement();
    }
  );

  it('renders nothing once the student has already been asked', () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: true,
      followed: ['esn'],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    const { container } = render(<NotifySoftAsk />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing with no soon event from a followed, unmuted society', () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: ['esn'],
      muted: ['esn'],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    const { container } = render(<NotifySoftAsk />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the only events are from societies not followed', () => {
    seed({
      notifyPermission: 'prompt',
      permissionAsked: false,
      followed: [],
      mapEvents: Array.from({ length: 5 }, () => soonEvent('esn')),
    });

    const { container } = render(<NotifySoftAsk />);
    expect(container).toBeEmptyDOMElement();
  });
});
