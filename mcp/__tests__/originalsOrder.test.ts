// Review findings on PR #766 (CodeRabbit): an older download never replaces a newer copy of
// the same link (in one process and across two), a save whose record evicts its own body
// reports failure, and the plugin build serves a kept original before saved text.
import { describe, it, expect } from 'vitest';
import { createOriginals, originalDir } from '../storeOriginals';
import { createMapPersist } from '../storeMap';
import { textBody, textPath } from '../storeText';
import { storeHarness } from './storeTestKit';

const { open } = storeHarness();
const URL_A = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=1';
const OLD = 'modified 20. 11. 2025';
const NEW = 'modified 21. 11. 2025';
const AT = Date.parse('2025-11-25T10:00:00Z');
const bytes = (s: string) => new TextEncoder().encode(s);

async function overlap(a: ReturnType<typeof open>, b: ReturnType<typeof open>) {
  const gen = await a.generation();
  const save = (s: ReturnType<typeof open>, stamp: string, body: string, name: string) =>
    createOriginals(s).save({
      url: URL_A,
      stamp,
      bytes: bytes(body),
      filename: name,
      token: { gen, at: AT },
    });
  // The older download reaches save second in one order, first in the other: newer wins both.
  await Promise.all([save(a, NEW, 'nova', 'novy.pdf'), save(b, OLD, 'stara', 'stary.pdf')]);
  const rel = await createOriginals(a).kept(URL_A, NEW);
  expect(rel).toBe(`${originalDir(URL_A)}/novy.pdf`);
  expect((await a.read(rel!))!.toString()).toBe('nova');
  expect(await createOriginals(a).kept(URL_A, OLD)).toBeUndefined();
  await save(b, OLD, 'stara', 'stary.pdf'); // strictly after the newer one
  expect((await a.read(rel!))!.toString()).toBe('nova');
}

describe('an older download of one link', () => {
  it('never replaces the newer copy within one process', async () => {
    const s = open();
    await overlap(s, s);
  });

  it('never replaces the newer copy across two processes', async () => {
    await overlap(open(), open());
  });
});

describe('a record that does not fit beside its body', () => {
  it('reports the save as failed instead of a path that was evicted', async () => {
    const s = open({ maxBytes: 1024 });
    const rel = await createOriginals(s).save({
      url: URL_A,
      stamp: OLD,
      bytes: bytes('x'.repeat(1000)),
      filename: 'a.zip',
      token: { gen: await s.generation(), at: AT },
    });
    expect(rel).toBeUndefined();
    expect(await createOriginals(s).kept(URL_A, OLD)).toBeUndefined();
  });

  it('succeeds when both fit', async () => {
    const s = open({ maxBytes: 1024 });
    const rel = await createOriginals(s).save({
      url: URL_A,
      stamp: OLD,
      bytes: bytes('x'.repeat(100)),
      filename: 'a.zip',
      token: { gen: await s.generation(), at: AT },
    });
    expect(rel).toBe(`${originalDir(URL_A)}/a.zip`);
  });
});

describe('saved text and a kept original of one plain-text file', () => {
  it('the plugin hands back the path; the .mcpb serves the text', async () => {
    const s = open();
    await createOriginals(s).save({
      url: URL_A,
      stamp: OLD,
      bytes: bytes('poznamky'),
      filename: 'notes.txt',
      token: { gen: await s.generation(), at: AT },
    });
    const value = { filename: 'notes.txt', kind: 'text', text: 'poznamky' };
    await s.write(
      textPath(URL_A),
      JSON.stringify({ savedAt: new Date(AT).toISOString(), ...textBody(URL_A, OLD, value) })
    );
    const plugin = createMapPersist(s, { extractsText: false });
    const mcpb = createMapPersist(s, { extractsText: true });
    expect(await plugin.persist.load('mendelu_read_file', { url: URL_A }, OLD)).toMatchObject({
      kind: 'saved file',
      filename: 'notes.txt',
    });
    expect(await mcpb.persist.load('mendelu_read_file', { url: URL_A }, OLD)).toEqual(value);
  });
});
