import { describe, it, expect, vi } from 'vitest';
import { createToolCache, TTL_MS } from '../cache';
import { TOOLS } from '../tools';

const MIN = 60_000;

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createToolCache', () => {
  it('answers a repeat from memory until the tool TTL runs out', async () => {
    const c = clock();
    const cache = createToolCache({ now: c.now });
    const run = vi.fn(async () => ({ subjects: 1 }));
    await cache.run('mendelu_subjects', {}, run);
    c.advance(TTL_MS.mendelu_subjects! - 1);
    await cache.run('mendelu_subjects', {}, run);
    expect(run).toHaveBeenCalledTimes(1);
    c.advance(1);
    await cache.run('mendelu_subjects', {}, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('fresh asks IS again inside the TTL and keeps the new answer, other calls still hit the cache', async () => {
    const cache = createToolCache({ now: clock().now });
    let n = 0;
    const run = vi.fn(async () => ++n);
    expect(await cache.run('mendelu_exams', {}, run)).toBe(1);
    expect(await cache.run('mendelu_exams', {}, run)).toBe(1); // cached
    expect(await cache.run('mendelu_exams', {}, run, undefined, { fresh: true })).toBe(2);
    expect(await cache.run('mendelu_exams', {}, run)).toBe(2); // the fresh answer is what is held now
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('fresh does not join a request already in flight', async () => {
    const cache = createToolCache({ now: clock().now });
    let release!: () => void;
    const slow = vi.fn(() => new Promise<string>((r) => (release = () => r('old'))));
    const quick = vi.fn(async () => 'new');
    const first = cache.run('mendelu_points', { code: 'X' }, slow);
    expect(
      await cache.run('mendelu_points', { code: 'X' }, quick, undefined, { fresh: true })
    ).toBe('new');
    release();
    expect(await first).toBe('old');
    expect(await cache.run('mendelu_points', { code: 'X' }, quick)).toBe('new'); // not overwritten by the old one
  });

  it('a listing that finishes after a fresher one does not put its older file dates back', async () => {
    const stamps: (string | undefined)[] = [];
    const persist = {
      begin: async () => null,
      load: async (tool: string, _a: unknown, stamp: string | undefined) => {
        if (tool === 'mendelu_read_file') stamps.push(stamp);
        return undefined;
      },
      save: async () => {},
    };
    const cache = createToolCache({ now: clock().now, persist });
    const url = 'https://is.mendelu.cz/x?download=1';
    let release!: () => void;
    const older = cache.run(
      'mendelu_subject_files',
      { code: 'X' },
      () => new Promise((r) => (release = () => r([{ downloadUrl: url, modified: '1. 1. 2026' }])))
    );
    await cache.run(
      'mendelu_subject_files',
      { code: 'X' },
      async () => [{ downloadUrl: url, modified: '5. 1. 2026' }],
      undefined,
      { fresh: true }
    );
    release();
    await older;
    await cache.run('mendelu_read_file', { url }, async () => ({ kind: 'text', text: 't' }));
    expect(stamps).toEqual(['modified 5. 1. 2026']);
  });

  it('keys on the arguments but not on response_format', async () => {
    const cache = createToolCache({ now: clock().now });
    const run = vi.fn(async () => 'x');
    await cache.run('mendelu_syllabus', { predmet: '1', lang: 'cz' }, run);
    await cache.run('mendelu_syllabus', { lang: 'cz', predmet: '1', response_format: 'json' }, run);
    expect(run).toHaveBeenCalledTimes(1);
    await cache.run('mendelu_syllabus', { predmet: '2', lang: 'cz' }, run);
    await cache.run('mendelu_syllabus', { predmet: '1', lang: 'en' }, run);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('never keeps a failure', async () => {
    const cache = createToolCache({ now: clock().now });
    const run = vi.fn().mockRejectedValueOnce(new Error('IS busy')).mockResolvedValue('ok');
    await expect(cache.run('mendelu_subjects', {}, run)).rejects.toThrow('IS busy');
    await expect(cache.run('mendelu_subjects', {}, run)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('asks IS once when two identical calls arrive together', async () => {
    const cache = createToolCache({ now: clock().now });
    let finish!: (v: string) => void;
    const run = vi.fn(() => new Promise<string>((r) => (finish = r)));
    const a = cache.run('mendelu_exams', {}, run);
    const b = cache.run('mendelu_exams', {}, run);
    finish('terms');
    expect(await Promise.all([a, b])).toEqual(['terms', 'terms']);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('shares a failure between calls that were in flight together, then forgets it', async () => {
    const cache = createToolCache({ now: clock().now });
    const run = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('up');
    const a = cache.run('mendelu_exams', {}, run);
    const b = cache.run('mendelu_exams', {}, run);
    await expect(a).rejects.toThrow('down');
    await expect(b).rejects.toThrow('down');
    await expect(cache.run('mendelu_exams', {}, run)).resolves.toBe('up');
  });

  it('keeps what a student just did visible within a minute', () => {
    // Uploading a file, registering for a term or a teacher entering points must
    // show up when the student asks again: these never sit in memory longer.
    for (const t of ['mendelu_assignments', 'mendelu_exams', 'mendelu_points', 'mendelu_grades']) {
      expect(TTL_MS[t], t).toBeLessThanOrEqual(MIN);
    }
  });

  it('has a TTL for every tool, so a new tool is a decision', () => {
    expect(Object.keys(TTL_MS).sort()).toEqual(TOOLS.map((t) => t.name).sort());
  });

  it('rereads a file once its folder listing shows it was modified', async () => {
    const c = clock();
    const cache = createToolCache({ now: c.now });
    const url = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=1;id=2;z=1';
    const read = vi.fn(async () => ({ text: 'v' }));
    let listing = [{ name: 'Lecture', date: '01.10.2026', downloadUrl: url }];
    const list = () => Promise.resolve(listing);

    await cache.run('mendelu_subject_files', { code: 'EBC-PS' }, list);
    await cache.run('mendelu_read_file', { url }, read);
    await cache.run('mendelu_read_file', { url }, read);
    expect(read).toHaveBeenCalledTimes(1);

    // Same listing again: the file stays in memory.
    c.advance(TTL_MS.mendelu_subject_files!);
    await cache.run('mendelu_subject_files', { code: 'EBC-PS' }, list);
    await cache.run('mendelu_read_file', { url }, read);
    expect(read).toHaveBeenCalledTimes(1);

    // The teacher replaced the file: same link, a Modifikace date.
    c.advance(TTL_MS.mendelu_subject_files!);
    listing = [{ ...listing[0]!, modified: '20.11.2026' } as (typeof listing)[number]];
    await cache.run('mendelu_subject_files', { code: 'EBC-PS' }, list);
    await cache.run('mendelu_read_file', { url }, read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('never keeps a read that was still downloading when the listing showed a new version', async () => {
    const cache = createToolCache({ now: clock().now });
    const url = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=1;id=2;z=1';
    const row = { name: 'Brief', date: '01.10.2026', downloadUrl: url };
    await cache.run('mendelu_subject_files', { code: 'X' }, async () => [row]);

    let finishOld!: (v: string) => void;
    const old = cache.run(
      'mendelu_read_file',
      { url },
      () => new Promise<string>((r) => (finishOld = r))
    );
    // The teacher replaces the file while the old copy is still downloading.
    await cache.run('mendelu_subject_files', { code: 'Y' }, async () => [
      { ...row, modified: '20.11.2026' },
    ]);
    const fresh = vi.fn(async () => 'new brief');
    // Does not join the old download…
    await expect(cache.run('mendelu_read_file', { url }, fresh)).resolves.toBe('new brief');
    finishOld('old brief');
    await expect(old).resolves.toBe('old brief');
    // …and the old download, finishing last, does not overwrite the new copy.
    await expect(cache.run('mendelu_read_file', { url }, fresh)).resolves.toBe('new brief');
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('rereads a file read before any listing once a listing is seen, then keeps it', async () => {
    const cache = createToolCache({ now: clock().now });
    const url = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=1;id=2;z=1';
    const read = vi.fn(async () => 'text');
    await cache.run('mendelu_read_file', { url }, read);
    const listing = async () => [{ name: 'Brief', date: '01.10.2026', downloadUrl: url }];
    await cache.run('mendelu_subject_files', { code: 'X' }, listing);
    await cache.run('mendelu_read_file', { url }, read);
    expect(read).toHaveBeenCalledTimes(2);
    await cache.run('mendelu_subject_files', { code: 'Y' }, listing);
    await cache.run('mendelu_read_file', { url }, read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('leaves pass rates to their fetcher, which retries a subject that failed', async () => {
    // fetchSubjectSuccessRates swallows a failed CDN request and answers
    // without that subject; keeping that answer would hide it for a day.
    const cache = createToolCache({ now: clock().now });
    const run = vi.fn(async () => ({ data: {} }));
    await cache.run('mendelu_success_rates', { codes: ['EBC-PS'] }, run);
    await cache.run('mendelu_success_rates', { codes: ['EBC-PS'] }, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('counts Czech text by the memory it takes, not by its length', async () => {
    const cache = createToolCache({ now: clock().now, maxBytes: 100 });
    const run = vi.fn(async () => 'č'.repeat(30));
    await cache.run('mendelu_syllabus', { predmet: '1' }, run);
    await cache.run('mendelu_syllabus', { predmet: '1' }, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('drops the oldest answers past the memory cap, and never keeps one bigger than it', async () => {
    const cache = createToolCache({ now: clock().now, maxBytes: 300 });
    const big = 'x'.repeat(60);
    const run = vi.fn(async () => big);
    await cache.run('mendelu_syllabus', { predmet: '1' }, run);
    await cache.run('mendelu_syllabus', { predmet: '2' }, run);
    await cache.run('mendelu_syllabus', { predmet: '2' }, run);
    expect(run).toHaveBeenCalledTimes(2);
    await cache.run('mendelu_syllabus', { predmet: '1' }, run);
    expect(run).toHaveBeenCalledTimes(3);

    const huge = vi.fn(async () => 'y'.repeat(200));
    await cache.run('mendelu_syllabus', { predmet: '3' }, huge);
    await cache.run('mendelu_syllabus', { predmet: '3' }, huge);
    expect(huge).toHaveBeenCalledTimes(2);
  });
});
