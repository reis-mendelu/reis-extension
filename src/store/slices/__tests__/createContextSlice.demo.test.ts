import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

const getUserParams = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/userParams', () => ({ getUserParams }));

describe('createContextSlice in demo mode', () => {
  beforeEach(() => {
    getUserParams.mockReset();
    useAppStore.setState({ demoMode: false, studiumId: null, fullName: null });
  });

  // getUserParams goes through fetchWithAuth, which throws DemoModeError in
  // demo mode. Letting it run cost a toast the student never asked for, and
  // — worse — the catch left the fabricated context unset.
  it('does not reach IS, and leaves the fabricated context intact', async () => {
    useAppStore.setState({ demoMode: true, studiumId: '900001', fullName: 'Jana Ukázková' });

    await useAppStore.getState().loadContext();

    expect(getUserParams).not.toHaveBeenCalled();
    expect(useAppStore.getState().studiumId).toBe('900001');
    expect(useAppStore.getState().fullName).toBe('Jana Ukázková');
  });

  it('still loads normally when demo mode is off', async () => {
    getUserParams.mockResolvedValue({ studium: 900002, fullName: 'Real Student' });

    await useAppStore.getState().loadContext();

    expect(getUserParams).toHaveBeenCalled();
    expect(useAppStore.getState().studiumId).toBe('900002');
  });
});
