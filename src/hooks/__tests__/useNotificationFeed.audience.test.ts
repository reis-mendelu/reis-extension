import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { useNotificationFeed } from '../useNotificationFeed';
import { localTodayIso } from '../../components/CampusMap/eventWindow';

/**
 * Novinky shows the next week of events this student is in the audience for —
 * no follow list (spec 2026-10-08). reIS's own rows stay for everyone.
 */
const today = localTodayIso();
const row = (id: string, associationId: string, subscribersOnly: boolean) => ({
  id,
  associationId,
  subscribersOnly,
  title: id,
  body: id,
  createdAt: today,
  expiresAt: today,
  startsAt: today,
  priority: 'normal' as const,
});

describe('Novinky audience', () => {
  beforeEach(() => {
    useAppStore.setState({
      societies: BUNDLED_SOCIETIES,
      userFaculty: 'PEF',
      isErasmus: false,
      impersonation: null,
      notifications: {
        ...useAppStore.getState().notifications,
        data: [
          row('pub', 'au_frrms', false),
          row('mine', 'supef', true),
          row('esn', 'esn', true),
          row('deadline', 'academic_deadline', false),
        ],
      },
    });
  });

  it("shows public events, my faculty's own and reIS rows, without any follow", () => {
    const { result } = renderHook(() => useNotificationFeed());
    expect(result.current.notifications.map((n) => n.id)).toEqual(['pub', 'mine', 'deadline']);
  });

  it("shows the impersonated student's audience", () => {
    useAppStore.setState({ impersonation: { selection: { faculty: 'FRRMS' }, result: {} } as never });
    const { result } = renderHook(() => useNotificationFeed());
    expect(result.current.notifications.map((n) => n.id)).toEqual(['pub', 'deadline']);
  });
});
