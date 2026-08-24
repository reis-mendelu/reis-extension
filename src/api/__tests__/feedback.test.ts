import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitFeedback, trackDailyUsage } from '../feedback';
import { useAppStore } from '../../store/useAppStore';

describe('feedback', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ demoMode: false });
  });

  // The demo student is fabricated, so a demo submission would put a hash of a
  // fiction into the real feedback table — the same reasoning that already
  // guards trackDailyUsage, applied to the other write it shares a file with.
  it('does not submit feedback in demo mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAppStore.setState({ demoMode: true });

    await expect(submitFeedback('900001', 'nps', '9', 'ZS2026')).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not track usage in demo mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAppStore.setState({ demoMode: true });

    await trackDailyUsage('123456');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
