// The ledger and forget everything: a change Claude asked for before a forget never lands in
// the emptied folder, whether forget overtakes it mid-write, while it waits its turn, or while
// its source file is read. Split from storeLedger.test.ts.
import { describe, it, expect } from 'vitest';
import * as realFs from 'node:fs/promises';
import { createLedger } from '../storeLedger';
import { runLedger } from '../ledgerTool';
import type { StoreFs } from '../storeFs';
import { gate, storeHarness } from './storeTestKit';

const { open, leftovers } = storeHarness();
const NOW = Date.parse('2026-12-01T10:00:00Z');
const TODAY = '2026-12-01';
const ev = (over: Record<string, unknown> = {}) => ({
  title: 'Zápočtový test 1',
  kind: 'credit_test',
  date: '2026-12-10',
  time: '09:00',
  code: 'EBC-PE',
  source_kind: 'student',
  ...over,
});
const ledgerOn = (store: ReturnType<typeof open>) => createLedger(store, () => NOW);
const settle = (p: Promise<unknown>) =>
  p.then(
    () => 'saved',
    (e: Error) => e.message
  );

describe('the ledger after forget everything', () => {
  it('cannot come back after forget: an add that forget overtakes is cancelled, even from another process', async () => {
    const held = gate();
    const reached = gate();
    const slow = {
      ...realFs,
      open: async (p: Parameters<typeof realFs.open>[0], ...a: unknown[]) => {
        // The add's own file is being written: hold it right there.
        if (String(p).includes('.tmp-') && !String(p).includes('.tmp-lock-')) {
          reached.release();
          await held.wait;
        }
        return (realFs.open as (...x: unknown[]) => unknown)(p, ...a);
      },
    } as StoreFs;
    const outcome = settle(ledgerOn(open({ fs: slow })).add(ev(), TODAY));
    await reached.wait;
    await open().forget(); // another process forgets while the add is mid-write
    held.release();
    expect(await outcome).toMatch(/was not saved/);
    expect(await leftovers()).toEqual([]);
    expect((await ledgerOn(open()).list()).entries).toEqual([]);
  });

  it('cannot come back after forget: an add waiting its turn when forget runs is cancelled too', async () => {
    const held = gate();
    const reached = gate();
    let first = true;
    const slow = {
      ...realFs,
      open: async (p: Parameters<typeof realFs.open>[0], ...a: unknown[]) => {
        // Hold the first add mid-write, so the second one waits behind it.
        if (first && String(p).includes('.tmp-') && !String(p).includes('.tmp-lock-')) {
          first = false;
          reached.release();
          await held.wait;
        }
        return (realFs.open as (...x: unknown[]) => unknown)(p, ...a);
      },
    } as StoreFs;
    const l = ledgerOn(open({ fs: slow }));
    const ahead = settle(l.add(ev(), TODAY));
    await reached.wait;
    // Asked for before the forget; it only gets its turn after the forget is over.
    const queued = settle(l.add(ev({ title: 'Obhajoba', kind: 'defence' }), TODAY));
    await open().forget(); // another process forgets
    held.release();
    expect(await ahead).toMatch(/was not saved/);
    expect(await queued).toMatch(/was not saved/);
    expect(await leftovers()).toEqual([]);
    expect((await ledgerOn(open()).list()).entries).toEqual([]);
  });

  it('cannot come back after forget: an add whose source file is being read is cancelled too', async () => {
    const URL = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=7';
    await open().write(
      'listings/EBC-PE.json',
      JSON.stringify({
        code: 'EBC-PE',
        files: [{ downloadUrl: URL, name: 'zadani.pdf', modified: '24. 11. 2026' }],
      })
    );
    const held = gate();
    const reached = gate();
    let first = true;
    const slow = {
      ...realFs,
      readFile: async (p: Parameters<typeof realFs.readFile>[0], ...a: unknown[]) => {
        // Hold the tool call while it reads the source file's listing.
        if (first && String(p).includes('listings')) {
          first = false;
          reached.release();
          await held.wait;
        }
        return (realFs.readFile as (...x: unknown[]) => unknown)(p, ...a);
      },
    } as StoreFs;
    const outcome = settle(
      runLedger(
        open({ fs: slow }),
        {
          action: 'add',
          ...ev({ source_kind: 'course_file', source_modified: '24. 11. 2026' }),
          source_url: URL,
        },
        new Date(NOW)
      )
    );
    await reached.wait;
    await open().forget(); // another process forgets while the call reads
    held.release();
    expect(await outcome).toMatch(/was not saved/);
    expect(await leftovers()).toEqual([]);
  });
});
