import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IndexedDBService } from '../storage';
import {
  claimFirstOpen,
  releaseOpen,
  __resetCountedOpensForTests,
  __forgetCountedOpensMemoryForTests,
} from './countedOpens';

const DAY = 24 * 60 * 60 * 1000;

describe('countedOpens', () => {
  beforeEach(async () => {
    await __resetCountedOpensForTests();
  });
  afterEach(() => vi.useRealTimers());

  it('lets the first open of an event through and refuses the second', async () => {
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(false);
  });

  it('keeps events apart', async () => {
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
    expect(await claimFirstOpen('map_open', 'ev2')).toBe(true);
  });

  // A student who opens an event from the feed and again from the map is one
  // click on each surface; the two counters are unjoinable by design.
  it('keeps the two surfaces apart', async () => {
    expect(await claimFirstOpen('novinky_click', 'ev1')).toBe(true);
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
  });

  it('lets only one of two simultaneous claims through', async () => {
    const results = await Promise.all([
      claimFirstOpen('map_open', 'ev1'),
      claimFirstOpen('map_open', 'ev1'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('remembers across a restart (reads it back from IndexedDB)', async () => {
    await claimFirstOpen('novinky_click', 'ev1');
    __forgetCountedOpensMemoryForTests();
    expect(await claimFirstOpen('novinky_click', 'ev1')).toBe(false);
  });

  it('gives the open back when the write failed, so the next tap counts', async () => {
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
    await releaseOpen('map_open', 'ev1');
    __forgetCountedOpensMemoryForTests();
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
  });

  it('forgets an event counted more than half a year ago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await claimFirstOpen('map_open', 'old');
    vi.setSystemTime(Date.now() + 200 * DAY);
    __forgetCountedOpensMemoryForTests();
    await claimFirstOpen('map_open', 'fresh');
    const stored = (await IndexedDBService.get('meta', 'counted_opens_map_open')) as Record<
      string,
      number
    >;
    expect(Object.keys(stored)).toEqual(['fresh']);
  });

  it('still dedupes inside the session when IndexedDB is unusable', async () => {
    const get = vi.spyOn(IndexedDBService, 'get').mockRejectedValue(new Error('blocked'));
    const set = vi.spyOn(IndexedDBService, 'set').mockRejectedValue(new Error('blocked'));
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(false);
    get.mockRestore();
    set.mockRestore();
  });
});
