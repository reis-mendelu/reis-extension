import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackDailyUsage } from '../feedback';
import { useAppStore } from '../../store/useAppStore';

describe('feedback', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ demoMode: false });
  });

  it('does not track usage in demo mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAppStore.setState({ demoMode: true });

    await trackDailyUsage('123456');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
