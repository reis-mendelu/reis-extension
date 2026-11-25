import { describe, it, expect, vi } from 'vitest';
import { createToolCache } from '../cache';
import type { Persist } from '../cacheTypes';

const URL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=2';
const listing = (modified: string) => [{ downloadUrl: URL, date: '1. 10. 2025', modified }];

function persistStub() {
  const saves: unknown[][] = [];
  const persist: Persist = {
    begin: async () => 'token',
    load: async () => undefined,
    save: async (...a) => void saves.push(a),
  };
  return { persist, saves };
}

describe('a call that began before clear() (forget everything)', () => {
  it('keeps nothing in memory and saves nothing, though it finishes afterwards', async () => {
    const { persist, saves } = persistStub();
    const cache = createToolCache({ persist });
    const stale = await cache.ticket(); // taken, then a forget completes
    cache.clear();
    const run = vi.fn(async () => ({ n: 1 }));
    await cache.run('mendelu_subjects', {}, run, stale);
    expect(saves).toEqual([]);
    await cache.run('mendelu_subjects', {}, run); // not remembered: asks again
    expect(run).toHaveBeenCalledTimes(2);
    expect(saves).toHaveLength(1); // the call that began after the forget is saved
  });

  it('does not bring back listing dates the forget cleared', async () => {
    const reads: (string | undefined)[] = [];
    const { persist } = persistStub();
    const cache = createToolCache({
      persist: {
        ...persist,
        load: async (tool, _args, stamp) => {
          if (tool === 'mendelu_read_file') reads.push(stamp);
        },
      },
    });
    const stale = await cache.ticket(); // a listing call begins, then a forget completes
    cache.clear();
    const files = async () => listing('modified 24. 11. 2025');
    await cache.run('mendelu_subject_files', { code: 'X1' }, files, stale);
    await cache.run('mendelu_read_file', { url: URL }, async () => ({ kind: 'text', text: 't' }));
    expect(reads).toEqual([undefined]); // no date is known for the file: nothing to vouch with
  });
});
