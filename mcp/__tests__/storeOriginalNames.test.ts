// Names from IS made safe for the originals (storeOriginals.ts), and the budget evicting
// originals before anything else.
import { describe, it, expect } from 'vitest';
import { createOriginals, originalDir, safeFileName } from '../storeOriginals';
import { pickEvictions } from '../storeIndex';
import { safeRelPath } from '../storePath';
import { storeHarness } from './storeTestKit';

const { open } = storeHarness();
const URL_A = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?ds=1;id=1;download=1';
const STAMP = 'modified 20. 11. 2025';
const token = (gen: string | null) => ({ gen, at: Date.parse('2025-11-25T10:00:00Z') });
const bytes = (s: string) => new TextEncoder().encode(s);

describe('safeFileName', () => {
  it.each([
    ['../../x', '_._x'],
    ['..\\..\\evil.pdf', '_._evil.pdf'],
    ['C:\\x', 'C__x'],
    ['/etc/passwd', '_etc_passwd'],
    ['con.txt', '_con.txt'],
    ['CON .tar.gz', '_CON .tar.gz'],
    ['lpt1', '_lpt1'],
    ['.tmp-123', 'tmp-123'],
    ['.hidden.pdf', 'hidden.pdf'],
    ['report. . .', 'report'],
    ['name with spaces .pdf', 'name with spaces.pdf'],
    ['a\u0000b\u001fc<d>e:f"g|h?i*j.pdf', 'a_b_c_d_e_f_g_h_i_j.pdf'],
    ['', 'file'],
    ['...', 'file'],
    [undefined, 'file'],
    ['Přednáška 1 – úvod.pdf', 'Přednáška 1 – úvod.pdf'],
  ])('%j becomes %j', (raw, safe) => {
    expect(safeFileName(raw)).toBe(safe);
  });

  it('caps a long name at 120 bytes before the extension, never splitting a character', () => {
    const name = safeFileName(`${'ř'.repeat(300)}.pdf`);
    expect(name.endsWith('.pdf')).toBe(true);
    expect(Buffer.byteLength(name.slice(0, -4))).toBeLessThanOrEqual(120);
    expect(name).not.toContain('\ufffd');
  });

  it('always yields a name the store accepts', () => {
    for (const raw of ['../../x', 'C:\\x', 'con.txt', `${'x'.repeat(400)}.zip`, '.tmp-a', 'a/b/c'])
      expect(() => safeRelPath(`${originalDir(URL_A)}/${safeFileName(raw)}`)).not.toThrow();
  });
});

describe('the budget evicts originals first', () => {
  it('takes originals, oldest first, before any text, listing or record, and never the ledger', () => {
    const entries = [
      { path: 'text/old.json', bytes: 100, at: 1 },
      { path: 'ledger/ev-000000000001.json', bytes: 100, at: 0 },
      { path: 'originals/aa/new.pdf', bytes: 100, at: 9 },
      { path: 'originals/bb/old.pdf', bytes: 100, at: 5 },
      { path: 'listings/X.json', bytes: 100, at: 2 },
    ];
    expect(pickEvictions(entries, 300, 'none').map((e) => e.path)).toEqual([
      'originals/bb/old.pdf',
      'originals/aa/new.pdf',
    ]);
    expect(pickEvictions(entries, 200, 'none').map((e) => e.path)).toEqual([
      'originals/bb/old.pdf',
      'originals/aa/new.pdf',
      'text/old.json',
    ]);
  });

  it('a text written over the budget pushes out an original, not an older text', async () => {
    const store = open({ maxBytes: 2500 });
    const o = createOriginals(store);
    await store.write('text/a.json', 'x'.repeat(800));
    await o.save({
      url: URL_A,
      stamp: STAMP,
      bytes: bytes('o'.repeat(800)),
      filename: 'a.zip',
      token: token(await store.generation()),
    });
    await store.write('text/b.json', 'y'.repeat(800));
    const left = (await store.list()).map((e) => e.path);
    expect(left).toContain('text/a.json');
    expect(left).toContain('text/b.json');
    expect(left).not.toContain(`${originalDir(URL_A)}/a.zip`);
  });
});
