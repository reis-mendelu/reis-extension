import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IndexedDBService } from '../storage';
import {
  claimFirstOpen,
  confirmOpen,
  releaseOpen,
  __resetCountedOpensForTests,
  __forgetCountedOpensMemoryForTests,
} from './countedOpens';

const DAY = 24 * 60 * 60 * 1000;
const restart = __forgetCountedOpensMemoryForTests;

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

  it('remembers a confirmed open across a restart', async () => {
    await claimFirstOpen('novinky_click', 'ev1');
    await confirmOpen('novinky_click', 'ev1');
    restart();
    expect(await claimFirstOpen('novinky_click', 'ev1')).toBe(false);
  });

  // The tab closed between the claim and the server's answer: nothing was
  // written down, so the next launch counts this device.
  it('retries an open that was claimed but never confirmed', async () => {
    await claimFirstOpen('map_open', 'ev1');
    restart();
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
  });

  it('gives the open back when the request failed, so the next tap counts', async () => {
    await claimFirstOpen('map_open', 'ev1');
    releaseOpen('map_open', 'ev1');
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
  });

  // Another tab confirmed this event after this tab started: the saved map is
  // read fresh at claim time, not trusted from an earlier read.
  it('sees what another tab confirmed, and does not erase it', async () => {
    await claimFirstOpen('map_open', 'ev1');
    await IndexedDBService.set('meta', 'counted_opens_map_open', { ev2: Date.now() });
    expect(await claimFirstOpen('map_open', 'ev2')).toBe(false);
    await confirmOpen('map_open', 'ev1');
    const stored = (await IndexedDBService.get('meta', 'counted_opens_map_open')) as Record<
      string,
      number
    >;
    expect(Object.keys(stored).sort()).toEqual(['ev1', 'ev2']);
  });

  it('forgets an event counted more than half a year ago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await confirmOpen('map_open', 'old');
    vi.setSystemTime(Date.now() + 200 * DAY);
    await confirmOpen('map_open', 'fresh');
    const stored = (await IndexedDBService.get('meta', 'counted_opens_map_open')) as Record<
      string,
      number
    >;
    expect(Object.keys(stored)).toEqual(['fresh']);
  });

  it('still dedupes inside the session when IndexedDB is unusable, and says so locally', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const get = vi.spyOn(IndexedDBService, 'get').mockRejectedValue(new Error('blocked'));
    const set = vi.spyOn(IndexedDBService, 'set').mockRejectedValue(new Error('blocked'));
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(true);
    await confirmOpen('map_open', 'ev1');
    expect(await claimFirstOpen('map_open', 'ev1')).toBe(false);
    expect(err).toHaveBeenCalled();
    get.mockRestore();
    set.mockRestore();
    err.mockRestore();
  });
});
