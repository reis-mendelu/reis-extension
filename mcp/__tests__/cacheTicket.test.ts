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

/**
 * Desktop and every Claude Code window run their own server, each with its own memory, over
 * one folder. A forget in one replaces the folder's token (storeMap.ts begin(): `{ gen }`);
 * the others see it at their next call and must not answer from what they held.
 */
describe('a forget run by another process', () => {
  function sharedFolder() {
    let gen = 'g1';
    const persist: Persist = {
      begin: async () => ({ gen, at: 0 }),
      load: async () => undefined,
      save: async () => undefined,
    };
    return { persist, forgetElsewhere: () => (gen = `g${Number(gen.slice(1)) + 1}`) };
  }

  it('drops what this process held: the next call asks IS again', async () => {
    const { persist, forgetElsewhere } = sharedFolder();
    const cache = createToolCache({ persist });
    const run = vi.fn(async () => ({ text: 'skripta' }));
    await cache.run('mendelu_subjects', {}, run, await cache.ticket());
    await cache.run('mendelu_subjects', {}, run, await cache.ticket()); // held: not asked again
    expect(run).toHaveBeenCalledTimes(1);
    forgetElsewhere();
    await cache.run('mendelu_subjects', {}, run, await cache.ticket());
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps nothing from a call that began before it and finishes after', async () => {
    const { persist, forgetElsewhere } = sharedFolder();
    const cache = createToolCache({ persist });
    let finish!: (v: unknown) => void;
    const slow = cache.run(
      'mendelu_subjects',
      {},
      () => new Promise((r) => (finish = r)),
      await cache.ticket()
    );
    forgetElsewhere();
    const later = await cache.ticket(); // another call starts after the forget
    finish({ text: 'old' });
    await slow;
    const run = vi.fn(async () => ({ text: 'new' }));
    expect(await cache.run('mendelu_subjects', {}, run, later)).toEqual({ text: 'new' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing from a call whose ticket was still being taken when this process forgot', async () => {
    let gen = 'g1';
    let hold: Promise<void> | undefined;
    const persist: Persist = {
      begin: async () => {
        await hold;
        return { gen, at: 0 };
      },
      load: async () => undefined,
      save: async () => undefined,
    };
    const cache = createToolCache({ persist });
    await cache.ticket(); // the folder token is known
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    const waiting = cache.ticket(); // a call begins, its ticket waits on the folder
    cache.clear(); // forget everything, in this process
    gen = 'g2';
    hold = undefined;
    release();
    await cache.run('mendelu_subjects', {}, async () => ({ text: 'old' }), await waiting);
    const run = vi.fn(async () => ({ text: 'new' }));
    await cache.run('mendelu_subjects', {}, run, await cache.ticket());
    expect(run).toHaveBeenCalledTimes(1); // nothing was kept from the call that began before
  });

  it('holds answers as before while nobody forgets', async () => {
    const { persist } = sharedFolder();
    const cache = createToolCache({ persist });
    const run = vi.fn(async () => ({ n: 1 }));
    for (let i = 0; i < 3; i++) await cache.run('mendelu_subjects', {}, run, await cache.ticket());
    expect(run).toHaveBeenCalledTimes(1);
  });
});
