import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../api/personProfile', () => ({
  fetchPersonProfile: vi.fn(),
}));

vi.mock('../../../utils/reportError', () => ({
  logError: vi.fn(),
}));

import { createPersonProfileSlice } from '../createPersonProfileSlice';
import { fetchPersonProfile } from '../../../api/personProfile';
import type { Language } from '../../types';

const mockFetch = vi.mocked(fetchPersonProfile);

interface SliceState {
  language: Language;
  personProfiles: Record<
    number,
    { data: unknown; fetchedAt: number; lang: Language; error?: string }
  >;
  personProfilesLoading: Record<number, boolean>;
}

/** Just enough of a profile for the cache to hold something distinguishable. */
const profile = (name: string) => ({ personId: 1, name }) as never;

describe('createPersonProfileSlice', () => {
  let state: SliceState;
  let slice: ReturnType<typeof createPersonProfileSlice>;

  /** The cache entry, asserted present — its absence is itself the failure. */
  const cached = (personId = 1) => {
    const found = state.personProfiles[personId];
    if (!found) throw new Error(`no cache entry for person ${personId}`);
    return found;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state = { language: 'cz', personProfiles: {}, personProfilesLoading: {} };
    const set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      Object.assign(state, patch);
      Object.assign(slice, patch);
    });
    const get = vi.fn(() => ({ ...state, ...slice }));
    slice = createPersonProfileSlice(set as never, get as never, {} as never) as ReturnType<
      typeof createPersonProfileSlice
    >;
    state.personProfiles = slice.personProfiles;
    state.personProfilesLoading = slice.personProfilesLoading;
  });

  it('passes the app language straight through — the store speaks IS codes already', async () => {
    mockFetch.mockResolvedValue(profile('Jan Novák'));

    await slice.fetchPersonProfileById(1);

    expect(mockFetch).toHaveBeenCalledWith(1, 'cz');
    expect(cached().lang).toBe('cz');
  });

  it('re-fetches when the cached entry is in another language', async () => {
    mockFetch.mockResolvedValue(profile('Jan Novák'));
    await slice.fetchPersonProfileById(1);

    state.language = 'en';
    mockFetch.mockResolvedValue(profile('Jan Novak'));
    await slice.fetchPersonProfileById(1);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(1, 'en');
    expect(cached().lang).toBe('en');
  });

  it('serves the cache when the language still matches', async () => {
    mockFetch.mockResolvedValue(profile('Jan Novák'));
    await slice.fetchPersonProfileById(1);
    await slice.fetchPersonProfileById(1);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('discards a result whose language the student left mid-request', async () => {
    // The card is open in Czech, the request is in flight, and the student
    // flips the toggle. The Czech HTML must not be written as the current
    // entry — that is #206 again, one language behind.
    let resolveCz: (v: unknown) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveCz = r as (v: unknown) => void;
        })
    );

    const inFlight = slice.fetchPersonProfileById(1);
    state.language = 'en';
    mockFetch.mockResolvedValue(profile('Jan Novak'));
    resolveCz(profile('Jan Novák'));
    await inFlight;

    expect(mockFetch).toHaveBeenLastCalledWith(1, 'en');
    expect(cached().lang).toBe('en');
    expect(cached().data).toEqual(expect.objectContaining({ name: 'Jan Novak' }));
    expect(state.personProfilesLoading[1]).toBe(false);
  });

  it('re-fetches after a language switch even when the stale request failed', async () => {
    let rejectCz: (e: unknown) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((_r, reject) => {
          rejectCz = reject;
        })
    );

    const inFlight = slice.fetchPersonProfileById(1);
    state.language = 'en';
    mockFetch.mockResolvedValue(profile('Jan Novak'));
    rejectCz(new Error('network'));
    await inFlight;

    expect(mockFetch).toHaveBeenLastCalledWith(1, 'en');
    expect(cached().lang).toBe('en');
    expect(cached().error).toBeUndefined();
  });

  it('records the failure when the language did not change', async () => {
    mockFetch.mockRejectedValue(new Error('network'));

    await slice.fetchPersonProfileById(1);

    expect(cached().error).toBe('network');
    expect(state.personProfilesLoading[1]).toBe(false);
  });
});
