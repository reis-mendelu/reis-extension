import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const set = vi.fn();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: (...a: unknown[]) => get(...a),
    set: (...a: unknown[]) => set(...a),
  },
}));

import { createErrorReportingSlice } from '../createErrorReportingSlice';
import type { ErrorReportingSlice } from '../../types';

describe('createErrorReportingSlice', () => {
  let state: ErrorReportingSlice;
  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    const setState = vi.fn((u) => {
      state = { ...state, ...(typeof u === 'function' ? u(state) : u) };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createErrorReportingSlice(setState as any, (() => state) as any, {} as any);
  });

  // The privacy defect this pins: initTelemetry is wired at module load in
  // main.tsx, but the persisted opt-out is read from IndexedDB asynchronously
  // and is not awaited. Until it resolves, `errorReportingEnabled` still holds
  // its optimistic default, so a student who had switched reporting OFF was
  // still transmitting during startup — which is precisely when sync and parse
  // errors fire. Reporting must stay closed until the real preference is known.
  it('starts unhydrated so nothing is transmitted before the stored choice is read', () => {
    expect(state.errorReportingHydrated).toBe(false);
  });

  it('hydrates to the stored opt-out', async () => {
    get.mockResolvedValue(false);
    await state.loadErrorReportingEnabled();
    expect(state.errorReportingEnabled).toBe(false);
    expect(state.errorReportingHydrated).toBe(true);
  });

  it('hydrates for a student who never touched the setting', async () => {
    get.mockResolvedValue(undefined);
    await state.loadErrorReportingEnabled();
    expect(state.errorReportingEnabled).toBe(true);
    expect(state.errorReportingHydrated).toBe(true);
  });

  // Fail closed, and only for this session: if the preference cannot be read we
  // do not know it, so we do not transmit. The next launch retries. Marking
  // hydrated here instead would resurrect the exact bug for anyone whose read
  // failed — the opted-out student is the one likeliest to be harmed by a guess.
  it('stays closed for the session when the stored value cannot be read', async () => {
    get.mockRejectedValue(new Error('idb unavailable'));
    await state.loadErrorReportingEnabled();
    expect(state.errorReportingHydrated).toBe(false);
  });

  it('an explicit choice counts as hydrated immediately', async () => {
    set.mockResolvedValue(undefined);
    await state.setErrorReportingEnabled(false);
    expect(state.errorReportingEnabled).toBe(false);
    expect(state.errorReportingHydrated).toBe(true);
  });
});
