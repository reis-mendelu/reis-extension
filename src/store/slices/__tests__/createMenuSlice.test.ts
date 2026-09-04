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

describe('createMenuSlice — the store owns the request guard', () => {
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

  // CodeRabbit was right and I was wrong in the thread: `!get().menu` gated the
  // LOADING FLAG, not the request, so every caller hit the network. The desktop
  // has two components calling this — WeeklyCalendarHeader mounts the popover
  // content and the header itself — so duplicate in-flight requests were real,
  // not theoretical.
  it('does not fire a second request while one is in flight', async () => {
    let release!: () => void;
    vi.mocked(apiFetchMenu).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      })
    );
    const first = useAppStore.getState().fetchMenu();
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('does not refetch a menu it already has', async () => {
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
    useAppStore.setState({ menu: [{ outlet: 'X', days: [] }] } as never);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
  });

  // The language switch clears `menu` (useAppStore.ts), which is exactly what
  // reopens the guard — so the guard must not outlive the data it protects.
  it('fetches again once the language change has cleared the menu', async () => {
    useAppStore.setState({ menu: [{ outlet: 'X', days: [] }] } as never);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).not.toHaveBeenCalled();
    useAppStore.setState({ menu: null } as never);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
  });
});
