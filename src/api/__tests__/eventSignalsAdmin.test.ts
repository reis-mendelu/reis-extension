import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/services/admin/authClient', () => ({ adminAuthClient: { rpc } }));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));

import { fetchEventSignals } from '../eventSignalsAdmin';

/** Seen / Opened / Link totals per event, as the admin console reads them. */
describe('fetchEventSignals', () => {
  beforeEach(() => rpc.mockReset());

  it('asks for the events and maps the totals, zero for an event with no row', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'a', seen: 40, opened: 12, link_taps: 3 }],
      error: null,
    });
    const r = await fetchEventSignals(['a', 'b']);
    expect(rpc).toHaveBeenCalledWith('event_signals', { p_event_ids: ['a', 'b'] });
    expect(r).toEqual({
      ok: true,
      totals: { a: { seen: 40, opened: 12, linkTaps: 3 }, b: { seen: 0, opened: 0, linkTaps: 0 } },
    });
  });

  it('reports a failure rather than zeros', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect((await fetchEventSignals(['a'])).ok).toBe(false);
  });

  it('asks nothing for no events', async () => {
    expect(await fetchEventSignals([])).toEqual({ ok: true, totals: {} });
    expect(rpc).not.toHaveBeenCalled();
  });
});
