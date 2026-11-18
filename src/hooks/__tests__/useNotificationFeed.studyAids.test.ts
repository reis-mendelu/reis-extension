import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useNotificationFeed } from '../useNotificationFeed';

/**
 * The study-aids audience is public content a long-lived session would never
 * see change: the phone's process can stay alive for days, and boot is the only
 * other time it is read. The feed's own refresh (every five minutes, both
 * trees) asks again, with a minimum gap, so switching the link off or changing
 * its programmes reaches students without an app restart, and a read that
 * failed at boot is retried once the network is back.
 */
describe('the Novinky feed refresh', () => {
  it('asks for the study-aids audience again, with a gap so it is not a request per refresh', async () => {
    const loadStudyAidsIfStale = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      loadStudyAidsIfStale,
      fetchNotifications: vi.fn().mockResolvedValue(undefined),
      refreshQuestions: vi.fn().mockResolvedValue(undefined),
      loadIsNoticesIfStale: vi.fn().mockResolvedValue(undefined),
    } as never);
    const { result } = renderHook(() => useNotificationFeed());
    await act(async () => {
      await result.current.load();
    });
    expect(loadStudyAidsIfStale).toHaveBeenCalledTimes(1);
    const gap = loadStudyAidsIfStale.mock.calls[0]![0] as number;
    // Longer than one refresh, so most refreshes cost nothing; short enough
    // that a change reaches a student the same day.
    expect(gap).toBeGreaterThan(5 * 60_000);
    expect(gap).toBeLessThanOrEqual(60 * 60_000);
  });
});
