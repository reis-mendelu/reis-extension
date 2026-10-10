import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { useNotificationFeed } from '../useNotificationFeed';

/**
 * A feed left open across midnight. Today was read with `localTodayIso()` at
 * render, and nothing re-rendered the hook when the day changed, so the list
 * stayed on yesterday: a finished event lingered and the day that had just
 * come into the Novinky week was missing. The store's clock moves it now.
 */
const row = (id: string, day: string) => ({
  id,
  associationId: 'au_frrms',
  subscribersOnly: false,
  title: id,
  body: id,
  createdAt: '2026-10-01',
  expiresAt: day,
  startsAt: day,
  priority: 'normal' as const,
});

describe('Novinky across midnight', () => {
  it('drops the finished event and adds the new day when the store clock crosses midnight', () => {
    useAppStore.setState({
      now: new Date(2026, 9, 9, 23, 59),
      societies: BUNDLED_SOCIETIES,
      userFaculty: 'PEF',
      isErasmus: false,
      impersonation: null,
      notifications: {
        ...useAppStore.getState().notifications,
        // Day 7 from 9 October: just outside the week, inside it tomorrow.
        data: [row('tonight', '2026-10-09'), row('edge', '2026-10-16')],
      },
    });
    const { result } = renderHook(() => useNotificationFeed());
    expect(result.current.notifications.map((n) => n.id)).toEqual(['tonight']);
    act(() => {
      useAppStore.setState({ now: new Date(2026, 9, 10, 0, 1) });
    });
    expect(result.current.notifications.map((n) => n.id)).toEqual(['edge']);
  });
});
