import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../useAppStore';

vi.mock('../../../api/menu', () => ({ fetchMenu: vi.fn() }));
import { fetchMenu as apiFetchMenu } from '../../../api/menu';

describe('createMenuSlice', () => {
  beforeEach(() => {
    vi.mocked(apiFetchMenu).mockReset();
    vi.mocked(apiFetchMenu).mockResolvedValue([]);
    useAppStore.setState({
      menu: null,
      menuLoading: false,
      menuError: false,
      demoMode: false,
    } as never);
  });

  it('fetches the menu normally', async () => {
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalled();
  });

  // The menu is scraped from skm.mendelu.cz through the content-script proxy,
  // which in demo mode there is nothing behind: `fetchViaProxy` posts and waits
  // out its full 30-second timeout. Every other IS-facing call already returns
  // early in demo (see api/feedback.ts, api/eventRsvp.ts); this one did not,
  // and it is now on the calendar, so the demo boot sat on a pending request
  // for half a minute — long enough to time out the Capacitor boot test.
  it('does not reach the proxy in demo mode, and does not sit in a loading state', async () => {
    useAppStore.setState({ demoMode: true } as never);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).not.toHaveBeenCalled();
    expect(useAppStore.getState().menuLoading).toBe(false);
    expect(useAppStore.getState().menuError).toBe(false);
  });
});
