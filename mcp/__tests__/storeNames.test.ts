import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { storeHarness } from './storeTestKit';

const { h, open } = storeHarness();

describe('names that clash', () => {
  it('a file and a folder of the same name do not drop the store to memory', async () => {
    const s = open();
    await s.write('subjects/X', 'a file');
    await expect(s.write('subjects/X/y.txt', 'nested')).resolves.toBe(false);
    await s.write('a/b', 'one');
    await expect(s.write('a', 'two')).resolves.toBe(false);
    expect(s.persistent).toBe(true);
    await expect(s.write('fine.txt', 'ok')).resolves.toBe(true);
    expect(await readFile(join(h.dir, 'fine.txt'), 'utf8')).toBe('ok');
  });

  it('refuses INDEX.JSON and .GENERATION in any case', async () => {
    const s = open();
    for (const p of ['INDEX.JSON', 'Index.Json', '.GENERATION', '.TMP-1-x']) {
      await expect(s.write(p, 'junk'), p).rejects.toThrow(/path/i);
    }
  });

  it('names differing only by case or Unicode form are one file in the index', async () => {
    const s = open();
    await s.write('a.txt', '1111');
    await s.write('A.txt', '22');
    const nfc = 'café.txt';
    const nfd = 'café.txt';
    await s.write(nfc, 'x');
    await s.write(nfd, 'yy');
    const listed = (await s.list()).map((e) => e.path);
    expect(listed.filter((p) => p.toLowerCase() === 'a.txt')).toHaveLength(1);
    expect(listed.filter((p) => p.normalize('NFC') === nfc)).toHaveLength(1);
  });

  it('a file named __proto__ is indexed, listed and removable like any other', async () => {
    const s = open();
    await s.write('__proto__', 'odd');
    await s.write('constructor', 'odd too');
    expect((await s.list()).map((e) => e.path)).toEqual(['__proto__', 'constructor']);
    await s.remove('constructor');
    expect((await s.list()).map((e) => e.path)).toEqual(['__proto__']);
    expect(await s.usage()).toEqual({ files: 1, bytes: 3 });
  });
});
