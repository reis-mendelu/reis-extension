import { describe, it, expect, vi, beforeEach } from 'vitest';

const gate = vi.hoisted(() => ({ on: true }));
vi.mock('../transport', () => ({
  canBookLibrary: () => gate.on,
  nativeBookingsHttp: vi.fn(),
}));

import { warmUp } from '../libraryWatch';
import { LAST_OPENED_KEY, markOpened } from '../libraryCache';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';

// Prague instants: the library's hours are Prague's, and CI runs in UTC.
const at = (iso: string) => new Date(`${iso}+01:00`);
const FRI_10 = at('2026-11-27T10:00:00');
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  gate.on = true;
  await IndexedDBService.delete('meta', LAST_OPENED_KEY);
});

describe('warming the library read at app start', () => {
  it('starts the read for a device that opened the library lately, on a weekday in opening hours', async () => {
    await markOpened(FRI_10.getTime() - 3 * DAY);
    const load = vi.fn();
    await warmUp(load, FRI_10);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a device that never opened it, or not for two weeks', async () => {
    const load = vi.fn();
    await warmUp(load, FRI_10);
    await markOpened(FRI_10.getTime() - 15 * DAY);
    await warmUp(load, FRI_10);
    expect(load).not.toHaveBeenCalled();
  });

  it('does nothing at the weekend, in the evening, or at night', async () => {
    await markOpened(FRI_10.getTime() - DAY);
    const load = vi.fn();
    await warmUp(load, at('2026-11-28T10:00:00'));
    await warmUp(load, at('2026-11-27T19:30:00'));
    await warmUp(load, at('2026-11-27T06:30:00'));
    expect(load).not.toHaveBeenCalled();
  });

  it('does nothing where booking is not available (the extension, demo)', async () => {
    gate.on = false;
    await markOpened(FRI_10.getTime() - DAY);
    const load = vi.fn();
    await warmUp(load, FRI_10);
    expect(load).not.toHaveBeenCalled();
  });
});
