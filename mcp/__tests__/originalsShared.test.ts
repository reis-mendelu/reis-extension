// Two review findings on PR #766: saves of one link from two processes under different names
// must leave a record that points at a file that exists, and in the plugin build a repeat read
// in the same process gets the saved path, not the whole file again.
import { describe, it, expect } from 'vitest';
import { createOriginals, originalDir } from '../storeOriginals';
import { createMapPersist } from '../storeMap';
import { createToolCache } from '../cache';
import { carry } from '../originalCarry';
import { storeHarness } from './storeTestKit';

const { open } = storeHarness();
const URL_A = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=1';
const STAMP = 'modified 20. 11. 2025';
const AT = Date.parse('2025-11-25T10:00:00Z');
const bytes = (s: string) => new TextEncoder().encode(s);

describe('saving one link from two processes', () => {
  it('ends with a record that points at a file that exists, and one file left', async () => {
    const a = open();
    const b = open(); // a second process on the same folder
    const gen = await a.generation();
    for (let round = 0; round < 5; round++) {
      await Promise.all([
        createOriginals(a).save({
          url: URL_A,
          stamp: STAMP,
          bytes: bytes(`A${round}`),
          filename: 'stary-nazev.pdf',
          token: { gen, at: AT },
        }),
        createOriginals(b).save({
          url: URL_A,
          stamp: STAMP,
          bytes: bytes(`B${round}`),
          filename: 'novy-nazev.pdf',
          token: { gen, at: AT },
        }),
      ]);
      const rel = await createOriginals(a).kept(URL_A, STAMP);
      expect(rel, `round ${round}`).toBeDefined();
      expect(await a.read(rel!)).toBeDefined();
      const left = (await a.listFolder(originalDir(URL_A))).map((e) => e.path);
      expect(left.filter((p) => !p.endsWith('.json'))).toEqual([rel]);
    }
  });
});

describe('a repeat read in the plugin build', () => {
  it('is answered with the saved path once the original is kept, not the bytes again', async () => {
    const store = open({ now: () => AT });
    const { persist } = createMapPersist(store, { extractsText: false, now: () => AT });
    const cache = createToolCache({ persist, now: () => AT });
    await cache.run('mendelu_subject_files', { code: 'X' }, async () => [
      {
        name: 'Harmonogram',
        file: 'harmonogram.pdf',
        author: 'A',
        date: '1. 10. 2025',
        modified: '20. 11. 2025',
        downloadUrl: URL_A,
      },
    ]);
    let downloads = 0;
    const read = () =>
      cache.run('mendelu_read_file', { url: URL_A }, async () => {
        downloads++;
        const raw = bytes('%PDF-1.4 obsah');
        const answer = {
          handover: {
            filename: 'harmonogram.pdf',
            mimeType: 'application/pdf',
            base64: Buffer.from(raw).toString('base64'),
            bytes: raw.byteLength,
          },
        };
        return carry(answer, {
          bytes: raw,
          filename: 'harmonogram.pdf',
          mediaType: 'application/pdf',
        });
      });
    const first = (await read()) as Record<string, unknown>;
    expect(first.handover).toBeDefined(); // the first read hands the file over as before
    const again = (await read()) as Record<string, unknown>;
    expect(downloads).toBe(1);
    expect(again.handover).toBeUndefined();
    expect(again).toMatchObject({ kind: 'saved file', filename: 'harmonogram.pdf' });
    expect(String(again.localPath)).toContain(originalDir(URL_A));
  });

  it('keeps the bytes as the answer when the original could not be saved', async () => {
    const store = open({ now: () => AT, maxBytes: 4 }); // too small for any original
    const { persist } = createMapPersist(store, { extractsText: false, now: () => AT });
    const cache = createToolCache({ persist, now: () => AT });
    await cache.run('mendelu_subject_files', { code: 'X' }, async () => [
      {
        name: 'H',
        file: 'h.pdf',
        author: 'A',
        date: '1. 10. 2025',
        modified: '20. 11. 2025',
        downloadUrl: URL_A,
      },
    ]);
    const read = () =>
      cache.run('mendelu_read_file', { url: URL_A }, async () => {
        const raw = bytes('%PDF-1.4 obsah');
        return carry(
          { handover: { filename: 'h.pdf', mimeType: 'application/pdf', base64: 'x', bytes: 1 } },
          { bytes: raw }
        );
      });
    await read();
    expect(((await read()) as Record<string, unknown>).handover).toBeDefined();
  });

  it('downloads again when the saved file a held answer names was evicted', async () => {
    const store = open({ now: () => AT, maxBytes: 3000 });
    const { persist } = createMapPersist(store, { extractsText: false, now: () => AT });
    const cache = createToolCache({ persist, now: () => AT });
    await cache.run('mendelu_subject_files', { code: 'X' }, async () => [
      {
        name: 'H',
        file: 'h.pdf',
        author: 'A',
        date: '1. 10. 2025',
        modified: '20. 11. 2025',
        downloadUrl: URL_A,
      },
    ]);
    let downloads = 0;
    const read = () =>
      cache.run('mendelu_read_file', { url: URL_A }, async () => {
        downloads++;
        const raw = bytes('%PDF-1.4 '.repeat(50));
        return carry(
          {
            handover: {
              filename: 'h.pdf',
              mimeType: 'application/pdf',
              base64: 'x',
              bytes: raw.byteLength,
            },
          },
          { bytes: raw, filename: 'h.pdf' }
        );
      });
    await read();
    expect(((await read()) as Record<string, unknown>).kind).toBe('saved file');
    // Something else fills the budget: originals are evicted first.
    await store.write('text/big.json', 'y'.repeat(2500));
    expect(await createOriginals(store).kept(URL_A, STAMP)).toBeUndefined();
    const third = (await read()) as Record<string, unknown>;
    expect(downloads).toBe(2);
    expect(third.handover).toBeDefined();
  });
});
