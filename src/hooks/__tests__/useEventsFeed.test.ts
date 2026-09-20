import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockFetchEvents = vi.fn();
const mockIDBGet = vi.fn();
const mockIDBSet = vi.fn();
let language = 'cz';

vi.mock('../../api/events', () => ({
  fetchEvents: (...args: unknown[]) => mockFetchEvents(...args),
}));
vi.mock('../useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['pef'], isLoading: false }),
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: (selector: (s: { language: string }) => unknown) => selector({ language }),
}));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...args: unknown[]) => mockIDBGet(...args),
    set: (...args: unknown[]) => mockIDBSet(...args),
  },
}));

import { useEventsFeed } from '../useEventsFeed';
import type { MendeluEvent } from '../../types/events';

function event(title: string): MendeluEvent {
  return {
    title,
    url: `https://example.test/${title}`,
    date: '2026-09-20',
    endDate: null,
    time: null,
    location: null,
    imageUrl: null,
    organizerKey: 'pef',
  } as MendeluEvent;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('useEventsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    language = 'cz';
    mockIDBGet.mockResolvedValue(undefined);
  });

  it('stops showing the previous language’s events the moment the language changes', async () => {
    const cz = deferred<MendeluEvent[]>();
    const en = deferred<MendeluEvent[]>();
    mockFetchEvents.mockImplementation((lang: string) => (lang === 'cz' ? cz.promise : en.promise));

    const { result, rerender } = renderHook(() => useEventsFeed());

    await act(async () => cz.resolve([event('cz-event')]));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0]!.title).toBe('cz-event');

    // Switching language must not leave the Czech list on screen while the
    // English one is still in flight.
    language = 'en';
    rerender();
    expect(result.current.events).toEqual([]);

    await act(async () => en.resolve([event('en-event')]));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0]!.title).toBe('en-event');
  });

  it('hydrates from the per-language cache before the network answers', async () => {
    mockIDBGet.mockImplementation(async (_store: string, key: string) =>
      key === 'reis_events_cache_cz' ? [event('cached')] : undefined
    );
    const never = new Promise<MendeluEvent[]>(() => {});
    mockFetchEvents.mockReturnValue(never);

    const { result } = renderHook(() => useEventsFeed());

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0]!.title).toBe('cached');
  });
});
