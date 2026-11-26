// Review finding on PR #766 (Greptile): while the cache asks the store whether a held answer is
// still valid, a newer listing can drop that answer; it must not come back afterwards.
import { describe, it, expect } from 'vitest';
import { createToolCache } from '../cache';
import type { Persist } from '../cacheTypes';

const URL_A = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=1';
const listing = (modified: string) => async () => [
  { name: 'H', file: 'h.pdf', author: 'A', date: '1. 10. 2025', modified, downloadUrl: URL_A },
];

describe('a held answer checked against the disk', () => {
  it('is not brought back when a listing refresh drops it during the check', async () => {
    let release!: () => void;
    let checking!: () => void;
    const checked = new Promise<void>((r) => (checking = r));
    let gated = false;
    const persist: Persist = {
      begin: async () => null,
      load: async () => undefined,
      save: async () => undefined,
      stillValid: async () => {
        if (gated) {
          checking();
          await new Promise<void>((r) => (release = r));
        }
        return true;
      },
    };
    const cache = createToolCache({ persist });
    let reads = 0;
    const read = () =>
      cache.run('mendelu_read_file', { url: URL_A }, async () => `version ${++reads}`);
    await cache.run('mendelu_subject_files', { code: 'X' }, listing('20. 11. 2025'));
    expect(await read()).toBe('version 1');
    gated = true;
    const repeat = read();
    await checked;
    // The teacher replaced the file: the new listing date drops the held answer.
    await cache.run('mendelu_subject_files', { code: 'X' }, listing('21. 11. 2025'), undefined, {
      fresh: true,
    });
    gated = false;
    release();
    expect(await repeat).toBe('version 2');
    expect(await read()).toBe('version 2');
  });

  it('is served while it is still the held answer and still valid', async () => {
    const persist: Persist = {
      begin: async () => null,
      load: async () => undefined,
      save: async () => undefined,
      stillValid: async () => true,
    };
    const cache = createToolCache({ persist });
    let reads = 0;
    await cache.run('mendelu_subject_files', { code: 'X' }, listing('20. 11. 2025'));
    const read = () =>
      cache.run('mendelu_read_file', { url: URL_A }, async () => `version ${++reads}`);
    await read();
    expect(await read()).toBe('version 1');
    expect(reads).toBe(1);
  });
});
