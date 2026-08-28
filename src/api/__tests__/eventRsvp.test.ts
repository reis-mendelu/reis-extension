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

import { fetchEventRsvps, setEventRsvp, hashStudentId } from '../eventRsvp';

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
  demo.on = false;
});

describe('hashStudentId', () => {
  it('is a 64-char lowercase sha-256 hex digest', async () => {
    const h = await hashStudentId('123456');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  // The raw IS id is a real student number. The table's own CHECK rejects
  // anything that is not a digest, but the client must not be the thing that
  // discovers that.
  it('never returns the raw id', async () => {
    expect(await hashStudentId('123456')).not.toContain('123456');
  });

  it('is stable, so a student sees their own RSVP again tomorrow', async () => {
    expect(await hashStudentId('123456')).toBe(await hashStudentId('123456'));
  });
});

describe('fetchEventRsvps', () => {
  it("asks for the counts and the caller's own answer in one call", async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', going_count: 3, interested_count: 2, my_status: 'going' }],
      error: null,
    });

    const result = await fetchEventRsvps(['e1', 'e2'], '123456');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_event_rsvps', {
      p_event_ids: ['e1', 'e2'],
      p_student_id: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(result.counts.e1).toEqual({ going: 3, interested: 2 });
    expect(result.mine.e1).toBe('going');
  });

  // An event nobody has answered is absent from the grouped result, not a row
  // of zeroes — the UI must still get a zero rather than undefined.
  it('reports zero for an event with no responses at all', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const result = await fetchEventRsvps(['e1'], '123456');
    expect(result.counts.e1).toEqual({ going: 0, interested: 0 });
    expect(result.mine.e1).toBeUndefined();
  });

  it('still returns counts when there is no student id yet', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', going_count: 5, interested_count: 1, my_status: null }],
      error: null,
    });
    const result = await fetchEventRsvps(['e1'], null);
    expect(rpc).toHaveBeenCalledWith('get_event_rsvps', {
      p_event_ids: ['e1'],
      p_student_id: null,
    });
    expect(result.counts.e1?.going).toBe(5);
  });

  it('makes no request for an empty event list', async () => {
    const result = await fetchEventRsvps([], '123456');
    expect(rpc).not.toHaveBeenCalled();
    expect(result.counts).toEqual({});
  });

  // A malformed row must not become NaN on a card.
  it('drops rows that do not match the expected shape', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', going_count: 'lots', interested_count: 2, my_status: null }],
      error: null,
    });
    const result = await fetchEventRsvps(['e1'], null);
    expect(result.counts.e1).toEqual({ going: 0, interested: 0 });
  });

  it('degrades to zeroes rather than throwing when Supabase errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const result = await fetchEventRsvps(['e1'], '123456');
    expect(result.counts.e1).toEqual({ going: 0, interested: 0 });
  });
});

describe('setEventRsvp', () => {
  it('sends the hashed id and the chosen status', async () => {
    rpc.mockResolvedValue({ error: null });
    const ok = await setEventRsvp('e1', '123456', 'going');
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('set_event_rsvp', {
      p_event_id: 'e1',
      p_student_id: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_status: 'going',
    });
  });

  it('clears the RSVP with a null status', async () => {
    rpc.mockResolvedValue({ error: null });
    await setEventRsvp('e1', '123456', null);
    expect(rpc).toHaveBeenCalledWith('set_event_rsvp', expect.objectContaining({ p_status: null }));
  });

  it('reports failure rather than throwing', async () => {
    rpc.mockResolvedValue({ error: { message: 'nope' } });
    expect(await setEventRsvp('e1', '123456', 'going')).toBe(false);
  });

  // The demo student is invented. Writing its hash would put fictional
  // attendance into the real counts every other student reads.
  it('writes nothing in demo mode', async () => {
    demo.on = true;
    expect(await setEventRsvp('e1', '123456', 'going')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('cannot write without a student id', async () => {
    expect(await setEventRsvp('e1', null, 'going')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
