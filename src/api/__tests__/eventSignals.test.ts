import { describe, it, expect, vi, beforeEach } from 'vitest';

const { meta, rpc } = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  rpc: vi.fn(async (..._a: unknown[]) => ({ error: null as { message: string } | null })),
}));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => meta.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void meta.set(k, v)),
  },
}));
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('../../utils/firefoxDataConsent', () => ({ hasDataConsent: async () => true }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => false }));
vi.mock('../../utils/harnessEnabled', () => ({ isHarnessEnabled: () => false }));

import { trackEventSignal, __resetEventSignalsForTests } from '../eventSignals';

/**
 * Seen / Opened / Link per society event (spec 2026-10-08). The server gets an
 * event id and nothing else; "once per device" is remembered here, locally.
 */
describe('trackEventSignal', () => {
  beforeEach(() => {
    meta.clear();
    rpc.mockClear();
    __resetEventSignalsForTests();
  });

  it('sends the event id and the signal, nothing else', async () => {
    await trackEventSignal('e1', 'seen');
    expect(rpc).toHaveBeenCalledWith('increment_event_signal', { row_id: 'e1', signal: 'seen' });
  });

  it('once per device per event per signal, across restarts', async () => {
    await trackEventSignal('e1', 'opened');
    __resetEventSignalsForTests(); // a new session, same IndexedDB
    await trackEventSignal('e1', 'opened');
    await trackEventSignal('e1', 'link');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('a failed write is retried next time', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'x' } });
    await trackEventSignal('e2', 'seen');
    await trackEventSignal('e2', 'seen');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
