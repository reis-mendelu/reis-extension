import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
const demo = { on: false };
vi.mock('../../errors/demoMode', () => ({
  isDemoMode: () => demo.on,
  DemoModeError: class extends Error {},
}));
vi.mock('../../services/identity/installId', () => ({
  getInstallId: async () => '11111111-2222-3333-4444-555555555555',
}));

import { fetchEventRsvps, setEventRsvp } from '../eventRsvp';

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
  demo.on = false;
});

describe('fetchEventRsvps', () => {
  // The whole point of the redesign: the server is never told who is asking,
  // so there is no identity argument and nothing to use as a lookup oracle.
  it('sends no identity of any kind', async () => {
    await fetchEventRsvps(['e1']);
    expect(rpc).toHaveBeenCalledWith('get_event_rsvps', { p_event_ids: ['e1'] });
    expect(Object.keys(rpc.mock.calls[0]?.[1] ?? {})).toEqual(['p_event_ids']);
  });

  it('returns the counts it was given', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', going_count: 3, interested_count: 2 }],
      error: null,
    });
    const r = await fetchEventRsvps(['e1']);
    expect(r.counts.e1).toEqual({ going: 3, interested: 2 });
    expect(r.ok).toBe(true);
  });

  it('reports zero for an event nobody answered', async () => {
    const r = await fetchEventRsvps(['e1']);
    expect(r.counts.e1).toEqual({ going: 0, interested: 0 });
  });

  it('makes no request for an empty list', async () => {
    const r = await fetchEventRsvps([]);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });

  it('drops a malformed row rather than rendering NaN', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', going_count: 'lots', interested_count: 2 }],
      error: null,
    });
    expect((await fetchEventRsvps(['e1'])).counts.e1).toEqual({ going: 0, interested: 0 });
  });

  // A failed load must be distinguishable from "nobody answered", or the
  // reminder planner cancels notifications for events still being attended.
  it('reports failure rather than a confident zero', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const r = await fetchEventRsvps(['e1']);
    expect(r.ok).toBe(false);
    expect(r.counts.e1).toEqual({ going: 0, interested: 0 });
  });

  it('reports failure when the call throws', async () => {
    rpc.mockRejectedValue(new Error('offline'));
    expect((await fetchEventRsvps(['e1'])).ok).toBe(false);
  });
});

describe('setEventRsvp', () => {
  it('identifies the device by a random install id, never the student', async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await setEventRsvp('e1', 'going')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('set_event_rsvp', {
      p_event_id: 'e1',
      p_install_id: '11111111-2222-3333-4444-555555555555',
      p_status: 'going',
    });
  });

  it('clears the answer with a null status', async () => {
    rpc.mockResolvedValue({ error: null });
    await setEventRsvp('e1', null);
    expect(rpc).toHaveBeenCalledWith('set_event_rsvp', expect.objectContaining({ p_status: null }));
  });

  it('reports failure rather than throwing', async () => {
    rpc.mockResolvedValue({ error: { message: 'nope' } });
    expect(await setEventRsvp('e1', 'going')).toBe(false);
  });

  it('writes nothing in demo mode', async () => {
    demo.on = true;
    expect(await setEventRsvp('e1', 'going')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
